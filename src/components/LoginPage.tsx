import React, { useState } from "react";
import { auth } from "../lib/supabase";
import { Lock, Mail, RefreshCw, AlertCircle, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await auth.signIn(email.trim(), password);
      // No manual redirect needed here — App.tsx listens to auth state
      // changes via auth.onAuthStateChange and will re-render into the
      // Admin Panel automatically once the session is set.
    } catch (err: any) {
      console.error("Login failed:", err);
      setError(err?.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-yellow-400 flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(250,204,21,0.35)]">
            <ShieldCheck className="w-7 h-7 text-black" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Admin Access</h1>
          <p className="text-xs text-gray-400">Sign in with your admin credentials to continue.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md shadow-sm space-y-4"
        >
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 text-red-400 text-xs font-semibold flex items-center gap-2 border border-red-500/20">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400">
              Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full text-xs p-3 pl-9 rounded-xl border border-white/10 focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 bg-white/5 font-medium text-white placeholder:text-gray-600"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-xs p-3 pl-9 rounded-xl border border-white/10 focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 bg-white/5 font-medium text-white placeholder:text-gray-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-yellow-400 text-black hover:bg-yellow-300 disabled:opacity-50 transition-colors font-bold text-xs flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(250,204,21,0.25)] cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Signing In...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <p className="text-center text-[10px] text-gray-600 font-mono mt-6">
          Admin accounts are provisioned manually. No self-signup.
        </p>
      </div>
    </div>
  );
}
