# Auto-deploy from GitHub (webhook)

When you push to `main`, GitHub calls your server. The server checks that the call really came from GitHub (signed with your secret), then fetches `main` from the hardcoded repo and copies the files into the web root. Nothing from the repo is executed, `.git` never ends up in the web root, and the service runs as an unprivileged, sandboxed user.

Assumed setup: Linux with systemd, Python 3, git, and nginx or Caddy already serving the site over HTTPS. Adjust the paths if yours differ.

## 1. User and folders

```sh
sudo useradd --system --home /srv/vanadium5e --shell /usr/sbin/nologin vanadium-deploy
sudo mkdir -p /srv/vanadium5e /var/www/vanadium5e
sudo chown vanadium-deploy:vanadium-deploy /srv/vanadium5e /var/www/vanadium5e
sudo install -o root -g root -m 755 deploy/webhook.py /srv/vanadium5e/webhook.py
```

`webhook.py` belongs to root, so the service can't modify its own code.

## 2. Secret

```sh
openssl rand -hex 32        # copy the output
sudo install -o root -g vanadium-deploy -m 640 deploy/webhook.env.example /etc/vanadium5e-webhook.env
sudo nano /etc/vanadium5e-webhook.env   # paste it as WEBHOOK_SECRET
```

## 3. Repo access

**Public repo:** leave `V5_DEPLOY_KEY` and `V5_KNOWN_HOSTS` empty in the env file.

**Private repo:** use a deploy key, which can read only this one repository.

```sh
sudo -u vanadium-deploy ssh-keygen -t ed25519 -N "" -C vanadium5e-deploy -f /srv/vanadium5e/deploy_key
sudo cat /srv/vanadium5e/deploy_key.pub
```

On GitHub, go to the repo's **Settings → Deploy keys → Add deploy key**, paste the public key and leave **Allow write access unchecked**.

Then pin GitHub's SSH host keys, taken from GitHub's published list:

```sh
curl -fsS https://api.github.com/meta | python3 -c 'import json,sys; [print("github.com", k) for k in json.load(sys.stdin)["ssh_keys"]]' \
  | sudo -u vanadium-deploy tee /srv/vanadium5e/known_hosts
```

## 4. First deploy and service

```sh
sudo -u vanadium-deploy env $(sudo cat /etc/vanadium5e-webhook.env | grep -v '^#' | xargs) python3 -I /srv/vanadium5e/webhook.py --deploy-now
sudo install -m 644 deploy/vanadium5e-webhook.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now vanadium5e-webhook
sudo journalctl -u vanadium5e-webhook -f      # watch the log
```

## 5. Web server

Add the `location = /hooks/vanadium5e` block from `nginx.conf.example` (or the Caddy version) to the site's HTTPS config and reload. The service listens only on `127.0.0.1`. The internet reaches it only through your HTTPS server, which also rate-limits it.

## 6. GitHub webhook

In the repo, go to **Settings → Webhooks → Add webhook**:

- **Payload URL:** `https://your-domain/hooks/vanadium5e`
- **Content type:** `application/json`
- **Secret:** the value from step 2
- **Events:** *Just the push event*

GitHub sends a `ping` right away and should show a green tick (`pong`). Push something to `main`, and the log shows `deployed <commit>`.

## Notes

- **Unsigned requests:** anything without a valid signature gets `401` and is logged. Pushes to other branches or repos are ignored.
- **Bursts of pushes:** they collapse into one deploy, and a push that arrives mid-deploy triggers one more run afterwards.
- **Rotating the secret:** change it in both GitHub and the env file, then `sudo systemctl restart vanadium5e-webhook`.
- **Signed commits:** for extra protection against a compromised GitHub account, sign your commits and set `V5_REQUIRE_SIGNED=1`. The server must have your public signing key (GPG keyring or `gpg.ssh.allowedSignersFile`).
- **Leftover files:** files deleted from the repo are removed from the web root on the next deploy. Files that were never in the repo are left alone.
- **Players' browsers:** they pick up new files automatically. Bump `DATA_V` in `js/core.js` whenever `data/` changes.
