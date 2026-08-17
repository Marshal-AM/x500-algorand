import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
import { EventsController } from "./events.controller.js";
import { ApiController } from "./api.controller.js";
import { MerchantsController } from "./merchants.controller.js";
import { MerchantRegisterService } from "./merchant-register.service.js";
import { SupabaseService } from "./supabase.service.js";
import { SyncService } from "./sync.service.js";
import { PushSecretGuard } from "./push-secret.guard.js";

@Module({
  controllers: [HealthController, EventsController, ApiController, MerchantsController],
  providers: [SupabaseService, SyncService, PushSecretGuard, MerchantRegisterService],
})
export class AppModule {}
