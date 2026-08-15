# Listing creation idempotency

MongoDB deployments must run `npm run db:setup --workspace backend` after deploying this schema change. The setup script creates a partial unique compound index on `listings.creation_owner_id` and `listings.idempotency_key`; legacy listings without these fields remain valid.
