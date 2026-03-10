"use client";

import { useState } from "react";

type BafState = "idle" | "thinking";

export default function BafButton() {
  const [state, setState] = useState<BafState>("idle");

  const handleClick = () => {
    setState("thinking");
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <button
        onClick={handleClick}
        disabled={state === "thinking"}
        className={`
          relative w-48 h-48 rounded-full
          text-white text-2xl font-bold uppercase tracking-widest
          transition-all duration-300 ease-in-out
          ${state === "idle"
            ? "bg-red-600 hover:bg-red-500 hover:scale-105 shadow-[0_0_40px_rgba(220,38,38,0.6)] hover:shadow-[0_0_60px_rgba(220,38,38,0.8)]"
            : "bg-red-800 cursor-not-allowed animate-pulse shadow-[0_0_60px_rgba(220,38,38,0.4)]"
          }
        `}
        aria-label={state === "idle" ? "Get a suggestion" : "Loading suggestion"}
      >
        {state === "idle" ? "BAF" : "Thinking..."}
      </button>
      {state === "thinking" && (
        <button
          onClick={() => setState("idle")}
          className="text-sm text-neutral-400 hover:text-white transition-colors underline"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
