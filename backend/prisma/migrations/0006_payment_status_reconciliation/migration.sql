ALTER TABLE "payments"
  ADD COLUMN "result_code" INTEGER,
  ADD COLUMN "result_description" TEXT,
  ADD COLUMN "expires_at" TIMESTAMP(3),
  ADD COLUMN "reconciled_at" TIMESTAMP(3);

CREATE INDEX "payments_state_expires_at_idx" ON "payments"("state", "expires_at");
