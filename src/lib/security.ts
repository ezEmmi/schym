import { NextRequest } from "next/server";

export interface SecurityCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Verifies Same-Origin (CSRF protection) and optional PIN guard (`SCHYM_ACCESS_PIN`)
 * so that no external website or unauthorized LAN client can mutate or exfiltrate local data.
 */
export function verifyRequestSecurity(
  request: NextRequest
): SecurityCheckResult {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return {
          allowed: false,
          reason: "Cross-Origin Request blocked by Same-Origin Security Guard.",
        };
      }
    } catch {
      return {
        allowed: false,
        reason: "Malformed Origin header blocked.",
      };
    }
  }

  const requiredPin = process.env.SCHYM_ACCESS_PIN;
  if (requiredPin && requiredPin.trim().length > 0) {
    const providedPin = request.headers.get("x-schym-pin") ?? "";
    if (providedPin !== requiredPin.trim()) {
      return {
        allowed: false,
        reason: "Ungültige oder fehlende Schym Access-PIN.",
      };
    }
  }

  return { allowed: true };
}
