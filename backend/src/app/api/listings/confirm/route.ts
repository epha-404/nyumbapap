import { db } from "@/lib/db";
import { verifyLifecycleAction } from "@/modules/listings/action-tokens";
import { confirmLandlordAvailability } from "@/modules/listings/availability-responses";

function page(title: string, message: string, status = 200) {
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title></head><body style="font-family:Arial,sans-serif;max-width:640px;margin:64px auto;padding:24px;color:#17352f"><h1>${title}</h1><p>${message}</p></body></html>`, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export async function GET(request: Request) {
  const token = verifyLifecycleAction(new URL(request.url).searchParams.get("token") ?? "");
  if (!token || token.kind !== "LANDLORD_CONFIRMATION") return page("Link unavailable", "This confirmation link is invalid or has expired.", 400);
  const result = await confirmLandlordAvailability(db, { listingId: token.listingId, pendingSince: token.pendingSince });
  if (result.status === "NOT_FOUND") return page("Listing not found", "This listing could not be found.", 404);
  if (result.status === "INVALID") return page("Link unavailable", "This confirmation link no longer applies to the listing.", 409);
  return page("Listing confirmed", result.duplicate ? "This listing was already confirmed as available." : "Your listing is active and will remain visible in search.");
}
