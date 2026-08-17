import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
import { MetricsService } from "./metrics.service.js";
import { SupabaseService } from "./supabase.service.js";
import { WorkerService } from "./worker.service.js";

@Module({
  controllers: [HealthController],
  providers: [SupabaseService, MetricsService, WorkerService],
})
export class AppModule {}
