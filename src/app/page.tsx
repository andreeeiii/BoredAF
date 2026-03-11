"use client";

import { useState, useEffect } from "react";
import BafButton from "./components/BafButton";
import OnboardingFlow from "./components/OnboardingFlow";
import { createClient } from "@/lib/supabase/client";

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
        if (data.error === "Unauthorized") {
          window.location.href = "/login";
          return;
        }
        setShowOnboarding(!data.complete);
      } catch {
        setShowOnboarding(false);
      } finally {
        setChecking(false);
      }
    }
    checkOnboarding();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  if (checking) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-950">
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4">
      <button
        onClick={handleLogout}
        className="absolute top-6 right-6 text-neutral-500 hover:text-white text-sm
          transition-colors duration-200"
      >
        Log out
      </button>
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
