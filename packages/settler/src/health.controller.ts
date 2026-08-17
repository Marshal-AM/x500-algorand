import { Controller, Get, Inject } from "@nestjs/common";
import algosdk from "algosdk";
import { AlgorandAdapter } from "@x500/shared";
import { MetricsService } from "./metrics.service.js";

@Controller()
export class HealthController {
  constructor(@Inject(MetricsService) private readonly metrics: MetricsService) {}

  @Get("health")
  async health() {
    const mnemonic = process.env.ALGORAND_SETTLER_MNEMONIC?.trim();
    const minMicro = BigInt(
      process.env.SETTLER_MIN_ALGO_MICRO?.replace(/_/g, "") ?? "500000",
    );

    let balanceMicroAlgos: string | null = null;
    let lowWatermark = false;
    let settlerAddress: string | null = null;

    if (mnemonic) {
      const account = algosdk.mnemonicToSecretKey(mnemonic);
      settlerAddress = account.addr.toString();
      const adapter = new AlgorandAdapter({
        deploymentsPath: process.env.X500_DEPLOYMENTS_PATH?.trim(),
      });
      const bal = await adapter.getNativeAlgoBalance(settlerAddress);
      balanceMicroAlgos = bal.toString();
      lowWatermark = bal < minMicro;
    }

    return {
      ok: true,
      service: "settler",
      network: process.env.ALGORAND_NETWORK ?? "algorand:testnet",
      settlerAddress,
      balanceMicroAlgos,
      minMicroAlgos: minMicro.toString(),
      lowWatermark,
      metrics: this.metrics.snapshot(),
    };
  }

  @Get("metrics")
  metricsGet() {
    return this.metrics.snapshot();
  }
}
