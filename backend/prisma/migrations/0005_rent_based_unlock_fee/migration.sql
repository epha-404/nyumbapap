CREATE TABLE "unlock_fee_config" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "rate" DECIMAL(8,6) NOT NULL,
  "floor_kes" INTEGER NOT NULL,
  "ceiling_kes" INTEGER NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "unlock_fee_config_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "unlock_fee_config_singleton" CHECK ("id" = 'default'),
  CONSTRAINT "unlock_fee_config_rate_positive" CHECK ("rate" > 0),
  CONSTRAINT "unlock_fee_config_floor_positive" CHECK ("floor_kes" > 0),
  CONSTRAINT "unlock_fee_config_bounds_valid" CHECK ("ceiling_kes" >= "floor_kes")
);

INSERT INTO "unlock_fee_config" ("id", "rate", "floor_kes", "ceiling_kes")
VALUES ('default', 0.025, 100, 800);
