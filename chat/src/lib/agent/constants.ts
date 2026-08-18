export type ChatTestMode = "success" | "sla_breach";

export const MERCHANT_ORIGINS: Record<ChatTestMode, string> = {
  success: "http://127.0.0.1:8800",
  sla_breach: "http://127.0.0.1:8801",
};

export function merchantOriginFor(mode: ChatTestMode): string {
  const fromEnv =
    mode === "success"
      ? process.env.X500_MERCHANT_ORIGIN?.trim() ||
        process.env.NEXT_PUBLIC_X500_MERCHANT_ORIGIN?.trim()
      : process.env.X500_SLOW_MERCHANT_ORIGIN?.trim() ||
        process.env.NEXT_PUBLIC_X500_SLOW_MERCHANT_ORIGIN?.trim();
  return fromEnv || MERCHANT_ORIGINS[mode];
}

export const CHAT_MODE_LABELS: Record<ChatTestMode, string> = {
  success: "Test successful response",
  sla_breach: "Test SLA breach",
};

export const GROQ_MODEL = "openai/gpt-oss-120b";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};
