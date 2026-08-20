"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatResponse } from "@/app/api/chat/route";

export type ChatHotel = {
  id: string;
  name: string;
  stars: number;
  image?: string;
  price: string;
  address: string;
  rating: string;
  href: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  hotels?: ChatHotel[];
  searchUrl?: string;
};

let msgId = 0;
function nextId() {
  return `msg-${++msgId}`;
}

export function useHeroChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      document.documentElement.style.setProperty("--chat-p", "0");
      document.body.style.overflow = "";
      abortRef.current?.abort();
    };
  }, []);

  const openChat = useCallback(() => {
    document.documentElement.style.setProperty("--chat-p", "1");
    setOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    document.documentElement.style.setProperty("--chat-p", "0");
    document.body.style.overflow = "";
    abortRef.current?.abort();
    setOpen(false);
    setMessages([]);
    setLoading(false);
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || loading) return;

      const userMsg: ChatMessage = {
        id: nextId(),
        role: "user",
        content: content.trim(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      if (!open) {
        document.documentElement.style.setProperty("--chat-p", "1");
        setOpen(true);
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const history = [...messages, userMsg].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
          signal: controller.signal,
        });

        const data: ChatResponse = await res.json();

        if (!controller.signal.aborted) {
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "assistant",
              content: data.message,
              hotels: data.hotels,
              searchUrl: data.searchUrl,
            },
          ]);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (!controller.signal.aborted) {
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "assistant",
              content:
                "Sorry, something went wrong. Please try again.",
            },
          ]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [loading, messages, open],
  );

  return { open, messages, loading, openChat, closeChat, sendMessage };
}
