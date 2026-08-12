# NyumbaPap platform architecture

## Repository layout

The current implementation uses two independently deployable Next.js applications. `frontend/` contains only UI and API-client concerns. `backend/` contains REST route handlers, domain modules, Prisma, and provider integrations. The backend remains a modular monolith; this repository split is a deployment boundary, not a business-domain split.

## Product model

NyumbaPap is a two-sided rental marketplace. Tenants search verified vacancies for free, then pay a small one-time fee (illustrated as KSh 100) to unlock the exact location and owner contact for one listing. Owners pay a fixed publishing fee for the MVP; a percentage fee only makes sense later if the platform collects rent or booking deposits, because percentage billing cannot be reliably enforced on an offline tenancy.

Roles: tenant, landlord, authorised agent, verifier/support agent, finance operator, and administrator.

## Recommended production shape

```text
Web app / Android app / iOS app
              |
      API gateway + rate limits
              |
  Identity and permissions service
              |
  -------------------------------------------------
  | Listings | Search | Payments | Messaging | Trust |
  -------------------------------------------------
       |          |          |          |
  PostgreSQL   OpenSearch   M-Pesa    Object storage
  + PostGIS     (later)     Daraja    (property photos)
       |
  Event queue -> notifications, moderation, analytics, receipts
```

Start as a modular monolith rather than separate microservices: one TypeScript backend with clearly separated modules, PostgreSQL/PostGIS, Redis for rate limits and short-lived state, and S3-compatible photo storage. Split services only after traffic or team ownership makes that worthwhile.

## Suggested stack

- Web: Next.js with responsive PWA behavior; mobile apps can follow in React Native.
- API: NestJS or Next.js server routes, REST with an OpenAPI contract.
- Data: managed PostgreSQL with PostGIS; Redis for caching, sessions, and jobs.
- Search: PostgreSQL full-text and spatial queries first; OpenSearch when scale requires it.
- Payments: Safaricom Daraja STK Push and callback validation, with a provider abstraction for Airtel Money/card later.
- Maps: Google Maps or Mapbox; store public approximate coordinates separately from protected exact coordinates.
- Files: S3-compatible private object storage with signed upload/download URLs.
- Operations: container hosting in an African region where practical, CDN/WAF, error tracking, product analytics, and automated backups.

## Core data model

| Entity | Important fields |
|---|---|
| users | id, phone, email, role, status, verified_at |
| landlord_profiles | user_id, national_id_hash, verification_state |
| properties | id, owner_id, county, town, estate, approximate_point, exact_point_encrypted |
| units | property_id, type, bedrooms, rent, deposit, amenities, availability_state |
| listings | unit_id, status, published_at, expires_at, verification_state |
| listing_media | listing_id, storage_key, sort_order, moderation_state |
| unlocks | tenant_id, listing_id, payment_id, granted_at, expires_at |
| payments | id, user_id, purpose, amount, provider_reference, state, raw_callback_hash |
| enquiries | tenant_id, listing_id, channel, state |
| reports | reporter_id, listing_id, reason, status, reviewer_id |
| audit_events | actor_id, action, entity_type, entity_id, timestamp, metadata |

Use integer amounts in Kenyan cents or, if the provider only supports whole shillings, integer KSh consistently. Every payment callback must be idempotent using the provider reference.

## Main workflows

1. Owner signs up with phone OTP, submits identity and ownership/authority evidence, creates a draft, uploads photos, and chooses a fee package.
2. Moderation checks duplicates, image quality, identity, approximate address, and vacancy evidence. Approved listings become searchable; exact coordinates and contact remain protected.
3. Tenant searches by county/town/estate, distance, property type, price, and amenities. The API returns only approximate location data.
4. Tenant starts an unlock. The server creates a pending payment and initiates an M-Pesa STK Push. Only a verified callback changes the payment to paid and creates the unlock entitlement.
5. The authorised tenant can then retrieve the protected contact and viewing instructions. Access is audited and rate-limited.
6. Owner reconfirms vacancy periodically. Listings automatically pause on expiry, repeated reports, or confirmed occupancy.

## APIs for the MVP

- `POST /auth/otp/request`, `POST /auth/otp/verify`
- `GET /locations`, `GET /listings`, `GET /listings/:id`
- `POST /owner/listings`, `PATCH /owner/listings/:id`, `POST /owner/listings/:id/media`
- `POST /payments/unlocks`, `POST /payments/listing-fees`
- `POST /webhooks/mpesa` (signature/source validation, replay protection, idempotency)
- `GET /me/unlocks`, `GET /me/listings`
- `POST /listings/:id/report`
- Admin endpoints for verification, moderation, refunds, suspension, and audit review

## Security and trust controls

- Phone OTP plus optional passkeys; role-based and object-level authorization on every request.
- Encrypt identity data, exact addresses, coordinates, and contacts; never expose them in public HTML, map tiles, logs, or analytics.
- Virus scan uploads, strip image metadata, create safe derivatives, and run duplicate/image moderation checks.
- Payment callbacks are the source of truth. Never trust the browser success screen.
- Rate-limit OTP, search scraping, unlocks, contact access, uploads, and reports.
- Verification badges must have a defined meaning and expiry date. Run vacancy reconfirmation every 7-14 days.
- Provide reporting, rapid takedown, refund review, device/risk signals, and an immutable admin audit trail.
- Prepare Kenyan privacy notices, consent records, retention/deletion rules, data-subject request handling, and a breach-response plan. Obtain local legal and tax review before launch.

## Delivery plan

Phase 1 (8-12 weeks): responsive web/PWA, phone login, owner onboarding, moderated listings, town/estate search, M-Pesa unlocks and listing fees, notifications, admin console, reports, analytics, and backups.

Phase 2: map/radius search, saved searches and alerts, agent organisations, viewing appointments, ratings after verified interactions, Android wrapper/native app, and stronger automated fraud detection.

Phase 3: rent collection or reservation products, only after legal/compliance review; then percentage-based charging can be attached to money actually processed by the platform.

## Success measures

Track verified active vacancies, search-to-detail rate, detail-to-unlock conversion, successful viewing rate, median time to fill, stale-listing rate, refund rate, fraud reports per 1,000 unlocks, owner repeat rate, and contribution margin per filled vacancy. Do not optimise unlock revenue at the expense of successful, trustworthy viewings.

## Demo notes

Open `index.html` directly. Search, filters, saved-home hearts, detail views, sign-in, owner submission, and payment prompts are interactive simulations. No accounts, data, messages, or real payments are created. The photos and web fonts are loaded from public internet sources, so the page is best viewed while online.
