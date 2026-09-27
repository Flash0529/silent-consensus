"use client";

import { useState } from "react";
import { MicIcon, PlusIcon, SendIcon } from "./Icons";

type Props = {
  onSend: (text: string) => void;
  onMic?: () => void;
  micActive?: boolean;
  disabled?: boolean;
  placeholder?: string;
  showPlus?: boolean;
};

export function Composer({ onSend, onMic, micActive, disabled, placeholder = "Tell Hush anything", showPlus = true }: Props) {
  const [text, setText] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText("");
  };
  const hasText = text.trim().length > 0;

  return (
    <form
      onSubmit={submit}
      className="flex items-center gap-[10px] bg-surface px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-[10px]"
    >
      {showPlus && (
        <button
          type="button"
          aria-label="Add a photo or file"
          disabled
          className="flex h-float w-float shrink-0 items-center justify-center rounded-full bg-surface shadow-float disabled:opacity-60"
        >
          <PlusIcon />
        </button>
      )}
      <div className="relative h-composer grow">
        <label htmlFor="composer" className="sr-only">
          Message Hush
        </label>
        <input
          id="composer"
          type="text"
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="h-composer w-full rounded-full bg-bubble pl-[22px] pr-[60px] text-body text-ink shadow-float outline-none outline-offset-1 placeholder:text-muted focus:outline-1 focus:outline-galaxy disabled:opacity-60"
        />
        {hasText || !onMic ? (
          <button
            type="submit"
            aria-label="Send"
            disabled={!hasText || disabled}
            className="absolute right-[6px] top-[6px] flex h-11 w-11 items-center justify-center rounded-full bg-ink disabled:bg-control"
          >
            <SendIcon className={hasText ? "text-on-ink" : "text-muted"} />
          </button>
        ) : (
          <button
            type="button"
            aria-label={micActive ? "Stop recording" : "Reply by voice"}
            aria-pressed={micActive}
            onClick={onMic}
            disabled={disabled && !micActive}
            className={`absolute right-[6px] top-[6px] flex h-11 w-11 items-center justify-center rounded-full ${
              micActive ? "bg-hush" : "bg-control"
            }`}
          >
            <MicIcon className={micActive ? "text-white" : "text-ink-2"} />
          </button>
        )}
      </div>
    </form>
  );
}
