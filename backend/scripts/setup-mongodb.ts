import { MongoClient } from "mongodb";
import { config } from "dotenv";

config();

const url = process.env.DATABASE_URL;
if (!url?.startsWith("mongodb")) throw new Error("DATABASE_URL must point to MongoDB");

const sparseUnique = [
  ["users", "phone_hash"], ["users", "email_hash"],
  ["landlord_profiles", "identity_number_hash"], ["agent_profiles", "licence_hash"],
  ["payments", "merchant_request_id"], ["payments", "checkout_request_id"],
  ["payments", "provider_receipt"], ["payments", "callback_hash"]
] as const;

async function main() {
  const client = new MongoClient(url!);
  await client.connect();
  const database = client.db(new URL(url!).pathname.slice(1).split("?")[0] || "nyumbapap");
  try {
    for (const [collection, field] of sparseUnique) {
      await database.collection(collection).createIndex({ [field]: 1 }, { unique: true, partialFilterExpression: { [field]: { $type: "string" } }, name: `${collection}_${field}_partial_unique` });
    }
    await database.collection("properties").createIndex({ search_point: "2dsphere" }, { sparse: true, name: "properties_search_point_2dsphere" });
    await database.collection("listings").createIndex(
      { creation_owner_id: 1, idempotency_key: 1 },
      { unique: true, partialFilterExpression: { creation_owner_id: { $type: "string" }, idempotency_key: { $type: "string" } }, name: "listings_owner_idempotency_partial_unique" }
    );
    await database.collection("listings").updateMany(
      { lifecycle_status: { $exists: false } },
      [{ $set: {
        lifecycle_status: "ACTIVE",
        last_confirmed_at: { $ifNull: ["$created_at", "$$NOW"] },
        refund_count: 0
      } }]
    );
    console.log("MongoDB sparse uniqueness and geospatial indexes are ready");
  } finally { await client.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
