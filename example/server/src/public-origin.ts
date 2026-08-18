import ngrok from "@ngrok/ngrok";

/**
 * Public origin used for indexer registration polling.
 * Falls back to http://127.0.0.1:{port} when ngrok is not configured.
 */
export async function resolvePublicOrigin(port: number): Promise<string> {
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  const railwayOrigin = railwayDomain
    ? `https://${railwayDomain.replace(/^https?:\/\//, "")}`
    : "";
  const explicit =
    process.env.EXAMPLE_PUBLIC_ORIGIN?.trim() || railwayOrigin;
  if (explicit) {
    const origin = explicit.replace(/\/$/, "");
    console.log(`[example-server] public origin: ${origin}`);
    return origin;
  }

  const token = process.env.NGROK_AUTHTOKEN?.trim();
  const useLocal =
    process.env.EXAMPLE_LOCAL === "1" ||
    process.env.EXAMPLE_LOCAL === "true" ||
    !token;

  if (useLocal) {
    const origin = `http://127.0.0.1:${port}`;
    console.log(
      `[example-server] local mode — public origin: ${origin} (register this in dashboard or run pnpm example:setup)`,
    );
    return origin;
  }

  const listener = await ngrok.forward({ addr: port, authtoken: token });
  const publicUrl = listener.url()!.replace(/\/$/, "");
  console.log(`[ngrok] public url: ${publicUrl}`);
  return publicUrl;
}
