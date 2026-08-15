import { readSessionToken, SESSION_COOKIE } from "./session";
import { cookieValue } from "./request-security";
import { isMobileRequest } from "./request-security";

export function sessionFromRequest(request: Request) {
  if (isMobileRequest(request)) {
    const authorization = request.headers.get("authorization");
    if (authorization?.startsWith("Bearer ")) return readSessionToken(authorization.slice(7).trim());
  }
  return readSessionToken(cookieValue(request, SESSION_COOKIE));
}
