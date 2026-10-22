import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export function AuthScreen({ onSkip, onDone }: { onSkip: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin, data: { display_name: name.trim() || undefined } },
      });
      if (error) setError(error.message);
      else if (data.session) onDone();
      else setNotice("Check your email and tap the link to confirm your account.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message); else onDone();
    }
    setBusy(false);
  }

  async function google() {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) { setError(result.error.message ?? "Google sign-in failed"); return; }
    if (result.redirected) return;
    onDone();
  }

  const input = "w-full rounded-2xl border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring";
  return (
    <section>
      <h1 className="font-display text-4xl leading-[1.05] tracking-tight">
        {mode === "signin" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-2 text-muted-foreground">Save recipes and open them anytime, on any device.</p>

      <button type="button" onClick={google}
        className="tactile mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-5 py-4 font-medium shadow-soft">
        Continue with Google
      </button>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or with email <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} className="space-y-3">
        {mode === "signup" && (
          <input className={input} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        )}
        <input className={input} type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <input className={input} type="password" required minLength={6} placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
        {error && <p className="text-sm text-destructive">{error}</p>}
        {notice && <p className="rounded-xl bg-secondary p-3 text-sm">{notice}</p>}
        <button type="submit" disabled={busy}
          className="tactile flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 font-medium text-primary-foreground shadow-lift disabled:opacity-40">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        {mode === "signin" ? "New to Pinch? " : "Already have an account? "}
        <button type="button" className="font-medium text-foreground underline" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setNotice(null); }}>
          {mode === "signin" ? "Create account" : "Sign in"}
        </button>
      </p>
      <button type="button" onClick={onSkip} className="mt-6 w-full text-center text-sm text-muted-foreground underline">
        Skip for now — recipes save on this device only
      </button>
    </section>
  );
}
