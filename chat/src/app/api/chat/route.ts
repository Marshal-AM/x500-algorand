import { NextResponse } from "next/server";
import {
  type ChatMessage,
  type ChatTestMode,
  MERCHANT_ORIGINS,
} from "@/lib/agent/constants";
import { runChatAgent } from "@/lib/agent/run-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

function parseMode(value: unknown): ChatTestMode | null {
  if (value === "success" || value === "sla_breach") return value;
  return null;
}

function parseHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (m): m is ChatMessage =>
        m != null &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    )
    .map((m) => ({ role: m.role, content: m.content }));
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const mode = parseMode(record.mode);
  const message = typeof record.message === "string" ? record.message.trim() : "";
  const history = parseHistory(record.history);

  if (!mode || !MERCHANT_ORIGINS[mode]) {
    return NextResponse.json(
      { error: "Invalid mode. Use success or sla_breach." },
      { status: 400 },
    );
  }

  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  try {
    const { reply, logs } = await runChatAgent({ mode, message, history });
    return NextResponse.json({ reply, logs });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
