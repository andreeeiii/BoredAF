"use client";

import { useState, useEffect } from "react";
import BafButton from "./components/BafButton";
import OnboardingFlow from "./components/OnboardingFlow";

export default function Home() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkOnboarding() {
      try {
        const res = await fetch("/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check" }),
        });
        const data = await res.json();
        setShowOnboarding(!data.complete);
      } catch {
        setShowOnboarding(false);
      } finally {
        setChecking(false);
      }
    }
    checkOnboarding();
  }, []);

  if (checking) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-950">
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4">
      <h1 className="mb-12 text-5xl font-extrabold tracking-tight text-white sm:text-6xl">
        Bored<span className="text-red-500">AF</span>
      </h1>
      {showOnboarding ? (
        <OnboardingFlow onComplete={() => setShowOnboarding(false)} />
      ) : (
        <BafButton />
      )}
    </main>
  );
}
