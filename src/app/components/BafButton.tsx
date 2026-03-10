"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type BafState = "idle" | "thinking" | "suggestion" | "why";

interface Rescue {
  suggestion: string;
  emoji: string;
  vibe: string;
  source: string;
}

const WHY_REASONS = [
  { label: "Too tired", value: "too tired" },
  { label: "Not interested", value: "not interested" },
  { label: "Already did that", value: "already did that" },
  { label: "Something else", value: "other" },
];

export default function BafButton() {
  const [state, setState] = useState<BafState>("idle");
  const [rescue, setRescue] = useState<Rescue | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleBaf = async () => {
    setState("thinking");
    setError(null);

    try {
      const res = await fetch("/api/baf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "baf" }),
      });

      if (!res.ok) throw new Error("Failed to get suggestion");

      const data: Rescue = await res.json();
      setRescue(data);
      setState("suggestion");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState("idle");
    }
  };

  const handleAccept = async () => {
    if (!rescue) return;

    await fetch("/api/baf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "feedback",
        suggestion: rescue.suggestion,
        outcome: "accepted",
      }),
    });

    setState("idle");
    setRescue(null);
  };

  const handleReject = () => {
    setState("why");
  };

  const handleWhyReason = async (reason: string) => {
    if (!rescue) return;

    await fetch("/api/baf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "feedback",
        suggestion: rescue.suggestion,
        outcome: "rejected",
        reason,
      }),
    });

    setRescue(null);
    setState("thinking");

    try {
      const res = await fetch("/api/baf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "baf" }),
      });

      if (!res.ok) throw new Error("Failed to get suggestion");

      const data: Rescue = await res.json();
      setRescue(data);
      setState("suggestion");
    } catch {
      setState("idle");
    }
  };

  return (
    <div className="flex flex-col items-center gap-8 min-h-[400px] justify-center">
      <AnimatePresence mode="wait">
        {state === "idle" && (
          <motion.div
            key="idle"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="flex flex-col items-center gap-4"
          >
            <button
              onClick={handleBaf}
              className="relative w-48 h-48 rounded-full bg-red-600 hover:bg-red-500
                hover:scale-105 shadow-[0_0_40px_rgba(220,38,38,0.6)]
                hover:shadow-[0_0_60px_rgba(220,38,38,0.8)]
                text-white text-3xl font-bold uppercase tracking-widest
                transition-all duration-300 ease-in-out"
              aria-label="Get a suggestion"
            >
              BAF
            </button>
            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}
          </motion.div>
        )}

        {state === "thinking" && (
          <motion.div
            key="thinking"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="flex flex-col items-center gap-4"
          >
            <div
              className="relative w-48 h-48 rounded-full bg-red-800
                animate-pulse shadow-[0_0_60px_rgba(220,38,38,0.4)]
                flex items-center justify-center"
            >
              <span className="text-white text-xl font-bold tracking-widest">
                Thinking...
              </span>
            </div>
            <button
              onClick={() => { setState("idle"); setRescue(null); }}
              className="text-sm text-neutral-400 hover:text-white transition-colors underline"
            >
              Cancel
            </button>
          </motion.div>
        )}

        {state === "suggestion" && rescue && (
          <motion.div
            key="suggestion"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="flex flex-col items-center gap-6 max-w-md text-center"
          >
            <motion.span
              className="text-6xl"
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {rescue.emoji}
            </motion.span>
            <p className="text-white text-xl font-semibold leading-relaxed">
              {rescue.suggestion}
            </p>
            <span className="text-neutral-500 text-xs uppercase tracking-widest">
              {rescue.vibe} • {rescue.source}
            </span>
            <div className="flex gap-4 mt-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleAccept}
                className="px-8 py-3 bg-green-600 hover:bg-green-500
                  text-white font-bold rounded-full text-lg
                  shadow-[0_0_20px_rgba(34,197,94,0.4)]
                  transition-colors duration-200"
              >
                LFG 🔥
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleReject}
                className="px-8 py-3 bg-neutral-700 hover:bg-neutral-600
                  text-white font-bold rounded-full text-lg
                  transition-colors duration-200"
              >
                Nah 👎
              </motion.button>
            </div>
          </motion.div>
        )}

        {state === "why" && (
          <motion.div
            key="why"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="flex flex-col items-center gap-4"
          >
            <p className="text-white text-lg font-semibold">Why not?</p>
            <div className="flex flex-wrap justify-center gap-3">
              {WHY_REASONS.map((r) => (
                <motion.button
                  key={r.value}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleWhyReason(r.value)}
                  className="px-5 py-2 bg-neutral-800 hover:bg-neutral-700
                    text-neutral-300 hover:text-white rounded-full text-sm
                    border border-neutral-700 hover:border-neutral-500
                    transition-colors duration-200"
                >
                  {r.label}
                </motion.button>
              ))}
            </div>
            <button
              onClick={() => setState("suggestion")}
              className="text-sm text-neutral-500 hover:text-white transition-colors underline mt-2"
            >
              Go back
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
