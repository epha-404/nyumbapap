import { z } from "zod";

const serverEnvSchema = z.object({
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  OTP_HMAC_SECRET: z.string().min(32),
  FIELD_ENCRYPTION_KEY_BASE64: z.string().min(43),
  IMAGE_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(12_582_912),
  IMAGE_MAX_INPUT_PIXELS: z.coerce.number().int().positive().default(40_000_000),
  IMAGE_MAX_DIMENSION: z.coerce.number().int().min(320).max(4096).default(1920),
  IMAGE_WEBP_QUALITY: z.coerce.number().int().min(1).max(100).default(78),
  IMAGE_AVIF_QUALITY: z.coerce.number().int().min(1).max(100).default(55),
  LISTING_PUBLICATION_FEE_KES: z.coerce.number().int().nonnegative().default(500),
  MPESA_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  MPESA_CONSUMER_KEY: z.string().min(1),
  MPESA_CONSUMER_SECRET: z.string().min(1),
  MPESA_SHORTCODE: z.string().regex(/^\d{5,10}$/),
  MPESA_PASSKEY: z.string().min(1),
  MPESA_CALLBACK_URL: z.string().url().refine((value) => value.startsWith("https://"), "M-Pesa callback URL must use HTTPS"),
  MPESA_BASE_URL_SANDBOX: z.string().url().default("https://sandbox.safaricom.co.ke"),
  MPESA_BASE_URL_PRODUCTION: z.string().url().default("https://api.safaricom.co.ke"),
  LIFECYCLE_JOB_SECRET: z.string().min(32).optional()
  ,NES_API_URL: z.string().url().default("https://nes.nisoko.co.ke")
  ,NES_API_KEY: z.string().startsWith("nsk_live_").optional()
  ,NES_SECURITY_FROM: z.string().email().default("security@odafood.com")
  ,NES_SUPPORT_FROM: z.string().email().default("support@odafood.com")
  ,NES_BILLING_FROM: z.string().email().default("billing@odafood.com")
  ,NES_WEBHOOK_SECRET: z.string().min(24).optional()
  ,NISOKO_STORAGE_API_URL: z.string().url().default("https://storage.nisoko.co.ke")
  ,NISOKO_STORAGE_API_KEY: z.string().startsWith("nsk_live_").optional()
  ,NISOKO_STORAGE_CONTAINER: z.string().min(3).default("nyumba-pap-assets")
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export const parseServerEnv = (input: NodeJS.ProcessEnv): ServerEnv => serverEnvSchema.parse(input);
