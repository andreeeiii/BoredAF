"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getRandomOnboardingSet,
  type OnboardingQuestion,
} from "@/constants/onboarding";

type OnboardingPhase = "chat" | "building" | "result";

interface OnboardingFlowProps {
  onComplete: () => void;
}

interface ChatMessage {
  type: "bot" | "user";
  text: string;
}

const BUILDING_STATUS_TEXTS = [
  "Scanning interests...",
  "Analyzing vibes...",
  "Mapping vectors...",
  "Calculating escape hatches...",
  "Building your persona...",
];

const MIN_BUILDING_DURATION_MS = 2500;

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [questions] = useState<OnboardingQuestion[]>(getRandomOnboardingSet);
  const [currentStep, setCurrentStep] = useState(0);
  const [input, setInput] = useState("");
  const [answers, setAnswers] = useState<
    { slot: string; question: string; answer: string }[]
  >([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<OnboardingPhase>("chat");
  const [buildingStatusIndex, setBuildingStatusIndex] = useState(0);
  const [result, setResult] = useState<{
    archetype: string;
    tags: string[];
  } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pendingResult = useRef<{ archetype: string; tags: string[] } | null>(null);
  const timerDone = useRef(false);
  const apiDone = useRef(false);

  const tryTransitionToResult = useCallback(() => {
    if (apiDone.current && timerDone.current && pendingResult.current) {
      setResult(pendingResult.current);
      setPhase("result");
    }
  }, []);

  useEffect(() => {
    if (questions.length > 0 && messages.length === 0) {
      setMessages([
        { type: "bot", text: "Yo! I'm BAF, your anti-boredom AI. 🧠" },
        {
          type: "bot",
          text: "I need to get to know you real quick — just 4 questions.",
        },
        { type: "bot", text: questions[0].text },
      ]);
    }
  }, [questions, messages.length]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (phase !== "building") return;
    const interval = setInterval(() => {
      setBuildingStatusIndex((prev) => (prev + 1) % BUILDING_STATUS_TEXTS.length);
    }, 600);
    return () => clearInterval(interval);
  }, [phase]);

  const handleSubmitAnswer = async () => {
    if (!input.trim() || loading) return;

    const currentQuestion = questions[currentStep];
    const answer = input.trim();

    setMessages((prev) => [...prev, { type: "user", text: answer }]);
    setInput("");

    const newAnswers = [
      ...answers,
      {
        slot: currentQuestion.slot,
        question: currentQuestion.text,
        answer,
      },
    ];
    setAnswers(newAnswers);

    const nextStep = currentStep + 1;

    if (nextStep < questions.length) {
      setCurrentStep(nextStep);
      setLoading(true);
      await new Promise((r) => setTimeout(r, 600));
      setMessages((prev) => [
        ...prev,
        { type: "bot", text: questions[nextStep].text },
      ]);
      setLoading(false);
    } else {
      setPhase("building");
      setBuildingStatusIndex(0);
      timerDone.current = false;
      apiDone.current = false;
      pendingResult.current = null;

      setTimeout(() => {
        timerDone.current = true;
        tryTransitionToResult();
      }, MIN_BUILDING_DURATION_MS);

      try {
        const res = await fetch("/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "submit", answers: newAnswers }),
        });

        if (!res.ok) throw new Error("Failed to save");

        const data = await res.json();
        pendingResult.current = { archetype: data.archetype, tags: data.tags };
      } catch {
        pendingResult.current = { archetype: "The Explorer", tags: ["curious"] };
      }

      apiDone.current = true;
      tryTransitionToResult();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitAnswer();
    }
  };

  if (phase === "building") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex flex-col items-center justify-center gap-8 min-h-[400px]"
        data-testid="building-persona"
      >
        <div className="relative flex items-center justify-center">
          <motion.div
            className="absolute w-32 h-32 rounded-full bg-red-600/20"
            animate={{
              scale: [1, 1.4, 1],
              opacity: [0.3, 0.1, 0.3],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute w-24 h-24 rounded-full bg-red-500/30"
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="relative w-16 h-16 rounded-full border-2 border-red-500
              flex items-center justify-center"
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          >
            <motion.div
              className="w-3 h-3 rounded-full bg-red-500"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          </motion.div>
          <svg className="absolute w-20 h-20" viewBox="0 0 80 80">
            <motion.circle
              cx="40" cy="40" r="36"
              fill="none" stroke="#ef4444" strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="226"
              initial={{ strokeDashoffset: 226 }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 2.5, ease: "easeInOut" }}
            />
          </svg>
        </div>

        <div className="flex flex-col items-center gap-3">
          <h2 className="text-white text-xl font-bold tracking-wide">
            Building Your Persona
          </h2>
          <AnimatePresence mode="wait">
            <motion.p
              key={buildingStatusIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="text-neutral-400 text-sm h-5"
              data-testid="building-status"
            >
              {BUILDING_STATUS_TEXTS[buildingStatusIndex]}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="flex gap-1.5 mt-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-red-600"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.15,
              }}
            />
          ))}
        </div>
      </motion.div>
    );
  }

  if (phase === "result" && result) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-6 max-w-md text-center"
        data-testid="result-screen"
      >
        <motion.span
          className="text-7xl"
          animate={{ rotate: [0, -5, 5, -5, 0] }}
          transition={{ duration: 0.6 }}
        >
          🧬
        </motion.span>
        <h2 className="text-white text-2xl font-bold">
          You are {result.archetype}
        </h2>
        <div className="flex flex-wrap justify-center gap-2">
          {result.tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 bg-neutral-800 text-neutral-300 rounded-full text-sm
                border border-neutral-700"
            >
              #{tag}
            </span>
          ))}
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onComplete}
          className="mt-4 px-10 py-4 bg-red-600 hover:bg-red-500 text-white font-bold
            rounded-full text-lg shadow-[0_0_30px_rgba(220,38,38,0.5)]
            transition-colors duration-200"
        >
          Let's Go 🔥
        </motion.button>
      </motion.div>
    );
  }

  const progress = ((currentStep + (phase !== "chat" ? 1 : 0)) / questions.length) * 100;

  return (
    <div className="flex flex-col w-full max-w-lg mx-auto h-[500px]">
      <div className="mb-4">
        <div className="flex justify-between text-neutral-500 text-xs mb-1">
          <span>Getting to know you</span>
          <span>
            Step {Math.min(currentStep + 1, questions.length)} of{" "}
            {questions.length}
          </span>
        </div>
        <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-red-600 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-4">
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.type === "bot"
                    ? "bg-neutral-800 text-neutral-200 rounded-bl-sm"
                    : "bg-red-600 text-white rounded-br-sm"
                }`}
              >
                {msg.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-neutral-800 text-neutral-400 px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm">
              <span className="animate-pulse">typing...</span>
            </div>
          </motion.div>
        )}

        <div ref={chatEndRef} />
      </div>

      {phase === "chat" && (
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={questions[currentStep]?.placeholder ?? "Type here..."}
            disabled={loading}
            className="flex-1 bg-neutral-800 text-white px-4 py-3 rounded-full
              border border-neutral-700 focus:border-red-500 focus:outline-none
              placeholder:text-neutral-500 text-sm
              disabled:opacity-50 transition-colors"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSubmitAnswer}
            disabled={!input.trim() || loading}
            className="px-5 py-3 bg-red-600 hover:bg-red-500 text-white font-bold
              rounded-full disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors duration-200"
          >
            →
          </motion.button>
        </div>
      )}
    </div>
  );
}
