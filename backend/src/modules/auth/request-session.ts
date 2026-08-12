import { readSessionToken, SESSION_COOKIE } from "./session";
import { cookieValue } from "./request-security";

export function sessionFromRequest(request: Request) {
  return readSessionToken(cookieValue(request, SESSION_COOKIE));
}
