"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Send } from "lucide-react";
import { AgentLogPanel } from "@/components/AgentLogPanel";
import { ChatMessages } from "@/components/ChatMessages";
import { Logo } from "@/components/layout/Logo";
import { TestModeSelect } from "@/components/TestModeSelect";
import { Button } from "@/components/ui/Button";
import { PageHeader, Surface } from "@/components/ui/Surface";
import {
  type ChatMessage,
  type ChatTestMode,
  MERCHANT_ORIGINS,
} from "@/lib/agent/constants";

export function ChatApp() {
  const [mode, setMode] = useState<ChatTestMode>("success");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [merchantOrigin, setMerchantOrigin] = useState(
    MERCHANT_ORIGINS.success,
  );

  const loadBootstrap = useCallback(async (nextMode: ChatTestMode, signal?: AbortSignal) => {
    setBootstrapping(true);
    setError(null);
    try {
      const res = await fetch(`/api/bootstrap?mode=${nextMode}`, { signal });
      const data = (await res.json()) as {
        logs?: string[];
        merchantOrigin?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load agent");
      }
      if (signal?.aborted) return;
      setLogs(data.logs ?? []);
      setMerchantOrigin(
        data.merchantOrigin?.trim() || MERCHANT_ORIGINS[nextMode],
      );
    } catch (err) {
      if (signal?.aborted) return;
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setLogs([]);
    } finally {
      if (!signal?.aborted) setBootstrapping(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadBootstrap(mode, controller.signal);
    return () => controller.abort();
  }, [mode, loadBootstrap]);

  const handleModeChange = (nextMode: ChatTestMode) => {
    if (nextMode === mode || loading) return;
    setMode(nextMode);
    setMessages([]);
    setInput("");
    setError(null);
    setMerchantOrigin(MERCHANT_ORIGINS[nextMode]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading || bootstrapping) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          message: trimmed,
          history: messages,
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        logs?: string[];
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error ?? "Chat request failed");
      }

      setMessages([
        ...nextMessages,
        { role: "assistant", content: data.reply ?? "" },
      ]);
      if (data.logs?.length) {
        setLogs((prev) => [...prev, ...data.logs!]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setMessages([
        ...nextMessages,
        { role: "assistant", content: `Sorry, something went wrong: ${msg}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="mb-4 flex shrink-0 items-center justify-between gap-4">
        <Logo />
        <TestModeSelect
          value={mode}
          onChange={handleModeChange}
          disabled={loading || bootstrapping}
        />
      </header>

      <PageHeader
        title="Insured agent chat"
        description={
          <>
            ReAct agent with Groq calling the x500-insured Algorand weather
            API (x402 USDC + insurance). Mode selects merchant:{" "}
            <span className="font-mono text-xs text-primary">
              {merchantOrigin}
            </span>
          </>
        }
      />

      {error ? (
        <div
          role="alert"
          className="mb-4 shrink-0 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-rows-2 gap-6 overflow-hidden lg:grid-cols-2 lg:grid-rows-1">
        <Surface
          title="Chat"
          className="flex h-full min-h-0 flex-col overflow-hidden"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            <ChatMessages messages={messages} pending={loading} />
            <form onSubmit={handleSubmit} className="flex shrink-0 gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  bootstrapping
                    ? "Loading agent…"
                    : "Ask for weather in a city…"
                }
                disabled={loading || bootstrapping}
                className="h-10 min-w-0 flex-1 rounded-2xl border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none disabled:opacity-50"
              />
              <Button
                type="submit"
                size="lg"
                disabled={loading || bootstrapping || !input.trim()}
                aria-label="Send message"
              >
                <Send className="size-4" />
                Send
              </Button>
            </form>
          </div>
        </Surface>

        <Surface
          title="Agent logs"
          emphasis
          className="flex h-full min-h-0 flex-col overflow-hidden"
        >
          {bootstrapping ? (
            <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
              Connecting to Algorand and resolving merchant…
            </div>
          ) : (
            <AgentLogPanel logs={logs} />
          )}
        </Surface>
      </div>
    </div>
  );
}
