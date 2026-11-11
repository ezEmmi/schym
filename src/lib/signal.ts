/**
 * Signal Messenger Notification Bridge for Schym
 * Supports:
 * 1. Self-hosted `signal-cli-rest-api` (e.g., http://127.0.0.1:8080/v2/send in Docker)
 * 2. CallMeBot Free Signal API (https://api.callmebot.com/signal/send.php)
 */

export interface SignalSendConfig {
  mode: "signal_cli" | "callmebot";
  recipientPhone: string; // e.g. "+491701234567"
  senderPhone?: string; // required for signal_cli
  endpointUrl?: string; // default http://127.0.0.1:8080/v2/send
  apiKey?: string; // required for callmebot
  message: string;
}

export interface SignalSendResult {
  ok: boolean;
  error?: string;
}

/**
 * Validates that a custom Signal CLI URL only targets localhost / private LAN / Docker network
 * to prevent Server-Side Request Forgery (SSRF) to arbitrary external hosts.
 */
export function isAllowedSignalCliEndpoint(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    const h = parsed.hostname.toLowerCase();
    return (
      h === "localhost" ||
      h === "127.0.0.1" ||
      h === "signal-cli" ||
      h.startsWith("192.168.") ||
      h.startsWith("10.") ||
      h.endsWith(".local") ||
      h.endsWith(".ts.net")
    );
  } catch {
    return false;
  }
}

export async function dispatchSignalMessage(
  cfg: SignalSendConfig
): Promise<SignalSendResult> {
  if (cfg.mode === "callmebot") {
    if (!cfg.apiKey || cfg.apiKey.trim().length < 3) {
      return {
        ok: false,
        error: "CallMeBot API-Key fehlt.",
      };
    }
    const url = new URL("https://api.callmebot.com/signal/send.php");
    url.searchParams.set("phone", cfg.recipientPhone.trim());
    url.searchParams.set("apikey", cfg.apiKey.trim());
    url.searchParams.set("text", cfg.message);

    const res = await fetch(url.toString(), { method: "GET" });
    if (!res.ok) {
      return {
        ok: false,
        error: `CallMeBot Signal API antwortete mit HTTP ${res.status}.`,
      };
    }
    return { ok: true };
  }

  // Mode: self-hosted signal-cli-rest-api
  const targetEndpoint =
    cfg.endpointUrl?.trim() ||
    process.env.SIGNAL_CLI_URL ||
    "http://127.0.0.1:8080/v2/send";

  if (!isAllowedSignalCliEndpoint(targetEndpoint)) {
    return {
      ok: false,
      error:
        "Aus Sicherheitsgründen (SSRF-Schutz) sind für signal-cli nur lokale/Heimnetz/Tailscale-URLs erlaubt.",
    };
  }

  const sender =
    cfg.senderPhone?.trim() ||
    process.env.SIGNAL_SENDER_NUMBER ||
    cfg.recipientPhone.trim();

  const res = await fetch(targetEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: cfg.message,
      number: sender,
      recipients: [cfg.recipientPhone.trim()],
    }),
  });

  if (!res.ok) {
    return {
      ok: false,
      error: `Signal-CLI Server (${targetEndpoint}) antwortete mit HTTP ${res.status}. Läuft der Docker-Container?`,
    };
  }

  return { ok: true };
}
