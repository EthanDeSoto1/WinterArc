# Winter Arc

Track daily discipline goals with friends from Oct 1 to Jan 1.

- Create daily goals, or weekly goals you hit N times a week, and check them off each day.
- Streaks, a countdown to Jan 1, and a History calendar of the season.
- Add friends by username and see each other's goals and today's progress.

The whole app runs in one Docker container on a home server. It is meant to be reached only over a private [Tailscale](https://tailscale.com) network, never the public internet.

## Project layout

```
client/              React app (Vite, Tailwind)
server/              Express API and SQLite database code
server/src/schema.sql  Database tables, created automatically on start
Dockerfile           Builds the client, then runs the server
docker-compose.yml   Runs the container
scripts/backup.sh    Backs up the database to backups/
scripts/restore.sh   Puts a backup back in place
.env.example         Copy to .env and fill in
```

## 1. First-time setup on the server

Run these on your Linux server, inside the project folder (for example `~/winter-arc`). You need Docker with the Compose plugin.

1. Create your settings file:

   ```bash
   cp .env.example .env
   ```

2. Put a long random session secret in it:

   ```bash
   sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=$(openssl rand -hex 32)|" .env
   ```

3. Open `.env` with `nano .env` and set `INVITE_CODE` to a word only your friends will know. Leave it empty to let anyone on your tailnet sign up. Save with Ctrl+O, Enter, then exit with Ctrl+X.

4. Notifications (optional). After the first `docker compose up -d --build` (section 2), create the notification keys once, then restart:

   ```bash
   docker compose run --rm --no-deps -T app node -e "const k = require('web-push').generateVAPIDKeys(); console.log('VAPID_PUBLIC_KEY=' + k.publicKey); console.log('VAPID_PRIVATE_KEY=' + k.privateKey)" >> .env
   docker compose up -d
   ```

   Keep these keys. If they change, everyone has to turn notifications on again in Account. Without them the app still works, with notifications off.

`.env` holds secrets. Never commit it or share it.

## 2. Start, stop, logs, updates

| What | Command |
| --- | --- |
| Build and start in the background | `docker compose up -d --build` |
| Check it is running and healthy | `docker compose ps` |
| Health check | `curl http://127.0.0.1:3000/api/health` |
| Follow the logs (Ctrl+C to stop following) | `docker compose logs -f` |
| Restart | `docker compose restart` |
| Stop | `docker compose down` |
| Update after code changes | `docker compose up -d --build` |

`docker compose ps` shows `(healthy)` about 10 seconds after starting.

The database lives in a Docker volume called `winter-arc_winter-arc-data`. It survives restarts, rebuilds and `docker compose down`. **Do not** run `docker compose down -v`, because `-v` deletes the volume and all data.

The app only listens on `127.0.0.1:3000` (the server itself), so nothing else can reach that port directly. Tailscale provides the outside access in the next step.

## 3. HTTPS on your tailnet with `tailscale serve`

HTTPS is required for login cookies and for installing the app on phones.

1. In the Tailscale admin console (https://login.tailscale.com/admin/dns):
   - Under **MagicDNS**, click **Enable MagicDNS** if it is not already on.
   - Under **HTTPS Certificates**, click **Enable HTTPS**.
2. On the server, find your machine's full name:

   ```bash
   tailscale status --self --peers=false
   ```

   The address looks like `<machine-name>.<tailnet>.ts.net`.
3. Point Tailscale at the app:

   ```bash
   sudo tailscale serve --bg 3000
   ```

   `--bg` keeps the setting saved, so it comes back by itself after a reboot. The first request can take a few seconds while Tailscale gets the certificate.
4. Check it:

   ```bash
   tailscale serve status
   ```

   It should show `https://<machine-name>.<tailnet>.ts.net` proxying to `http://127.0.0.1:3000`.
5. Open `https://<machine-name>.<tailnet>.ts.net` on any device signed in to your tailnet.

To turn it off: `sudo tailscale serve reset`.

Do **not** use `tailscale funnel`. Funnel puts the app on the public internet. `serve` keeps it inside your tailnet.

## 4. Nightly backups

`scripts/backup.sh` copies the live database into the `backups/` folder next to `docker-compose.yml`, as a file named like `winter-arc-2026-10-01-033000.db`. It checks that the copy is not damaged, keeps the newest 14 nightly files and deletes older ones. The app keeps running while it works.

It also copies Board photos into `backups/photos/`. That folder is one growing copy of every photo (photo files never change), so it is not pruned.

1. Run it once by hand to check it works:

   ```bash
   bash scripts/backup.sh
   ls -l backups
   ```

2. Run it every night at 3:30 in the morning (server time). Open your crontab:

   ```bash
   crontab -e
   ```

   Add this line at the bottom, then save and exit:

   ```
   30 3 * * * bash $HOME/winter-arc/scripts/backup.sh >> $HOME/winter-arc/backups/backup.log 2>&1
   ```

   Change `$HOME/winter-arc` if your project folder is somewhere else.

3. The next morning, check that it ran:

   ```bash
   tail backups/backup.log
   ```

   Each night adds a `saved backups/...` line. An error there means the backup did not happen, for example because the container was stopped.

The backups hold everyone's accounts, so the folder is readable only by you. They are on the same disk as the app, so now and then copy the newest one to another computer or a USB drive too.

### Restoring a backup

This replaces the current database with the backup. Anything done in the app after that backup is lost.

```bash
ls -l backups
bash scripts/restore.sh backups/winter-arc-2026-10-01-033000.db
```

The script first saves the current database as `backups/before-restore-<date>.db` (if the app is running), so you can undo the restore by restoring that file. Then it stops the app, puts the backup in place, copies back any photos from `backups/photos/` that are missing, and starts the app again. Run `docker compose ps` after about 10 seconds and check it shows `(healthy)`.

## 5. Sharing with friends

Friends reach the app through **Tailscale machine sharing**. They get access to this one server, not to the rest of your tailnet.

1. In the Tailscale admin console, open **Machines** (https://login.tailscale.com/admin/machines).
2. Find your server, click the **...** menu next to it, then **Share...**.
3. Copy the invite link and send it to your friend. Each link works for one person.
4. Your friend:
   1. Installs the Tailscale app on their phone (App Store or Google Play) and signs in. Any account works, such as Google or Apple.
   2. Opens the invite link and accepts it with the same account.
   3. Turns Tailscale on in the app.
   4. Opens `https://<machine-name>.<tailnet>.ts.net` in their phone's browser.
5. Give them the invite code from your `.env` so they can sign up.

Tailscale must be switched on whenever they use the app. Without it, the app shows a "Could not reach Winter Arc" screen.

If you ever changed your tailnet's access rules, make sure people you share with can still reach this machine.

Never use `tailscale funnel` to "make sharing easier". It puts the app on the public internet.

## 6. Installing on a phone

Winter Arc can be added to the home screen and opens full screen, like an app.

**iPhone:** open the site in **Safari**, tap the **Share** button, then **Add to Home Screen**, then **Add**. It has to be Safari; other iPhone browsers may not offer this.

**Android:** open the site in **Chrome**, tap the **⋮** menu, then **Install app** (on some phones it says **Add to Home screen**), then **Install**.

The app updates by itself after you deploy a new version. If something looks stale, close it fully and open it again.

**Notifications:** open the app from its home screen icon, go to **Account → Notifications**, tap **Turn on**, then **Allow**. On iPhone this needs iOS 16.4 or newer and only works from the home screen icon, not a Safari tab. Tap **Send a test** to check. Everyone picks what they get (Board posts, reactions and comments on their posts, friends' goals, and morning, midday and evening reminders). Notifications arrive through Apple's or Google's push service, so they show up even when Tailscale is off; opening one still needs Tailscale. The server needs normal outbound internet access to send them.

## Local development (optional)

With Node 22 or newer, create a `.env` in the project folder for development:

```
SESSION_SECRET=any-string-at-least-32-characters-long
INVITE_CODE=
COOKIE_SECURE=false
```

To try notifications locally, add `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` from `cd server && node -e "console.log(require('web-push').generateVAPIDKeys())"`. The service worker is only registered in production builds (`npm run build`, then open the app from the server's port).

`COOKIE_SECURE=false` is only for plain `http://localhost` during development. Never set it on the server, where login cookies must stay HTTPS-only.

Then, in two terminals:

```bash
cd server && npm install && npm run dev
cd client && npm install && npm run dev
```

Open the address Vite prints. The client dev server passes `/api` requests through to the server on port 3000.

Run the server tests with `cd server && npm test`.

## Keeping this repo safe to share

This repository is public. Never commit:

- `.env` or any real `SESSION_SECRET` or `INVITE_CODE`
- database files (`*.db`) or backups
- server names, tailnet addresses, IP addresses, SSH details or users' names and emails

Private notes about a specific deployment belong in `HANDOFF.md`, which is git-ignored and stays on your own computer.
