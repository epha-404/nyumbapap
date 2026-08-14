# NyumbaPap

NyumbaPap is a PWA-first Kenyan rental marketplace foundation. The repository contains separate Next.js frontend and backend applications: the frontend owns the marketplace and portals, while the backend exposes REST routes and owns database and provider integrations.

The current UI is intentionally honest: listing search and filtering work against typed demo data, while authentication, live M-Pesa payment, identity verification, uploads through a user-facing route, and production deployment are **not yet complete**. Those actions are not presented as successful simulations.

## Architecture

```text
Next.js modular monolith
|-- Public marketplace (React / typed listing DTOs)
|-- Landlord portal (module boundary; screens remain to build)
|-- Admin portal (module boundary; screens remain to build)
|-- Route handlers (health, public listings, Daraja callback)
|-- Domain modules
|   |-- authorization
|   |-- media processing
|   |-- payment providers and callback handling
|   |-- private object storage
|   |-- SMS providers
|-- MongoDB replica set through Prisma, with GeoJSON/2dsphere location indexing
```

This is deliberately a modular monolith. It keeps hosting, operations, and development affordable. MongoDB handles application documents, transactions, and GeoJSON spatial work. There is no Redis dependency; add one only after measurements show database-backed rate limits, short-lived OTP state, or background work are a bottleneck. Lightweight jobs can initially use a protected cron route plus idempotent database records.

## Local setup

Requirements: Node.js 20 LTS or newer, npm, Docker Desktop, and Docker Compose.

```bash
copy backend/.env.example backend/.env.local
copy frontend/.env.example frontend/.env.local
docker compose up -d
npm install
npm run db:generate
npm exec --workspace backend prisma db push
npm run db:seed     # once seed data is added
npm run dev
```

Open the frontend at `http://localhost:3000`. The backend listens on `http://localhost:3001`, and its health probe is `GET http://localhost:3001/api/health`. `frontend/API_BASE_URL` controls server-side API requests and the frontend's same-origin `/api` proxy. Do not commit `.env.local`; it is ignored.

The deployed backend base URL is `https://nyumba-pap-bew3p.deployments.nisoko.co.ke`. Frontend deployments must set `API_BASE_URL` to that origin; browser-facing calls continue through the frontend's same-origin `/api` rewrite so session cookies and CSRF protection remain intact.

## Nisoko Email Service

Transactional email uses NES at `https://nes.nisoko.co.ke`. Security messages send from `security@odafood.com`, support and general operations from `support@odafood.com`, and billing messages from `billing@odafood.com`.

Notifications are written transactionally to `notification_outbox`. Invoke `POST /api/internal/notifications/email` with `Authorization: Bearer $LIFECYCLE_JOB_SECRET` every minute to deliver pending messages with retry/backoff. Recipients without a stored verified email are marked `SKIPPED`; the dispatcher never substitutes an unverified address. NES lifecycle events are received at `POST /api/webhooks/nes`, verified against the raw request with HMAC-SHA256 and stored idempotently by signature hash.

Required deployment secrets are `NES_API_KEY` and `NES_WEBHOOK_SECRET`. Configure `NES_API_URL`, `NES_SECURITY_FROM`, `NES_SUPPORT_FROM`, and `NES_BILLING_FROM` from `backend/.env.example`. Never commit live keys.

MongoDB must run as a replica set because payment callbacks and unlock creation use multi-document transactions. Run `npm run mongo:start`, initialize `rs0` once, then run `npm run db:setup --workspace backend` to synchronize Prisma indexes and install partial unique plus `2dsphere` indexes.

## Data and privacy boundaries

The schema covers users/roles, landlord and agent profiles, properties, rental units, listings, media, payments, tenant unlocks, enquiries, viewing requests, reports, verification records, and audit events.

Sensitive fields are modeled separately as encrypted bytes: exact addresses, exact coordinates, owner contacts, identity numbers, verification document keys, and review notes. Search fields contain only a town, an approximate area, intentionally coarse coordinates, and a GeoJSON search point. The public listings route uses a Prisma `select` allow-list that cannot return protected columns.

`backend/src/lib/crypto.ts` provides versioned AES-256-GCM field encryption and normalized blind indexes. In production, keep the 32-byte encryption key in the host secret store, rotate it with a versioned-key procedure, and use a separate secret as the blind-index pepper. Never log decrypted values, Daraja credentials, OTPs, identity documents, or exact locations. The development console SMS provider is prohibited in production.

## Image processing and storage

`processListingImage` is the mandatory server boundary before permanent storage:

1. It checks the declared MIME against an allow-list and lets Sharp decode the actual bytes.
2. It rejects empty/oversized bodies, malformed inputs, and images over the configured pixel limit.
3. It applies EXIF orientation with `rotate()`.
4. It reconstructs the output without source EXIF, GPS, ICC, or other metadata.
5. It fits within 1,920 x 1,920 without enlarging smaller images.
6. It converts the primary asset to WebP at quality 78.
7. It assigns a random UUID storage key and never uploads the source bytes.
8. `saveListingImage` stores primary dimensions, byte size, MIME, key, and variant descriptors in `listing_media`.
9. It emits 480w and 960w WebP/AVIF variants when the source is large enough.

Objects are private in S3/R2. The storage adapter uploads processed assets only and cleans up partial uploads if database persistence fails. A production delivery route should authorize private assets or expose only approved listing derivatives through a dedicated CDN hostname; identity and verification documents must never share a public delivery path.

Virus scanning is still credential/infrastructure-dependent and must be added before accepting arbitrary production uploads. The current pipeline protects image decoding and metadata privacy but is not a malware scanner.

## Payment integrity

`DarajaProvider` implements token acquisition and STK Push initiation behind a provider interface. The callback handler:

- validates the callback shape and body size;
- looks up the server-created payment by Daraja checkout reference;
- verifies merchant reference, success code, receipt presence, and exact amount;
- records a unique callback hash and provider receipt;
- updates payment state and creates the tenant unlock in one database transaction;
- returns early for an already-paid payment.

The browser never creates an entitlement. A success screen, STK initiation response, or client request is not evidence of payment. The protected `POST /api/internal/payments/reconcile` job queries Daraja for expired PENDING/PROCESSING requests and resolves confirmed payments atomically with their tenant unlock; schedule it with `LIFECYCLE_JOB_SECRET`. Production hardening still requires configured Daraja credentials, Safaricom callback reachability, operational refund handling, and end-to-end sandbox certification. Daraja does not provide a simple webhook signing secret for this flow, so references, amounts, uniqueness constraints, HTTPS, strict parsing, reconciliation, and (where supported by the deployment) Safaricom source controls must work together.

## Verification commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Tests cover environment validation, protected-field encryption, role/object authorization, invalid/oversized image rejection, metadata stripping, resize behavior, successful and failed callbacks, amount mismatch, and callback idempotency.

## Low-budget hosting plan

- Deploy the Next.js monolith to a small Node-compatible host (for example Render, Railway, Fly.io, or a small VPS) in the nearest practical region. Avoid serverless platforms that cannot reliably bundle/run Sharp or accept Daraja callbacks.
- Start with a managed MongoDB replica set with automated daily backups and point-in-time recovery. MongoDB Atlas is the simplest production option; select a region appropriate for Kenyan users and verify transaction support.
- Use Cloudflare R2 for private processed assets; serve approved derivatives through Cloudflare with controlled URLs. Set lifecycle rules for abandoned/rejected objects.
- Use Sentry free tier with low trace sampling and PII collection disabled.
- Use a single protected scheduled trigger for vacancy expiry, reconciliation, and notification outbox work. Keep jobs idempotent.
- Put Cloudflare in front for TLS, CDN, basic WAF, bot protection, and coarse rate limiting. Add application/database rate limits before enabling OTP and writes.

## Deployment path

1. Provision a MongoDB replica set and run `npm run db:setup --workspace backend`.
2. Provision private R2/S3 buckets and a least-privilege application credential.
3. Configure a public HTTPS application origin and exact Daraja callback URL.
4. Set secrets through the host secret manager, never a committed file.
5. Run `npm ci`, `npx prisma migrate deploy`, tests, and `npm run build` in CI.
6. Deploy the Next.js server, check `/api/health`, then run a Daraja sandbox end-to-end test.
7. Enable Sentry releases/alerts, database backups, object lifecycle policies, uptime checks, and callback reconciliation before production traffic.
8. Complete Kenyan privacy, consumer, payments, tax, retention, incident-response, and terms review with qualified local advisers.

## Credential checklist

- [ ] Public `APP_URL` and HTTPS callback reachability
- [ ] Independent session, encryption, and blind-index secrets
- [ ] Production MongoDB replica-set URL and backup policy
- [ ] Daraja consumer key/secret, shortcode, passkey, callback URL, and production approval
- [ ] R2/S3 endpoint, bucket, region, least-privilege access key, lifecycle and CORS policies
- [ ] Africa's Talking username, API key, approved sender ID, message templates, and delivery callback plan
- [ ] Restricted maps browser token and separate server token if required
- [ ] Sentry DSN, project/release credentials, alert recipients, and PII review
- [ ] Confirmed publication/unlock fee values and refund policy
- [ ] Image limits, CDN delivery domain, moderation, and malware-scanning service

## Phased roadmap

### Phase 1 - complete the trustworthy MVP

- Phone OTP sessions with hashed one-time codes, expiry, attempt limits, device/IP throttles, CSRF protection, and secure cookies.
- Landlord/agent onboarding and object-authorized listing CRUD.
- Authenticated image upload route using the existing pipeline, malware scanning, moderation, and cleanup jobs.
- Admin verification/moderation portal with expiring badge definitions and immutable audit events.
- Daraja STK initiation routes for unlock/publication fees, sandbox integration tests, callback reconciliation, receipts, refunds, and finance tools.
- Paid protected-contact endpoint that checks the current tenant's unlock and audits every access.
- Enquiries, viewing requests, reports/takedown, listing expiry/reconfirmation, notification outbox, and application rate limits.
- Accessibility, PWA icons/offline shell, privacy/terms/help content, analytics consent, backups, and disaster-recovery drills.

### Phase 2 - grow after evidence

- MongoDB GeoJSON radius/map search, saved searches and alerts, agent organizations, appointment workflows, verified-interaction ratings, and automated duplicate/fraud signals.
- Add Redis only if observed traffic makes database-backed throttling or job claiming inadequate.
- Consider an Android wrapper or React Native app only after web usage demonstrates a mobile-native need.

### Phase 3 - financial expansion

- Consider reservations or rent collection only after legal, compliance, dispute, safeguarding, accounting, and operational review. Percentage fees make sense only for money the platform actually processes.

## Legacy demo

The original `index.html`, `styles.css`, and `app.js` remain in the workspace as the approved design reference. The runnable applications are under `frontend/` and `backend/`.
