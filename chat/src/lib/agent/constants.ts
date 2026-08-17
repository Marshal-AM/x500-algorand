export type ChatTestMode = "success" | "sla_breach";

export const MERCHANT_ORIGINS: Record<ChatTestMode, string> = {
  success: "https://exampleserver-5341291432.us-central1.run.app",
  sla_breach: "https://exampleslowserver-5341291432.us-central1.run.app",
};

export const CHAT_MODE_LABELS: Record<ChatTestMode, string> = {
  success: "Test successful response",
  sla_breach: "Test SLA breach",
};

export const GROQ_MODEL = "openai/gpt-oss-120b";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};
