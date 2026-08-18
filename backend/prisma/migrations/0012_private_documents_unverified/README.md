# Private documents and landlord opt-out

Prisma's MongoDB connector has no SQL migration file. Deploy the updated
schema with `npm run db:setup --workspace backend` after configuring:

```env
NISOKO_PRIVATE_DOCUMENTS_CONTAINER=nyumba-pap-private-docs
```

The container was provisioned explicitly with Nisoko's `private` policy.
Existing verification records require no key migration because the prior
private S3/R2 location was confirmed empty before this cutover. New encrypted
document references contain the Nisoko container and opaque object identity.

The `UNVERIFIED` enum value is additive; existing verification states are not
rewritten.
