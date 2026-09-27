import { demoMode } from "@/lib/identity";
import { jsonError } from "@/lib/http";

export function demoOnly() {
  return demoMode() ? null : jsonError("Demo mode is off", 404);
}
