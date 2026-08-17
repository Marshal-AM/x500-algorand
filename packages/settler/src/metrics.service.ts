import { Injectable } from "@nestjs/common";

@Injectable()
export class MetricsService {
  jobsDone = 0;
  jobsFailed = 0;
  settleErrors = 0;
  indexerPushErrors = 0;
  lastError: string | null = null;

  snapshot() {
    return {
      jobs_done: this.jobsDone,
      jobs_failed: this.jobsFailed,
      settle_errors: this.settleErrors,
      indexer_push_errors: this.indexerPushErrors,
      last_error: this.lastError,
    };
  }
}
