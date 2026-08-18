import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  ALGORAND_TESTNET,
  type TestnetDeployments,
} from "./encoders.js";

export function loadDeployments(
  path = join(process.cwd(), "config", "deployments.algorand.testnet.json"),
): TestnetDeployments {
  if (!existsSync(path)) {
    throw new Error(
      `Missing deployments file ${path}. Run pnpm protocol:deploy first.`,
    );
  }
  const d = JSON.parse(readFileSync(path, "utf8")) as TestnetDeployments;
  if (d.network !== ALGORAND_TESTNET) {
    throw new Error(
      `deployments.network must be ${ALGORAND_TESTNET}, got ${d.network}`,
    );
  }
  return d;
}
