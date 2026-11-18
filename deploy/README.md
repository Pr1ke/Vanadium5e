# Updating the site from GitHub (PHP/Apache hosting)

The **Library** page has an **Update from GitHub** button. It asks `update.php` on your server to download the latest `main` of `github.com/Pr1ke/Vanadium5e` and install it. Anyone can press it, but the server allows only one attempt every 5 minutes, failed attempts included.

## What protects your server

- **Fixed source:** the repo and branch are hardcoded in `update.php`. The button sends no parameters, so there's nothing to tamper with.
- **Server-side cooldown:** a lock file on the server enforces the 5-minute limit, so clicking faster or calling the URL directly doesn't help.
- **Checked downloads:** HTTPS with certificate checks, pinned to the exact commit GitHub reports.
- **Static files only:** html, js, css, json, images and fonts are the only file types installed. `.php`, `.htaccess`, other dotfiles and the `deploy/` and `tools/` folders are never installed. Even if someone took over the GitHub repo, they couldn't run code on your server or replace `update.php`. The worst case is a changed website.
- **No path tricks:** zip entries containing `../` or absolute paths are rejected before anything is written.
- **Nothing else is touched:** only files that an earlier update installed are ever deleted. Other things in the folder stay.
- **Hidden state:** the updater's state goes into a folder *above* the web root when the host allows it. Otherwise it uses a hidden folder protected by `.htaccess`. The state is just the version, time and file list, nothing secret.

## Setup

1. **Make the repo public:** GitHub → repo **Settings → General → Danger Zone → Change visibility → Public**. The updater downloads without credentials, so there's no token on the server that could leak.
2. **Upload the site once by FTP** into your web folder: `index.html`, `js/`, `data/` and, if you like, `README.md` and `CREDITS.md`. You don't need to upload `tools/` or the rest of `deploy/`.
3. **Upload `deploy/update.php`** into the same folder, next to `index.html`.
4. **Check the folder is writable by PHP.** On most shared hosts it already is. If the button reports a permission error, set the web folder to 755 (folders) / 644 (files), or ask your host which user PHP runs as.
5. Open the site → **Library → Site updates → Update from GitHub**. The first press installs the current version and records it. After that, each press only downloads when there's something new.

PHP requirements: PHP 7.4 or newer with the **zip** extension, plus either **curl** or `allow_url_fopen`. These are standard on shared hosting. The button shows an error message if one is missing.

## Options (top of `update.php`)

- `COOLDOWN`: seconds between attempts (default 300).
- `UPDATE_KEY`: set a password to stop the public from pressing the button. The page then asks for it.

## Notes

- **Players' browsers:** they pick up new files on their next visit. The person who presses the button gets a reload with fresh files. Bump `DATA_V` in `js/core.js` whenever `data/` changes.
- **Failed updates:** an update that fails halfway leaves every file either fully old or fully new, never half-written. Press again after the cooldown.
- **Removing the button:** delete `update.php` from the server. The Library page then says the updater isn't installed.
