#!/usr/bin/env python3
"""
Vanadium 5e — GitHub push webhook that updates the static site on this server.

Security model
- Only requests signed with WEBHOOK_SECRET (GitHub's X-Hub-Signature-256, HMAC-SHA256) are accepted.
- The repository URL and branch are hardcoded below. Nothing from the request (URLs, refs, commit ids)
  is ever passed to git; the payload is only used to ignore pushes to other repos/branches.
- Files are only copied (git checkout). No code from the repository is executed on the server:
  no build step, no npm, and git hooks are disabled.
- The git data lives outside the web root, so .git is never served.
- Listens on 127.0.0.1 only; put it behind your HTTPS web server (see nginx/Caddy examples).
- Python standard library only.

Configuration (environment variables, normally from /etc/vanadium5e-webhook.env):
  WEBHOOK_SECRET          required, the secret you also enter on GitHub (e.g. `openssl rand -hex 32`)
  V5_GIT_DIR              bare git repository used for fetching   (default /srv/vanadium5e/repo.git)
  V5_WEB_ROOT             folder your web server serves           (default /var/www/vanadium5e)
  V5_LISTEN_HOST/PORT     where this service listens              (default 127.0.0.1:9055)
  V5_REQUIRE_SIGNED       "1" = only deploy commits whose GPG/SSH signature git can verify
"""
import hashlib
import hmac
import json
import logging
import os
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# ---- fixed source: never taken from the request ----
REPO_HTTPS = "https://github.com/Pr1ke/Vanadium5e.git"      # public repo: no credentials needed
REPO_SSH = "git@github.com:Pr1ke/Vanadium5e.git"            # private repo: read-only deploy key
REPO_FULL_NAME = "Pr1ke/Vanadium5e"
BRANCH = "main"
HOOK_PATH = "/hooks/vanadium5e"

SECRET = os.environ.get("WEBHOOK_SECRET", "").encode()
GIT_DIR = os.environ.get("V5_GIT_DIR", "/srv/vanadium5e/repo.git")
WEB_ROOT = os.environ.get("V5_WEB_ROOT", "/var/www/vanadium5e")
HOST = os.environ.get("V5_LISTEN_HOST", "127.0.0.1")
PORT = int(os.environ.get("V5_LISTEN_PORT", "9055"))
REQUIRE_SIGNED = os.environ.get("V5_REQUIRE_SIGNED") == "1"
DEPLOY_KEY = os.environ.get("V5_DEPLOY_KEY", "")             # path to a read-only GitHub deploy key (private repo)
KNOWN_HOSTS = os.environ.get("V5_KNOWN_HOSTS", "")           # pinned github.com host keys for that key
REPO_URL = REPO_SSH if DEPLOY_KEY else REPO_HTTPS
MAX_BODY = 2 * 1024 * 1024      # GitHub push payloads are far smaller
GIT_TIMEOUT = 180               # seconds per git command

log = logging.getLogger("vanadium5e-webhook")


# ---------------------------------------------------------------- deploy
def _git(*args):
    """Run git with fixed arguments (no shell), hooks disabled, no prompts, clean environment."""
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    env.update(GIT_TERMINAL_PROMPT="0", GIT_CONFIG_NOSYSTEM="1", LC_ALL="C")
    proto = "https"
    if DEPLOY_KEY:
        proto = "ssh"
        # only this key, only pinned github.com host keys, no agent, no interactive prompts
        env["GIT_SSH_COMMAND"] = (f"ssh -i '{DEPLOY_KEY}' -o IdentitiesOnly=yes -o IdentityAgent=none -o BatchMode=yes "
                                  f"-o StrictHostKeyChecking=yes -o UserKnownHostsFile='{KNOWN_HOSTS}' -o GlobalKnownHostsFile=/dev/null "
                                  f"-o ForwardAgent=no -o ClearAllForwardings=yes")
    cmd = ["git", "-c", "core.hooksPath=/dev/null", "-c", "credential.helper=", "-c", "protocol.allow=never", "-c", f"protocol.{proto}.allow=always",
           "--git-dir", GIT_DIR, *args]
    r = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=GIT_TIMEOUT)
    if r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args[:2])} failed: {r.stderr.strip()[:500]}")
    return r.stdout.strip()


def deploy():
    if not os.path.isdir(GIT_DIR):
        os.makedirs(os.path.dirname(GIT_DIR) or ".", exist_ok=True)
        subprocess.run(["git", "init", "--bare", "-q", GIT_DIR], check=True, timeout=GIT_TIMEOUT)
    os.makedirs(WEB_ROOT, exist_ok=True)
    ref = f"refs/heads/{BRANCH}"
    # fetch exactly one branch from the hardcoded URL (the repo's own remote config is not used)
    _git("fetch", "--prune", "--no-tags", "--depth", "50", REPO_URL, f"+{ref}:{ref}")
    if REQUIRE_SIGNED:
        _git("verify-commit", ref)
    before = ""
    try:
        before = _git("rev-parse", "--verify", "-q", "refs/deploy/current")
    except RuntimeError:
        pass
    new = _git("rev-parse", ref)
    if new == before:
        log.info("already at %s", new[:12])
        return
    # copy files into the web root; files deleted upstream are removed because the index tracks them
    _git("--work-tree", WEB_ROOT, "read-tree", "-u", "--reset", BRANCH)
    _git("update-ref", "refs/deploy/current", new)
    log.info("deployed %s (was %s)", new[:12], before[:12] or "nothing")


# one deploy at a time; pushes that arrive during a deploy trigger exactly one more run afterwards
_lock = threading.Lock()
_pending = threading.Event()


def request_deploy():
    _pending.set()
    if not _lock.acquire(blocking=False):
        return
    def run():
        try:
            while _pending.is_set():
                _pending.clear()
                try:
                    deploy()
                except Exception as e:  # keep serving; log and wait for the next push
                    log.error("deploy failed: %s", e)
                time.sleep(2)
        finally:
            _lock.release()
            if _pending.is_set():
                request_deploy()
    threading.Thread(target=run, daemon=True).start()


# ---------------------------------------------------------------- http
class Hook(BaseHTTPRequestHandler):
    server_version = "vanadium5e-webhook"
    sys_version = ""

    def _reply(self, code, msg):
        body = (msg + "\n").encode()
        self.send_response(code)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self._reply(404, "not found")

    do_PUT = do_DELETE = do_PATCH = do_HEAD = do_GET

    def do_POST(self):
        if self.path.split("?")[0] != HOOK_PATH:
            return self._reply(404, "not found")
        try:
            n = int(self.headers.get("Content-Length", ""))
        except ValueError:
            return self._reply(411, "length required")
        if n <= 0 or n > MAX_BODY:
            return self._reply(413, "payload too large")
        body = self.rfile.read(n)
        sig = self.headers.get("X-Hub-Signature-256", "")
        good = "sha256=" + hmac.new(SECRET, body, hashlib.sha256).hexdigest()
        if not sig or not hmac.compare_digest(sig, good):
            log.warning("rejected request with bad signature from %s", self.headers.get("X-Real-IP") or self.client_address[0])
            return self._reply(401, "bad signature")
        event = self.headers.get("X-GitHub-Event", "")
        if event == "ping":
            return self._reply(200, "pong")
        if event != "push":
            return self._reply(202, "ignored event")
        try:
            p = json.loads(body)
        except ValueError:
            return self._reply(400, "bad json")
        if (p.get("repository") or {}).get("full_name") != REPO_FULL_NAME or p.get("ref") != f"refs/heads/{BRANCH}":
            return self._reply(202, "ignored: not the deployed branch")
        request_deploy()
        return self._reply(202, "deploy queued")

    def log_message(self, fmt, *args):
        log.info("%s %s", self.headers.get("X-Real-IP") if self.headers else "-", fmt % args)


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    if len(SECRET) < 20:
        sys.exit("WEBHOOK_SECRET is missing or too short (use e.g. `openssl rand -hex 32`)")
    if DEPLOY_KEY and not (os.path.isfile(DEPLOY_KEY) and os.path.isfile(KNOWN_HOSTS)):
        sys.exit("V5_DEPLOY_KEY and V5_KNOWN_HOSTS must both point to existing files")
    for ch in "'\"\\":
        if ch in DEPLOY_KEY + KNOWN_HOSTS:
            sys.exit("V5_DEPLOY_KEY / V5_KNOWN_HOSTS paths must not contain quotes or backslashes")
    if "--deploy-now" in sys.argv:   # manual / first deploy from the shell
        deploy()
        return
    srv = ThreadingHTTPServer((HOST, PORT), Hook)
    srv.timeout = 15
    log.info("listening on %s:%d%s → %s", HOST, PORT, HOOK_PATH, WEB_ROOT)
    srv.serve_forever()


if __name__ == "__main__":
    main()
