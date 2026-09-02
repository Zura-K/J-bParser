# Deployment

Every push to `main` runs tests, then rsyncs the repository to the dedicated
server (`62.171.154.9`) and rebuilds the containers there. The workflow lives
in `.github/workflows/deploy.yml`.

## Architecture

```
internet ──> :80 nginx (static frontend build + /api reverse proxy)
                │ internal docker network (not reachable from outside)
                ├──> backend  (uvicorn, FastAPI, :8000)
                ├──> worker   (python -m sources.ingest, Playwright/Chromium)
                └──> valkey   (persistent volume)
```

Only nginx publishes a port. The backend, worker, and Valkey are attached to an
internal Docker network and cannot be reached from the internet. The nginx image
contains only the compiled `dist/` output and the config — no source code is
present in it, dotfile paths return 404, directory listing is off, and the
server version header is suppressed.

## One-time server setup

Run as root on the server:

```bash
# 1. Docker
curl -fsSL https://get.docker.com | sh

# 2. Deploy user (the CI connects as this user)
useradd --create-home --shell /bin/bash deploy
usermod -aG docker deploy
mkdir -p /home/deploy/.ssh
# paste the CI public key here:
nano /home/deploy/.ssh/authorized_keys
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh

# 3. Application directories and secrets
mkdir -p /opt/jbparser/app
touch /opt/jbparser/.env
chown -R deploy:deploy /opt/jbparser
chmod 600 /opt/jbparser/.env

# 4. Firewall — expose only SSH and HTTP
ufw allow 22/tcp
ufw allow 80/tcp
ufw --force enable
```

Put runtime secrets into `/opt/jbparser/.env` (never committed to git):

```
ANTHROPIC_API_KEY=sk-ant-...
# REASON_MODEL=claude-opus-5   # optional override
```

## GitHub repository secrets

| Secret           | Value                                                        |
|------------------|--------------------------------------------------------------|
| `DEPLOY_SSH_KEY` | Private key whose public half is in `deploy`'s authorized_keys |
| `DEPLOY_USER`    | Optional; defaults to `deploy`                               |

Generate the pair locally with `ssh-keygen -t ed25519 -f deploy_key -N ""`,
put `deploy_key.pub` on the server (step 2 above) and the contents of
`deploy_key` into the `DEPLOY_SSH_KEY` secret.

## Manual operations on the server

```bash
cd /opt/jbparser/app/deploy
docker compose --env-file /opt/jbparser/.env up -d --build   # rebuild + restart
docker compose logs -f backend                               # tail API logs
docker compose ps                                            # container status
```

## When a domain arrives

Add the domain as `server_name` in `deploy/nginx/nginx.conf`, publish 443 in
`deploy/docker-compose.yml`, and terminate TLS in nginx (certbot or a mounted
certificate). Until then the site is plain HTTP on http://62.171.154.9/.
