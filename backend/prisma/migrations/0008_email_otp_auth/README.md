# Email OTP authentication migration

MongoDB deployments do not use Prisma SQL migrations. Deploy this change in this order:

1. Back up the database.
2. Run `npm run db:migrate-email-auth --workspace backend` to backfill the required unique `User.email` field. Encrypted emails are recovered when possible; otherwise the account receives an internal `.invalid` placeholder and `requiresEmailCapture=true`.
3. Run `npm run db:setup --workspace backend` to apply the Prisma schema and indexes, including `otp_codes`.
4. Deploy the backend and frontend together.

Users marked `requiresEmailCapture` are redirected to `/account/verify-email` while their existing session is valid. They must prove control of the new email with a five-minute OTP before dashboard access. A user whose legacy session has already expired requires support-assisted identity recovery; the system never links an email using phone knowledge alone.
