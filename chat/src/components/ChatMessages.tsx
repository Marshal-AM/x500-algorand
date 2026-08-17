"use client";

import { useEffect, useRef } from "react";
import { Bot, User } from "lucide-react";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/agent/constants";

export function ChatMessages({
  messages,
  pending,
  className,
}: {
  messages: ChatMessage[];
  pending?: boolean;
  className?: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  return (
    <div
      ref={viewportRef}
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1",
        className,
      )}
    >
      <div className="flex min-h-full flex-col gap-4">
        {messages.length === 0 && !pending ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-12 text-center">
            <div className="grid size-12 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
              <Bot className="size-5" />
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              Ask for weather in any city. The agent calls the insured merchant API
              through x500 and logs payment details below.
            </p>
            <p className="text-xs text-muted-foreground">
              Try: &quot;What&apos;s the weather in London?&quot;
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <MessageBubble key={idx} message={msg} />
            ))}
            {pending ? (
              <MessageBubble
                message={{ role: "assistant", content: "…" }}
                pending
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  pending,
}: {
  message: ChatMessage;
  pending?: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      <div
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-xl border",
          isUser
            ? "border-primary/30 bg-primary/15 text-primary"
            : "border-border bg-muted/40 text-muted-foreground",
        )}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl border px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "border-primary/25 bg-primary/10 text-foreground"
            : "border-border bg-muted/20 text-foreground",
          pending && "animate-pulse text-muted-foreground",
        )}
      >
        {isUser || pending ? (
          message.content
        ) : (
          <MarkdownMessage content={message.content} />
        )}
      </div>
    </div>
  );
}
