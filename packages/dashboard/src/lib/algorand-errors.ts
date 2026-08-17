export function humanizeAlgorandError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);

  if (msg.includes("EndpointAlreadyRegistered")) {
    return "This slug is already registered. Reuse it to update your listing.";
  }
  if (msg.includes("UnauthorizedOwner")) {
    return "Your wallet does not own this endpoint.";
  }
  if (msg.includes("InvalidContactAddress") || msg.includes("InvalidContactAccount")) {
    return "Payment address is not valid for the registry.";
  }
  if (msg.includes("InvalidHostname")) {
    return "Origin URL is not valid for the registry.";
  }
  if (msg.includes("PremiumTooSmall")) {
    return "API price is below the minimum allowed.";
  }
  if (msg.includes("InvalidSlug")) {
    return "Slug format is not accepted on-chain.";
  }
  if (msg.includes("rejected") || msg.includes("revert")) {
    return "The transaction was rejected by the registry application.";
  }
  if (msg.includes("USER_REJECT") || msg.includes("cancelled")) {
    return "Transaction was cancelled in your wallet.";
  }

  return msg;
}
