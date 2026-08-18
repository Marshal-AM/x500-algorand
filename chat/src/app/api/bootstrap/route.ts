import { NextResponse } from "next/server";
import {
  type ChatTestMode,
  MERCHANT_ORIGINS,
  merchantOriginFor,
} from "@/lib/agent/constants";
import { getBootstrapLogs } from "@/lib/agent/run-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parseMode(value: string | null): ChatTestMode | null {
  if (value === "success" || value === "sla_breach") return value;
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = parseMode(searchParams.get("mode"));

  if (!mode || !MERCHANT_ORIGINS[mode]) {
    return NextResponse.json(
      { error: "Invalid mode. Use success or sla_breach." },
      { status: 400 },
    );
  }

  try {
    const logs = await getBootstrapLogs(mode);
    return NextResponse.json({ logs, merchantOrigin: merchantOriginFor(mode) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
