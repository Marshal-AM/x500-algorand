import { indexerBase } from "@/lib/indexer";

const RESERVED_SLUGS = new Set(["pay-default"]);
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,14}[a-z0-9])?$/;

export type RegistrationMode = "register" | "update";

export interface IndexedEndpoint {
  slug: string;
  hostname: string;
  contact_address: string | null;
  owner_address: string | null;
  api_price_micro_usdc?: number;
  sla_ms?: number;
}

export interface SlugPreflight {
  normalizedSlug: string;
  mode: RegistrationMode;
  canProceed: boolean;
  status: "available" | "owned_by_you" | "taken" | "invalid" | "reserved";
  message: string;
  endpoint?: IndexedEndpoint;
}

export function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

export function validateSlugFormat(slug: string): string | null {
  const normalized = normalizeSlug(slug);
  if (!normalized) return "Enter an API slug.";
  if (!SLUG_RE.test(normalized)) {
    return "Use 1–16 lowercase letters, numbers, or hyphens.";
  }
  if (RESERVED_SLUGS.has(normalized)) {
    return `"${normalized}" is reserved. Choose another slug.`;
  }
  return null;
}

export function validateHostname(hostname: string): { value: string; error: string | null } {
  const trimmed = hostname.trim();
  if (!trimmed) {
    return { value: "", error: "Enter your API origin URL." };
  }
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return { value: trimmed, error: "URL must start with http:// or https://." };
  }
  try {
    const url = new URL(trimmed);
    const normalized = `${url.protocol}//${url.host}`.replace(/\/$/, "");
    return { value: normalized, error: null };
  } catch {
    return { value: trimmed, error: "Enter a valid origin URL." };
  }
}

/** Matches on-chain address validation (58-char Algorand address). */
export function validateContactAddress(address: string): string | null {
  const trimmed = address.trim();
  if (!/^[A-Z2-7]{58}$/.test(trimmed)) {
    return "Enter a valid Algorand address (58 characters).";
  }
  return null;
}

export function parseUsdcToMicroUsdc(input: string): string {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error("Enter a valid USDC amount (up to 6 decimals)");
  }
  const [whole = "0", frac = ""] = trimmed.split(".");
  const fracPadded = (frac + "000000").slice(0, 6);
  const microUsdc = BigInt(whole) * 1_000_000n + BigInt(fracPadded);
  if (microUsdc < 1n) {
    throw new Error("API price must be greater than 0");
  }
  return microUsdc.toString();
}

async function fetchEndpointBySlug(
  slug: string,
): Promise<IndexedEndpoint | null> {
  const res = await fetch(`${indexerBase()}/api/endpoints/${encodeURIComponent(slug)}`);
  if (!res.ok) return null;
  const body = (await res.json()) as {
    endpoint?: IndexedEndpoint | null;
    error?: string;
  };
  return body.endpoint ?? null;
}

function addressesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  return a.toUpperCase() === b.toUpperCase();
}

export async function preflightSlug(
  slug: string,
  walletAddress?: string | null,
): Promise<SlugPreflight> {
  const formatError = validateSlugFormat(slug);
  const normalizedSlug = normalizeSlug(slug);

  if (formatError) {
    return {
      normalizedSlug,
      mode: "register",
      canProceed: false,
      status: RESERVED_SLUGS.has(normalizedSlug) ? "reserved" : "invalid",
      message: formatError,
    };
  }

  const endpoint = await fetchEndpointBySlug(normalizedSlug);
  if (!endpoint) {
    return {
      normalizedSlug,
      mode: "register",
      canProceed: true,
      status: "available",
      message: `"${normalizedSlug}" is available.`,
    };
  }

  if (!walletAddress) {
    return {
      normalizedSlug,
      mode: "update",
      canProceed: false,
      status: "taken",
      message: `"${normalizedSlug}" is taken. Connect your wallet to check ownership.`,
      endpoint,
    };
  }

  const ownerAddress = endpoint.owner_address?.trim() ?? null;

  if (ownerAddress && addressesMatch(walletAddress, ownerAddress)) {
    return {
      normalizedSlug,
      mode: "update",
      canProceed: true,
      status: "owned_by_you",
      message: `You own "${normalizedSlug}". We'll update your existing listing.`,
      endpoint,
    };
  }

  return {
    normalizedSlug,
    mode: "update",
    canProceed: false,
    status: "taken",
    message: `"${normalizedSlug}" belongs to another account. Pick a different slug.`,
    endpoint,
  };
}

export interface SubmitPreflight {
  ok: boolean;
  error?: string;
  mode?: RegistrationMode;
  normalizedSlug?: string;
  normalizedHost?: string;
  apiPriceMicroUsdc?: string;
  slaMs?: number;
  contactAddress?: string;
}

export async function preflightSubmit(opts: {
  slug: string;
  hostname: string;
  apiPriceUsdc: string;
  slaSeconds: string;
  contactAddress: string;
  walletAddress: string;
}): Promise<SubmitPreflight> {
  const slugCheck = await preflightSlug(opts.slug, opts.walletAddress);
  if (!slugCheck.canProceed) {
    return { ok: false, error: slugCheck.message };
  }

  const host = validateHostname(opts.hostname);
  if (host.error) {
    return { ok: false, error: host.error };
  }

  const contactError = validateContactAddress(opts.contactAddress);
  if (contactError) {
    return { ok: false, error: contactError };
  }

  const slaMs = Math.max(1, Math.floor(Number(opts.slaSeconds) * 1000));
  if (!Number.isFinite(slaMs)) {
    return { ok: false, error: "Enter a valid SLA in seconds." };
  }

  let apiPriceMicroUsdc: string;
  try {
    apiPriceMicroUsdc = parseUsdcToMicroUsdc(opts.apiPriceUsdc);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return {
    ok: true,
    mode: slugCheck.mode,
    normalizedSlug: slugCheck.normalizedSlug,
    normalizedHost: host.value,
    apiPriceMicroUsdc,
    slaMs,
    contactAddress: opts.contactAddress.trim(),
  };
}
