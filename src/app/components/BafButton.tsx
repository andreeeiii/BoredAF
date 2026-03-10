"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type BafState = "idle" | "thinking" | "suggestion" | "why";

interface Rescue {
  suggestion: string;
  emoji: string;
  vibe: string;
  source: string;
  link: string | null;
  isLive?: boolean;
  archetype?: string;
  twitchUsername?: string;
  viewerCount?: number | null;
  gameName?: string | null;
  poolId?: string | null;
  category?: string | null;
}

const WHY_REASONS = [
  { label: "Too tired", value: "too tired" },
  { label: "Not interested", value: "not interested" },
  { label: "Already did that", value: "already did that" },
  { label: "Something else", value: "other" },
];

const PLATFORM_STYLES: Record<string, { color: string; icon: string; label: string }> = {
  youtube: { color: "text-red-500", icon: "▶", label: "YouTube" },
  twitch: { color: "text-purple-400", icon: "◉", label: "Twitch" },
  tiktok: { color: "text-white", icon: "♪", label: "TikTok" },
  chess: { color: "text-green-400", icon: "♟", label: "Chess" },
  fallback: { color: "text-neutral-400", icon: "✦", label: "BAF" },
  custom: { color: "text-yellow-400", icon: "★", label: "Custom" },
};

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

    if (rescue.link) {
      window.open(rescue.link, "_blank", "noopener,noreferrer");
    }

    await fetch("/api/baf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "feedback",
        suggestion: rescue.suggestion,
        outcome: "accepted",
        source: rescue.source,
        archetype: rescue.archetype,
        link: rescue.link,
        poolId: rescue.poolId,
        category: rescue.category,
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
        source: rescue.source,
        archetype: rescue.archetype,
        link: rescue.link,
        poolId: rescue.poolId,
        category: rescue.category,
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

  const platformStyle = rescue
    ? PLATFORM_STYLES[rescue.source] ?? PLATFORM_STYLES.custom
    : null;

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
            {rescue.isLive && (
              <motion.div
                className="flex items-center gap-2 px-4 py-1 rounded-full bg-red-600/20 border border-red-500/50"
                animate={{ opacity: [1, 0.6, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-red-400 text-xs font-bold uppercase tracking-widest">
                  Live Now
                </span>
              </motion.div>
            )}
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
            <div className="flex items-center gap-2">
              {platformStyle && (
                <span className={`text-lg ${platformStyle.color}`}>
                  {platformStyle.icon}
                </span>
              )}
              <span className="text-neutral-500 text-xs uppercase tracking-widest">
                {platformStyle?.label ?? rescue.source} • {rescue.vibe}
              </span>
            </div>
            {rescue.source === "twitch" && (rescue.viewerCount || rescue.gameName || rescue.twitchUsername) && (
              <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-purple-900/20 border border-purple-500/30">
                <span className="text-purple-400 text-lg font-bold">◉</span>
                <div className="flex flex-col items-start text-left">
                  {rescue.twitchUsername && (
                    <span className="text-purple-300 text-sm font-semibold">
                      {rescue.twitchUsername}
                    </span>
                  )}
                  <div className="flex items-center gap-2 text-xs text-neutral-400">
                    {rescue.gameName && (
                      <span>Playing <span className="text-purple-200">{rescue.gameName}</span></span>
                    )}
                    {rescue.viewerCount != null && rescue.viewerCount > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                        {rescue.viewerCount.toLocaleString()} viewers
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
            {rescue.link && (
              <a
                href={rescue.link}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-sm hover:opacity-80 underline transition-colors font-medium ${
                  rescue.source === "twitch"
                    ? "text-purple-400"
                    : rescue.source === "youtube"
                    ? "text-red-400"
                    : rescue.source === "tiktok"
                    ? "text-white"
                    : rescue.source === "chess"
                    ? "text-green-400"
                    : "text-blue-400"
                }`}
              >
                {rescue.link.length > 55 ? rescue.link.slice(0, 55) + "..." : rescue.link}
              </a>
            )}
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
