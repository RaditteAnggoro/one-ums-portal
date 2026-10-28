# Server installation and operations

[Indonesian / Bahasa Indonesia](deployment-id.md) · [README](../README.md)

These are deployment instructions, not evidence that your server/cluster was deployed. Keep default simulated delivery until a real provider adapter and callback contract have been verified. Web Push is optional and OFF by default. Images/manifests are examples for one environment; replace names, domains, credentials and image references.

## 1. Requirements

Use Linux with Docker Engine + Compose v2, a domain pointing to the server, HTTPS certificates and a TLS reverse proxy. Start with 4 CPU / 8 GB RAM for build and pilot operation; measure your own workload rather than treating this as certified capacity. PostgreSQL 18, Redis 8, persistent storage and backups are required. Development can use OrbStack on macOS. Kubernetes/k9s are optional; k9s is an inspection tool, not a database or deployment prerequisite.

## 2. Prepare the source and secrets

Clone your private repository with your normal GitHub authentication. Never put tokens in the clone URL.

```sh
git clone https://github.com/RaditteAnggoro/one-ums-portal.git
cd one-ums-portal
cp .env.server.example .env.server
cp .env.bootstrap.example .env.bootstrap
chmod 600 .env.server .env.bootstrap
```

Edit `.env.server`: set a unique `POSTGRES_PASSWORD`, production `APP_ORIGIN=https://ums.your-domain.example`, `COOKIE_SECURE=true`, `RUN_WORKER_IN_API=false` and `WEB_BIND=127.0.0.1`. Set `DATABASE_URL` for the Compose `postgres` service, `REDIS_URL=redis://redis:6379`. URL-encode reserved characters in database passwords. Compose expands `${POSTGRES_PASSWORD}` inside its example; a native process `.env` loader does not perform that interpolation, so native installations need the complete literal URL.

Generate a persistent encryption key and place it into `APP_ENCRYPTION_KEY`:

```sh
openssl rand -base64 32
```

Keep that key in a secret manager/backed-up secure location. Losing or changing it makes existing provider/push credentials unreadable. Do not copy `.data/secrets/master.key` or demo credentials into a fresh server. Configure `.env.bootstrap` with your initial operator email, name and password (12+ characters); use a password manager. Environment examples are placeholders.

## 3. Build and migrate

```sh
docker build -t one-ums-portal:0.1.0 .
docker compose --env-file .env.server -f compose.server.yaml up -d postgres redis
docker compose --env-file .env.server -f compose.server.yaml run --rm migrate
docker compose --env-file .env.server -f compose.server.yaml --profile tools run --rm bootstrap
```

The migration command applies numbered SQL files transactionally, records successful versions and serializes concurrent migrators with a database lock. Re-running is safe for already-applied versions. Never edit an applied migration. `db:setup` seeds synthetic demonstrations and refuses production; do not use it on a server.

Bootstrap creates the first platform administrator and an initial company, or promotes a matching existing active account after verifying its password. It refuses after any platform administrator exists. Delete `.env.bootstrap` securely after use; do not retain a reusable bootstrap secret/job. This is not a password-recovery mechanism.

## 4. Start the services and HTTPS

```sh
docker compose --env-file .env.server -f compose.server.yaml up -d api worker web
docker compose --env-file .env.server -f compose.server.yaml ps
docker compose --env-file .env.server -f compose.server.yaml logs --tail 100 api worker web
curl -f http://127.0.0.1:3000/api/health
```

Configure your host reverse proxy using `deploy/examples/nginx.conf`, replacing the domain and certificate paths, then validate/reload your proxy. Do not expose PostgreSQL, Redis or API ports publicly. Production login requires HTTPS because cookies are secure. The browser uses `/api`; Next forwards internally using runtime `API_ORIGIN=http://api:4100`. No workstation hostname is compiled into the browser. Do not override `COOKIE_SECURE` to bypass HTTPS. Optional `UI_ENVIRONMENT_LABEL` is blank by default.

For client IP audit records behind a controlled reverse proxy, configure `TRUST_PROXY_HOPS=1` only when API access is internal and the frontend is reachable through that trusted proxy. The proxy must overwrite or correctly append the real client IP; do not trust arbitrary browser-supplied forwarded headers. Validate this chain on your ingress before relying on client-IP audit attribution.

Sign in as the bootstrap operator. **Companies → New company** creates a company owner, initial team, five roles, two approval levels, cost centre and zero budget. Sign in as that company's owner to configure users, independent approvers, budget, providers, templates and data. A platform administrator does not automatically gain operational access to other companies. Change the initial password from the profile menu. Use **Help** for role-specific instructions.

## 5. Optional Web Push

Browser notifications require a secure context, a supporting browser, explicit permission and network access to its push service. Mobile/installed-web-app support varies; test on target devices. Delivery may be delayed or suppressed by the OS. Enabling this makes outbound calls to browser push infrastructure; application transport is self-hosted, but normal network/hosting costs are yours.

With Node 24/pnpm available in a secure operator checkout:

```sh
pnpm install --frozen-lockfile
pnpm push:keys
```

This creates `.data/secrets/webpush.env` with owner-only permissions, refuses overwrite and does not print keys. Set its values in server secrets, replace `VAPID_SUBJECT` with your contact, set `PUSH_ENABLED=true`, then recreate API/worker. Keep the VAPID pair stable. Defaults allow only FCM, Mozilla and Apple push hosts; extend `PUSH_ALLOWED_HOSTS` only after verifying the exact HTTPS service host (some browsers require another host).

Users select **Device notifications → Enable on this device**. This is never prompted automatically. They can choose categories, disable devices and request a test. `ACCEPTED` means push-service acceptance; `DISPLAYED` is a browser receipt, not proof a human read it. No automatic retry for ambiguous results. Logout/account changes revoke the browser's registered device. Notifications re-check current session/permissions before showing content. Operational notifications are separate from outbound customer campaigns; customer push campaigns are not implemented.

## 6. Updates, migrations and recovery

1. Back up database and encryption/VAPID secrets; test a restore in an isolated database.
2. Stop campaign-producing API and workers before a schema upgrade: `docker compose --env-file .env.server -f compose.server.yaml stop web api worker`.
3. Build a new immutable image tag; update `UMS_IMAGE` and run `run --rm migrate` with that environment file.
4. Start services, inspect logs/health and exercise login, approval and a simulated campaign.
5. If migration fails, keep writers stopped and inspect the failed version. Do not blindly downgrade the app after a schema change. There are no automatic down migrations; use a reviewed forward fix or restore the coordinated backup.

Database backup example (save outside the checkout):

```sh
docker compose --env-file .env.server -f compose.server.yaml exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > /secure-backup/ums.dump
```

Restore that dump into an **empty isolated database**, using `pg_restore --exit-on-error` as its database owner, and verify counts/approvals/ledger before planning production recovery. Redis AOF is durable queue storage; protect its volume too. The PostgreSQL outbox is authoritative, but worker restart recovery still needs explicit operator review for interrupted/uncertain runs. Do not run `down -v` on the real environment. Apply retention, encrypted backup storage and off-host copies appropriate to your data.

Monitor health, worker heartbeats (`worker_sessions`), queue backlog/oldest age, failed/unknown attempts, DB/Redis disk use and notification failures. HTTP health alone does not prove workers are processing jobs. Graceful termination allows in-flight work to finish; missed unstarted schedules require an explicit reschedule. Do not add replicas until concurrency/rate budgets and your deployment's recovery behaviour are load-tested.

## 7. Kubernetes alternative

The examples do not install persistent PostgreSQL/Redis, an ingress controller, certificates or a registry. Provision those separately and use private network connections, database TLS and Redis authentication/TLS where required. Restrict ingress/egress with policies appropriate to your DNS, DB, Redis and verified provider endpoints.

Set image tags in all manifests to an image reachable from cluster nodes. On OrbStack's integrated cluster, a locally built image with `IfNotPresent` may be available; verify your runtime instead of assuming this on a remote cluster. Do not use `latest` for production.

```sh
kubectl apply -f deploy/k8s/namespace.yaml
kubectl apply -f deploy/k8s/configmap.yaml
# Edit APP_ORIGIN and service addresses first.
cp deploy/examples/secrets.env.example /secure-path/ums-secrets.env
chmod 600 /secure-path/ums-secrets.env
# Replace every placeholder before creating the secret.
kubectl -n ums create secret generic ums-secrets --from-env-file=/secure-path/ums-secrets.env
kubectl apply -f deploy/k8s/migrate-job.yaml
kubectl -n ums wait --for=condition=complete job/ums-migrate-001 --timeout=180s
kubectl -n ums logs job/ums-migrate-001
```

For first installation create a temporary `ums-bootstrap` secret from `.env.bootstrap`, run `deploy/examples/bootstrap-job.yaml`, wait for completion and inspect its log. Delete that job and secret afterwards. For each release use a new migration Job name/image; a completed Job will not rerun just because a file is applied again.

Only after successful migration/bootstrap:

```sh
kubectl apply -f deploy/k8s/api.yaml
kubectl apply -f deploy/k8s/worker.yaml
kubectl apply -f deploy/k8s/web.yaml
kubectl -n ums rollout status deployment/ums-api
kubectl -n ums rollout status deployment/ums-web
# Customize host, TLS secret and ingress class before applying:
kubectl apply -f deploy/examples/ingress.yaml
k9s -n ums
```

Kubernetes Secrets are not encrypted merely because values are base64-encoded. Apply cluster encryption/RBAC and secret-management policies. Configure backup/restore and worker monitoring. These example single replicas are not a high-availability certification.

## 8. Native process alternative

Use Node 24+ and pinned pnpm, supply persistent PostgreSQL/Redis, then `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm db:migrate`, `pnpm db:bootstrap`. Run `pnpm start:api`, `pnpm start:worker`, `pnpm start:web` under a supervisor with separate environments and a TLS proxy. Set `NODE_ENV=production`, `API_ORIGIN` for the web process and `RUN_WORKER_IN_API=false` for API to avoid accidentally running a second embedded worker. Never run development watchers as production services.
