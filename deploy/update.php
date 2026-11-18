<?php
/**
 * Vanadium 5e — self-update endpoint for plain PHP/Apache hosting.
 *
 * Upload this ONE file by FTP into the folder that serves the site (next to index.html).
 * The "Update from GitHub" button on the Library page calls it.
 *
 *   GET  update.php   → status as JSON (no network calls, never changes anything)
 *   POST update.php   → update, at most once every COOLDOWN seconds for everyone
 *
 * Safety
 * - Source is hardcoded: github.com/Pr1ke/Vanadium5e, branch main. The request has no parameters.
 * - Cooldown is enforced here on the server, using a file lock, so clicks can't bypass it. Failed attempts count too.
 * - Downloads over HTTPS with certificate checks, pinned to the exact commit id GitHub reports.
 * - Only static file types are installed (ALLOWED_EXT). Never .php, .htaccess or other dotfiles,
 *   and never the deploy/ or tools/ folders, so the repository can't run code on this server or replace this file.
 * - Zip entries are checked for path tricks (../, absolute paths) and size limits before anything is written.
 * - Only the repo's static files are written. Only files that an earlier update installed are ever deleted,
 *   so anything else you keep in the folder (other pages, this file, .htaccess) is left alone.
 */
declare(strict_types=1);

const REPO        = 'Pr1ke/Vanadium5e';
const BRANCH      = 'main';
const COOLDOWN    = 300;                 // seconds between update attempts (5 minutes)
const UPDATE_KEY  = '';                  // optional password; '' = anyone can press the button
const MAX_ZIP     = 40 * 1024 * 1024;    // download limit
const MAX_TOTAL   = 120 * 1024 * 1024;   // uncompressed limit
const MAX_FILES   = 3000;
const REQUIRED    = ['index.html', 'js/main.js', 'js/core.js', 'data/srd.json'];
const SKIP_DIRS   = ['deploy/', 'tools/'];
const ALLOWED_EXT = ['html', 'htm', 'js', 'mjs', 'css', 'json', 'txt', 'md', 'svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'woff', 'woff2', 'webmanifest'];

ini_set('display_errors', '0');          // warnings must never leak into the JSON reply
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$root = __DIR__;
$state_dir = state_dir($root);
$state_file = $state_dir . '/state.json';

function out(int $code, array $body): void { http_response_code($code); echo json_encode($body, JSON_UNESCAPED_SLASHES); exit; }
function load_state(string $f): array { $s = @json_decode((string)@file_get_contents($f), true); return is_array($s) ? $s : []; }
function save_state(string $f, array $s): void { $t = $f . '.tmp'; file_put_contents($t, json_encode($s, JSON_UNESCAPED_SLASHES)); rename($t, $f); }

/** Private folder for state: one level above the web root if writable, else a hidden folder blocked by .htaccess. */
function state_dir(string $root): string {
    $up = dirname($root) . '/vanadium5e-update';
    if ((is_dir($up) || @mkdir($up, 0750)) && is_writable($up)) return $up;
    $in = $root . '/.vanadium5e-update';
    if (!is_dir($in)) @mkdir($in, 0750);
    if (!is_file($in . '/.htaccess')) @file_put_contents($in . '/.htaccess', "Require all denied\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n");
    return $in;
}

function http_get(string $url, int $max, array $headers = []): string {
    $headers[] = 'User-Agent: vanadium5e-updater';
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        $buf = '';
        curl_setopt_array($ch, [
            CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 3, CURLOPT_PROTOCOLS => CURLPROTO_HTTPS, CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 90,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_WRITEFUNCTION => function ($ch, $chunk) use (&$buf, $max) { $buf .= $chunk; return strlen($buf) > $max ? 0 : strlen($chunk); },
        ]);
        $ok = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if (strlen($buf) > $max) throw new RuntimeException('download too large');
        if ($ok === false || $code !== 200) throw new RuntimeException("GitHub request failed ($code) $err");
        return $buf;
    }
    $ctx = stream_context_create(['http' => ['timeout' => 90, 'header' => implode("\r\n", $headers), 'follow_location' => 1, 'max_redirects' => 3, 'ignore_errors' => true],
                                  'ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
    $h = @fopen($url, 'rb', false, $ctx);
    if (!$h) throw new RuntimeException('GitHub request failed (no curl, fopen failed)');
    $meta = stream_get_meta_data($h);
    $status = 0; foreach ($meta['wrapper_data'] ?? [] as $l) if (preg_match('#^HTTP/\S+\s+(\d+)#', $l, $m)) $status = (int)$m[1];
    $buf = stream_get_contents($h, $max + 1); fclose($h);
    if (strlen($buf) > $max) throw new RuntimeException('download too large');
    if ($status !== 200) throw new RuntimeException("GitHub request failed ($status)");
    return $buf;
}

/** Returns [relative path => contents] for allowed files, or throws. */
function read_zip(string $zipfile, string $prefix): array {
    $z = new ZipArchive();
    if ($z->open($zipfile) !== true) throw new RuntimeException('could not open the downloaded zip');
    if ($z->numFiles > MAX_FILES) throw new RuntimeException('zip has too many files');
    $files = []; $total = 0;
    for ($i = 0; $i < $z->numFiles; $i++) {
        $st = $z->statIndex($i);
        $name = $st['name'];
        if (substr($name, -1) === '/') continue;                                   // directory entry
        if (strpos($name, $prefix) !== 0) throw new RuntimeException('unexpected zip layout');
        $rel = substr($name, strlen($prefix));
        if ($rel === '' || strpos($rel, "\0") !== false || strpos($rel, '\\') !== false || $rel[0] === '/' || preg_match('#(^|/)\.\.?(/|$)#', $rel) || preg_match('#^[A-Za-z]:#', $rel))
            throw new RuntimeException('unsafe path in zip: ' . $rel);
        foreach (SKIP_DIRS as $d) if (strpos($rel, $d) === 0) continue 2;
        if (preg_match('#(^|/)\.#', $rel)) continue;                                // dotfiles (.htaccess, .gitignore …)
        $ext = strtolower(pathinfo($rel, PATHINFO_EXTENSION));
        if (!in_array($ext, ALLOWED_EXT, true)) continue;                            // never install .php or anything executable
        $total += $st['size'];
        if ($total > MAX_TOTAL) throw new RuntimeException('zip too large when unpacked');
        $data = $z->getFromIndex($i);
        if ($data === false || strlen($data) !== $st['size']) throw new RuntimeException('corrupt zip entry: ' . $rel);
        $files[$rel] = $data;
    }
    $z->close();
    foreach (REQUIRED as $r) if (!isset($files[$r])) throw new RuntimeException("update looks incomplete (missing $r); nothing was changed");
    return $files;
}

function install(string $root, array $files, array $previous): array {
    // write every file to a temp name first, then rename into place (each file switches atomically)
    $tmp = [];
    try {
    foreach ($files as $rel => $data) {
        $dst = $root . '/' . $rel;
        $dir = dirname($dst);
        if (!is_dir($dir) && !mkdir($dir, 0755, true)) throw new RuntimeException("cannot create folder for $rel");
        if (is_dir($dst) || is_link($dst)) throw new RuntimeException("refusing to replace folder or link at $rel");
        $t = $dst . '.v5tmp';
        if (file_put_contents($t, $data) !== strlen($data)) throw new RuntimeException("cannot write $rel (check folder permissions)");
        $tmp[$t] = $dst;
    }
    foreach ($tmp as $t => $dst) { if (!rename($t, $dst)) throw new RuntimeException('cannot move ' . basename($dst) . ' into place'); unset($tmp[$t]); }
    } finally {
        foreach ($tmp as $t => $dst) if (is_file($t)) @unlink($t);   // leave no half-written files behind
    }
    // remove files a previous update installed that are gone from the repo now
    foreach ($previous as $rel) {
        if (isset($files[$rel])) continue;
        $p = $root . '/' . $rel;
        if (is_file($p) && in_array(strtolower(pathinfo($rel, PATHINFO_EXTENSION)), ALLOWED_EXT, true)) @unlink($p);
    }
    return array_keys($files);
}

// ------------------------------------------------------------------ request
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$s = load_state($state_file);
$now = time();
$next = (int)($s['last_attempt'] ?? 0) + COOLDOWN;
$status = ['repo' => REPO, 'branch' => BRANCH, 'commit' => $s['commit'] ?? null, 'updated_at' => $s['updated_at'] ?? null,
           'last_result' => $s['last_result'] ?? null, 'cooldown' => COOLDOWN, 'next_allowed_in' => max(0, $next - $now), 'needs_key' => UPDATE_KEY !== ''];

if ($method === 'GET') out(200, ['ok' => true] + $status);
if ($method !== 'POST') { header('Allow: GET, POST'); out(405, ['ok' => false, 'error' => 'method not allowed']); }
if (UPDATE_KEY !== '' && !hash_equals(UPDATE_KEY, (string)($_SERVER['HTTP_X_UPDATE_KEY'] ?? ''))) out(403, ['ok' => false, 'error' => 'wrong update password'] + $status);
foreach (['ZipArchive'] as $c) if (!class_exists($c)) out(500, ['ok' => false, 'error' => 'PHP zip extension is not enabled on this host']);

// one update at a time, and the cooldown is checked inside the lock
$lock = @fopen($state_dir . '/update.lock', 'c');
if (!$lock) out(500, ['ok' => false, 'status' => 'failed', 'error' => 'cannot write the updater state folder (check permissions)'] + $status);
if (!flock($lock, LOCK_EX | LOCK_NB)) out(429, ['ok' => false, 'status' => 'busy', 'error' => 'an update is already running'] + $status);
$s = load_state($state_file);
$wait = (int)($s['last_attempt'] ?? 0) + COOLDOWN - $now;
if ($wait > 0) { header('Retry-After: ' . $wait); out(429, ['ok' => false, 'status' => 'cooldown', 'error' => "please wait {$wait} s", 'next_allowed_in' => $wait] + $status); }
$s['last_attempt'] = $now;
save_state($state_file, $s);

@set_time_limit(180);
$zipfile = $state_dir . '/download.zip';
try {
    $sha = trim(http_get('https://api.github.com/repos/' . REPO . '/commits/' . BRANCH, 200, ['Accept: application/vnd.github.sha']));
    if (!preg_match('/^[0-9a-f]{40}$/', $sha)) throw new RuntimeException('GitHub did not return a commit id');
    if (($s['commit'] ?? '') === $sha && is_file($root . '/index.html')) {
        $s['last_result'] = 'already up to date';
        [$code, $res] = [200, ['ok' => true, 'status' => 'current', 'commit' => $sha]];
    } else {
        file_put_contents($zipfile, http_get('https://codeload.github.com/' . REPO . '/zip/' . $sha, MAX_ZIP));
        $repoName = substr(REPO, strpos(REPO, '/') + 1);
        $files = read_zip($zipfile, $repoName . '-' . $sha . '/');
        $s['files'] = install($root, $files, $s['files'] ?? []);
        $s['commit'] = $sha; $s['updated_at'] = gmdate('c'); $s['last_result'] = 'updated to ' . substr($sha, 0, 7);
        [$code, $res] = [200, ['ok' => true, 'status' => 'updated', 'commit' => $sha, 'updated_at' => $s['updated_at'], 'files' => count($files)]];
    }
} catch (Throwable $e) {
    $s['last_result'] = 'failed: ' . $e->getMessage();
    [$code, $res] = [502, ['ok' => false, 'status' => 'failed', 'error' => $e->getMessage()]];
}
save_state($state_file, $s);
if (is_file($zipfile)) @unlink($zipfile);
flock($lock, LOCK_UN); fclose($lock);
out($code, $res + ['next_allowed_in' => COOLDOWN, 'last_result' => $s['last_result']] + $status);
