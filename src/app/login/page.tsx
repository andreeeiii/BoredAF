"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { login, signup } from "./actions";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "login") {
        const result = await login(formData);
        // If we get here (no redirect), there's an error or we need to show a message
        if (result?.error) setError(result.error);
        if (result?.message) setMessage(result.message);
      } else {
        const result = await signup(formData);
        if (result?.error) setError(result.error);
        if (result?.message) {
          setMessage(result.message);
          setMode("login");
        }
      }
    } catch {
      // redirect() throws — this is expected on successful login
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-10">
          <h1 className="text-5xl font-extrabold tracking-tight text-white">
            Bored<span className="text-red-500">AF</span>
          </h1>
          <p className="text-neutral-500 text-sm mt-2">
            Your AI anti-boredom engine
          </p>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-6 backdrop-blur-sm">
          {/* Mode Toggle */}
          <div className="flex rounded-full bg-neutral-800 p-1 mb-6">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 text-sm font-semibold rounded-full transition-all duration-300 ${
                  mode === m
                    ? "bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.3)]"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {m === "login" ? "Log In" : "Sign Up"}
              </button>
            ))}
          </div>

          {/* Error/Message banners */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm"
              >
                {error}
              </motion.div>
            )}
            {message && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 px-4 py-2.5 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm"
              >
                {message}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Google OAuth */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4
              bg-white hover:bg-neutral-100 text-neutral-900 font-semibold
              rounded-full transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {googleLoading ? (
              <div className="w-5 h-5 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-neutral-700" />
            <span className="text-neutral-500 text-xs uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-neutral-700" />
          </div>

          {/* Email/Password Form */}
          <AnimatePresence mode="wait">
            <motion.form
              key={mode}
              initial={{ opacity: 0, x: mode === "login" ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: mode === "login" ? 20 : -20 }}
              transition={{ duration: 0.2 }}
              action={handleSubmit}
              className="flex flex-col gap-3"
            >
              <input
                name="email"
                type="email"
                placeholder="Email"
                required
                className="w-full bg-neutral-800 text-white px-4 py-3 rounded-xl
                  border border-neutral-700 focus:border-red-500 focus:outline-none
                  placeholder:text-neutral-500 text-sm transition-colors"
              />
              <input
                name="password"
                type="password"
                placeholder="Password"
                required
                minLength={6}
                className="w-full bg-neutral-800 text-white px-4 py-3 rounded-xl
                  border border-neutral-700 focus:border-red-500 focus:outline-none
                  placeholder:text-neutral-500 text-sm transition-colors"
              />
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold
                  rounded-full text-sm shadow-[0_0_20px_rgba(220,38,38,0.3)]
                  transition-colors duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : mode === "login" ? (
                  "Log In"
                ) : (
                  "Create Account"
                )}
              </motion.button>
            </motion.form>
          </AnimatePresence>
        </div>

        <p className="text-center text-neutral-600 text-xs mt-6">
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-red-500 hover:text-red-400 transition-colors font-medium"
          >
            {mode === "login" ? "Sign up" : "Log in"}
          </button>
        </p>
      </motion.div>
    </main>
  );
}
