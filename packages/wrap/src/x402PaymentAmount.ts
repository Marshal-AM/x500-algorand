/**
 * Read the Exact x402 ticket (microUSDC) from protocol headers.
 *
 * Source of truth is the payment the agent sent (`PAYMENT-SIGNATURE` /
 * `accepted.amount`) or the facilitator settle receipt (`PAYMENT-RESPONSE`).
 */

function decodeHeaderObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const candidates = [trimmed];
  try {
    candidates.push(Buffer.from(trimmed, "base64").toString("utf8"));
  } catch {
    /* ignore */
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

function asPositiveMicro(value: unknown): bigint | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "object") return null;
  try {
    const n = BigInt(String(value));
    return n > 0n ? n : null;
  } catch {
    return null;
  }
}

/** Exact ticket amount from an x402 payload or settle receipt. */
export function readX402AmountMicro(
  obj: Record<string, unknown>,
): bigint | null {
  const direct = asPositiveMicro(obj.amount);
  if (direct !== null) return direct;

  const accepted = obj.accepted;
  if (accepted && typeof accepted === "object" && !Array.isArray(accepted)) {
    const nested = asPositiveMicro(
      (accepted as Record<string, unknown>).amount,
    );
    if (nested !== null) return nested;
  }
  return null;
}

function headerGet(
  headers: RequestInit["headers"] | undefined,
  name: string,
): string | null {
  if (!headers) return null;
  return new Headers(headers).get(name);
}

/**
 * microUSDC the agent paid the merchant on this request.
 * Request signature is preferred; response receipt is the backup decode path.
 */
export function parseX402PaymentAmountMicro(
  response: Response | null,
  requestHeaders?: RequestInit["headers"],
): bigint | undefined {
  const requestRaw =
    headerGet(requestHeaders, "payment-signature") ??
    headerGet(requestHeaders, "x-payment");
  if (requestRaw) {
    const obj = decodeHeaderObject(requestRaw);
    const fromRequest = obj ? readX402AmountMicro(obj) : null;
    if (fromRequest !== null) return fromRequest;
  }

  if (!response) return undefined;
  const responseRaw =
    response.headers.get("payment-response") ??
    response.headers.get("x-payment-response");
  if (!responseRaw?.trim()) return undefined;

  const obj = decodeHeaderObject(responseRaw);
  if (!obj) return undefined;
  const fromResponse = readX402AmountMicro(obj);
  return fromResponse !== null ? fromResponse : undefined;
}
