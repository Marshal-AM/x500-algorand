import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Inject,
  Post,
} from "@nestjs/common";
import {
  MerchantRegisterService,
  type RegisterMerchantInput,
} from "./merchant-register.service.js";

interface RegisterMerchantBody {
  slug: string;
  hostname: string;
  transactionId?: string;
  slaMs?: number;
}

@Controller("api/merchants")
export class MerchantsController {
  constructor(
    @Inject(MerchantRegisterService)
    private readonly register: MerchantRegisterService,
  ) {}

  @Post("register")
  async registerMerchant(@Body() body: RegisterMerchantBody) {
    if (!body?.slug?.trim() || !body?.hostname?.trim()) {
      throw new HttpException(
        { ok: false, error: "slug and hostname are required" },
        HttpStatus.BAD_REQUEST,
      );
    }

    const input: RegisterMerchantInput = {
      slug: body.slug,
      hostname: body.hostname,
      transactionId: body.transactionId,
      slaMs: body.slaMs,
    };

    try {
      const result = await this.register.syncAfterWalletRegistration(input);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.includes("slug") ||
            message.includes("hostname") ||
            message.includes("not visible")
          ? HttpStatus.BAD_REQUEST
          : HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException({ ok: false, error: message }, status);
    }
  }
}
