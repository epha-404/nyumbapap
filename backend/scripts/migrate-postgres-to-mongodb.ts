import { createHash } from "node:crypto";
import { Client as PostgresClient } from "pg";
import { MongoClient } from "mongodb";
import { config } from "dotenv";

config();

const sourceUrl = process.env.POSTGRES_MIGRATION_URL;
const targetUrl = process.env.MONGODB_MIGRATION_URL ?? process.env.DATABASE_URL;
if (!sourceUrl?.startsWith("postgres")) throw new Error("POSTGRES_MIGRATION_URL must point to PostgreSQL");
if (!targetUrl?.startsWith("mongodb")) throw new Error("MONGODB_MIGRATION_URL must point to MongoDB");

const tables = [
  "users", "landlord_profiles", "agent_profiles", "properties", "rental_units", "listings",
  "listing_daily_views", "listing_media", "payments", "unlock_fee_config", "tenant_unlocks",
  "enquiries", "viewing_requests", "reports", "verification_records", "audit_events",
  "notification_outbox", "app_accounts", "auth_otp_challenges", "auth_rate_limits"
];

function document(table: string, row: Record<string, unknown>) {
  const value = { ...row } as Record<string, unknown>;
  if (value.id != null) { value._id = String(value.id); delete value.id; }
  if (table === "auth_rate_limits" && !value._id) value._id = createHash("sha256").update(`${value.action}:${value.key_hash}`).digest("hex");
  if (table === "properties") {
    const longitude = value.approximate_longitude == null ? null : Number(value.approximate_longitude);
    const latitude = value.approximate_latitude == null ? null : Number(value.approximate_latitude);
    value.approximate_longitude = longitude;
    value.approximate_latitude = latitude;
    value.search_point = longitude == null || latitude == null ? null : { type: "Point", coordinates: [longitude, latitude] };
  }
  if (table === "unlock_fee_config") value.rate = Number(value.rate);
  return value;
}

async function main() {
  const pg = new PostgresClient({ connectionString: sourceUrl });
  const mongo = new MongoClient(targetUrl!);
  await pg.connect();
  await mongo.connect();
  const dbName = new URL(targetUrl!).pathname.slice(1).split("?")[0] || "nyumbapap";
  const target = mongo.db(dbName);
  try {
    for (const table of tables) {
      const exists = await pg.query("select to_regclass($1) is not null as exists", [`public.${table}`]);
      if (!exists.rows[0]?.exists) continue;
      const rows = (await pg.query(`select * from \"${table}\"`)).rows.map(row => document(table, row));
      const collection = target.collection(table);
      await collection.deleteMany({});
      if (rows.length) await collection.insertMany(rows, { ordered: true });
      console.log(`${table}: ${rows.length}`);
    }
    await target.collection("properties").createIndex({ search_point: "2dsphere" }, { sparse: true, name: "properties_search_point_2dsphere" });
    await target.collection("audit_events").createIndex({ entity_type: 1, entity_id: 1, created_at: 1 });
    console.log("Migration complete");
  } finally {
    await Promise.all([pg.end(), mongo.close()]);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
