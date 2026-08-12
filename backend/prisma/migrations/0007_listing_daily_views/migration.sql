CREATE TABLE "listing_daily_views" (
  "id" TEXT NOT NULL,
  "listing_id" TEXT NOT NULL,
  "viewer_key_hash" TEXT NOT NULL,
  "view_date" DATE NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "listing_daily_views_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "listing_daily_views_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "listing_daily_views_listing_id_viewer_key_hash_view_date_key"
  ON "listing_daily_views"("listing_id", "viewer_key_hash", "view_date");
CREATE INDEX "listing_daily_views_listing_id_view_date_idx"
  ON "listing_daily_views"("listing_id", "view_date");
