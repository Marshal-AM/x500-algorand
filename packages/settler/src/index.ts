export const PACKAGE_NAME = "@x500/settler" as const;

export {
  Batcher,
  MAX_BATCH_SIZE,
  BATCH_FLUSH_MS,
  type BatchedJob,
  type FlushHandler,
} from "./batcher.js";
export {
  mapOutcomeToSettle,
  isCoveredBreachOutcome,
} from "./outcome-map.js";
export { InMemoryLeaseStore } from "./lease-memory.js";
