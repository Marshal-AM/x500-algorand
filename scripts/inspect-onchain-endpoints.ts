/**
 * Dump on-chain registry endpoints (indexer does not write these).
 */
import { AlgorandAdapter } from "@x500/shared";

async function main(): Promise<void> {
  const adapter = new AlgorandAdapter({
    deploymentsPath: process.env.X500_DEPLOYMENTS_PATH?.trim(),
  });
  const eps = await adapter.readEndpointConfigs();
  console.log(`on-chain endpoints via slugCount: ${eps.length}`);
  for (const ep of eps) {
    console.log(
      JSON.stringify(
        {
          slug: ep.slug,
          hostname: ep.hostname,
          slaLatencyMs: ep.slaLatencyMs,
          flatPremiumMicroAlgos: ep.flatPremiumMicroAlgos.toString(),
          imputedCostMicroAlgos: ep.imputedCostMicroAlgos.toString(),
          apiPriceMicroUsdc: ep.apiPriceMicroUsdc.toString(),
          paused: ep.paused,
          contactAddress: ep.contactAddress,
          ownerAddress: ep.ownerAddress,
        },
        null,
        2,
      ),
    );
  }

  for (const slug of ["pay-default", "weather-slow"]) {
    const ep = await adapter.getEndpoint(slug);
    console.log(
      `getEndpoint(${slug})`,
      ep
        ? {
            hostname: ep.hostname,
            slaLatencyMs: ep.slaLatencyMs,
            imputed: ep.imputedCostMicroAlgos.toString(),
            premium: ep.flatPremiumMicroAlgos.toString(),
            apiPrice: ep.apiPriceMicroUsdc.toString(),
          }
        : null,
    );
  }
}

main().catch((err) => {
  console.error("[inspect-onchain-endpoints]", err);
  process.exit(1);
});
