# Deployment

Jurgens Energy deploys to the self-hosted Windows server through a GitHub Actions
self-hosted runner running inside Ubuntu/WSL.

## Flow

```text
Push to main
-> GitHub Actions
-> self-hosted runner on the Windows server
-> npm ci
-> lint and build
-> database migrations
-> Docker Compose rebuild/restart
```

Uploaded media and generated files stay outside the repo under
`/mnt/c/JurgensEnergy/storage/...`. PostgreSQL, Redis, Caddy, and Cloudflare Tunnel
state stay in Docker named volumes. A deploy should not delete live data.

## Server Environment File

The GitHub runner checks out the repo into its own work directory, so do not
depend on the `.env` inside `~/Dev/jurgens-energy-web`.

Store the production server environment at:

```text
/mnt/c/JurgensEnergy/config/jurgens-energy-web.env
```

Create it from Ubuntu/WSL:

```bash
mkdir -p /mnt/c/JurgensEnergy/config
cp ~/Dev/jurgens-energy-web/.env /mnt/c/JurgensEnergy/config/jurgens-energy-web.env
chmod 600 /mnt/c/JurgensEnergy/config/jurgens-energy-web.env
```

The workflow copies that file to `.env` during deployment. To use a different
path, set `JURGENS_ENERGY_ENV_FILE` in the runner environment.

## GitHub Runner

In GitHub:

```text
Repository
-> Settings
-> Actions
-> Runners
-> New self-hosted runner
-> Linux
-> x64
```

Run the commands GitHub gives you inside Ubuntu/WSL on the Windows server.

Use a dedicated repository runner for this app so it does not clash with other
self-hosted runners on the same server:

```text
Runner name:  jurgens-energy-web-prod-01
Runner label: jurgens-energy-web-prod
Runner dir:   ~/actions-runner-jurgens-energy-web
Work dir:     _work-jurgens-energy-web
```

The workflow targets:

```yaml
runs-on: [self-hosted, linux, x64, jurgens-energy-web-prod]
```

That means the deploy job will only run on a Linux x64 self-hosted runner with
the `jurgens-energy-web-prod` label. Generic self-hosted runners for other
projects should not pick up this deployment.

If there are old queued deploy runs from before this label was added, cancel
those runs in GitHub before starting the runner. Those old runs targeted the
broad `self-hosted` label and may be picked up by any available self-hosted
runner.

Example isolated setup:

```bash
mkdir -p ~/actions-runner-jurgens-energy-web
cd ~/actions-runner-jurgens-energy-web

# Run the download/extract commands shown by GitHub, then configure with:
./config.sh \
  --url https://github.com/CodingProdige/jurgens-energy-web \
  --token <token-from-github> \
  --name jurgens-energy-web-prod-01 \
  --labels jurgens-energy-web-prod \
  --work _work-jurgens-energy-web \
  --unattended
```

For the first pass, starting the runner with `./run.sh` is enough. Once a
deploy succeeds, install it as a service from the same runner directory:

```bash
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh status
```

## Manual Deploy

From the server checkout:

```bash
cd ~/Dev/jurgens-energy-web
git pull
npm ci
npm run lint
npm run build
npm run selfhost:deploy
```

`npm run selfhost:deploy` starts Postgres and Redis, runs migrations, then
rebuilds and restarts the self-hosted Docker stack. If
`CLOUDFLARE_TUNNEL_TOKEN` is present in `.env`, it also starts the tunnel
profile.
