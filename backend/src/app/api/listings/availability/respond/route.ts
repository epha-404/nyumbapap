import { db } from "@/lib/db";
import { verifyLifecycleAction } from "@/modules/listings/action-tokens";
import { recordTenantAvailabilityResponse } from "@/modules/listings/availability-responses";

function page(title: string, message: string, status = 200) {
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title></head><body style="font-family:Arial,sans-serif;max-width:640px;margin:64px auto;padding:24px;color:#17352f"><h1>${title}</h1><p>${message}</p></body></html>`, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export async function GET(request: Request) {
  const token = verifyLifecycleAction(new URL(request.url).searchParams.get("token") ?? "");
  if (!token || token.kind !== "TENANT_AVAILABILITY") return page("Link unavailable", "This availability link is invalid or has expired.", 400);
  const result = await recordTenantAvailabilityResponse(db, { reportId: token.reportId, response: token.response });
  if (result.status === "NOT_FOUND") return page("Link unavailable", "This availability check could not be found.", 404);
  return page("Thank you", result.duplicate ? "Your response was already recorded. No further action was taken." : "Your availability response has been recorded.");
}
