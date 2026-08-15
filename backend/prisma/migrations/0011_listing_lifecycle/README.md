# MongoDB listing lifecycle migration

Prisma's MongoDB connector does not create SQL migrations. After deploying the
schema, run:

```sh
npm run db:generate
npm run db:setup
```

`db:setup` backfills existing listings with `lifecycle_status = ACTIVE`,
`last_confirmed_at = created_at` (or the migration time when legacy data lacks
`created_at`), and `refund_count = 0`. `prisma db push` creates the lifecycle,
availability-report, and unique refund indexes; `setup-mongodb.ts` does not
duplicate them under conflicting names. The backfill is idempotent.
