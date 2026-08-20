"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { ChatMessage, ChatHotel } from "./useHeroChat";

export function ChatView({
  open,
  onBack,
  messages = [],
  loading = false,
  onSend,
}: {
  open: boolean;
  onBack: () => void;
  messages?: ChatMessage[];
  loading?: boolean;
  onSend: (content: string) => void;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    onSend(input);
    setInput("");
  };

  return (
    <div
      data-show={open}
      inert={!open}
      className="hero-chat-view absolute inset-0 flex h-full flex-col"
    >
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit shrink-0 cursor-pointer items-center gap-3 font-display text-[16px] text-neutral-600 tracking-[-0.32px]"
      >
        <span className="flex size-8 items-center justify-center rounded-full border border-neutral-200 bg-white">
          <Icon
            name="chevron"
            size={11.7}
            style={{ height: 6.7, rotate: "90deg" }}
          />
        </span>
        Back
      </button>

      <div
        ref={scrollRef}
        className="no-scrollbar mt-4 flex flex-1 flex-col gap-4 overflow-y-auto"
      >
        {messages.map((msg) =>
          msg.role === "user" ? (
            <UserBubble key={msg.id} content={msg.content} />
          ) : (
            <AssistantMessage
              key={msg.id}
              content={msg.content}
              hotels={msg.hotels}
              searchUrl={msg.searchUrl}
            />
          ),
        )}

        {loading && <TypingIndicator />}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 shrink-0">
        <div className="w-full rounded-[30px] bg-white p-2 drop-shadow-[0px_15px_10px_rgba(0,0,0,0.03)]">
          <div className="flex w-full items-center gap-4 rounded-[24px] border border-neutral-200 bg-white py-2 pr-2 pl-5 shadow-[0px_15px_20px_0px_rgba(0,0,0,0.03)]">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about hotels, destinations..."
              className="min-w-0 flex-1 bg-transparent text-[14px] font-medium tracking-[-0.28px] text-neutral-900 outline-none placeholder:text-neutral-400"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              aria-label="Send"
              className="flex size-10 shrink-0 items-center justify-center rounded-[16px] bg-brand text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon
                name="arrow-right"
                size={20}
                style={{ rotate: "-90deg" }}
              />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[80%] rounded-tl-[16px] rounded-tr-[16px] rounded-br-[6px] rounded-bl-[16px] bg-neutral-500 px-3.5 py-2.5 font-display text-[14px] leading-[20px] text-white tracking-[-0.28px]">
        {content}
      </p>
    </div>
  );
}

function AssistantMessage({
  content,
  hotels,
  searchUrl,
}: {
  content: string;
  hotels?: ChatHotel[];
  searchUrl?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-display text-[14px] leading-[22px] tracking-[-0.28px] text-[#384250]">
        {content}
      </p>

      {hotels?.length ? (
        <div className="no-scrollbar -mx-2 flex gap-3 overflow-x-auto px-2 pb-1">
          {hotels.map((hotel) => (
            <HotelCard key={hotel.id} hotel={hotel} />
          ))}
        </div>
      ) : null}

      {searchUrl && (
        <Link
          href={searchUrl}
          className="flex w-fit items-center gap-2 rounded-full border border-brand/20 bg-brand/5 px-4 py-2 font-display text-[13px] font-medium text-brand transition-colors hover:bg-brand/10"
        >
          <Icon name="search" size={14} />
          View all results
        </Link>
      )}
    </div>
  );
}

function HotelCard({ hotel }: { hotel: ChatHotel }) {
  return (
    <Link
      href={hotel.href}
      className="group flex w-[200px] shrink-0 flex-col overflow-hidden rounded-[14px] border border-neutral-200 bg-white transition-shadow hover:shadow-md"
    >
      {hotel.image ? (
        <div
          className="h-[120px] w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${hotel.image})` }}
        />
      ) : (
        <div className="flex h-[120px] w-full items-center justify-center bg-neutral-100 text-neutral-400">
          <Icon name="building" size={24} />
        </div>
      )}
      <div className="flex flex-col gap-1 p-2.5">
        <div className="flex items-center gap-1">
          <Icon name="star" size={10} className="text-neutral-900" />
          <span className="text-[11px] font-bold text-neutral-900">
            {hotel.stars}
          </span>
          {hotel.rating && (
            <>
              <span className="text-[10px] text-neutral-400">·</span>
              <span className="text-[11px] text-neutral-500">
                {hotel.rating}
              </span>
            </>
          )}
        </div>
        <h4 className="line-clamp-2 text-[13px] leading-[16px] font-semibold text-neutral-900">
          {hotel.name}
        </h4>
        <p className="truncate text-[11px] text-neutral-500">{hotel.address}</p>
        <p className="mt-0.5 text-[15px] font-bold text-neutral-900">
          {hotel.price}
        </p>
      </div>
    </Link>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-2">
      <span className="size-2 animate-bounce rounded-full bg-neutral-400 [animation-delay:0ms]" />
      <span className="size-2 animate-bounce rounded-full bg-neutral-400 [animation-delay:150ms]" />
      <span className="size-2 animate-bounce rounded-full bg-neutral-400 [animation-delay:300ms]" />
    </div>
  );
}
