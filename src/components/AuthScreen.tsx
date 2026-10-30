"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { setSession, type Session } from "@/lib/session";
import { AppLogo, CheckIcon, EyeIcon, EyeOffIcon, LockIcon } from "./icons";

export type AuthMode = "login" | "signup" | "forgot" | "reset";

const TITLES: Record<AuthMode, string> = {
  login: "Hyni në llogari",
  signup: "Krijoni llogari",
  forgot: "Keni harruar fjalëkalimin?",
  reset: "Zgjidhni fjalëkalim të ri",
};

const HINTS: Record<AuthMode, string> = {
  login: "Me të njëjtin email mund të hyni nga disa telefona, dhe të gjithë shohin të njëjtat libra.",
  signup: "Çdo llogari ka bibliotekën e vet. Hyrja kërkohet vetëm një herë në këtë telefon.",
  forgot: "Shkruani email-in e llogarisë. Do t’ju dërgojmë një lidhje për të zgjedhur fjalëkalim të ri.",
  reset: "Shkruani fjalëkalimin e ri, me të paktën 6 shkronja.",
};

const SUBMIT: Record<AuthMode, [idle: string, busy: string]> = {
  login: ["Hyr", "Duke hyrë…"],
  signup: ["Krijo llogarinë", "Duke krijuar…"],
  forgot: ["Dërgo lidhjen", "Duke dërguar…"],
  reset: ["Ruaj fjalëkalimin", "Duke ruajtur…"],
};

const fieldClass =
  "h-16 w-full rounded-2xl border border-line bg-bg px-4 text-xl outline-none focus:border-gold focus:ring-4 focus:ring-gold/20";

export function AuthScreen({
  initialMode = "login",
  notice,
  onPasswordSet,
}: {
  initialMode?: AuthMode;
  notice?: string;
  /** After "reset": the new password is saved and the person is signed in. */
  onPasswordSet?: () => void;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(notice ?? "");
  const [sentTo, setSentTo] = useState("");
  const [busy, setBusy] = useState(false);

  function switchTo(next: AuthMode) {
    setMode(next);
    setError("");
    setSentTo("");
    setPassword("");
  }

  const needsEmail = mode !== "reset";
  const needsPassword = mode !== "forgot";
  const ready = (!needsEmail || email.trim()) && (!needsPassword || password);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "forgot") {
        await api("/api/auth", { method: "POST", body: JSON.stringify({ action: "forgot", email: email.trim() }) });
        setSentTo(email.trim());
      } else if (mode === "reset") {
        await api("/api/auth", { method: "POST", body: JSON.stringify({ action: "password", password }) });
        onPasswordSet?.();
      } else {
        const { session } = await api<{ session: Session }>("/api/auth", {
          method: "POST",
          body: JSON.stringify({ action: mode, email: email.trim(), password }),
        });
        setSession(session);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="hero flex min-h-dvh flex-col justify-center px-5 pt-[max(2.5rem,env(safe-area-inset-top))] pb-10">
      <div className="animate-rise mx-auto flex w-full max-w-md flex-col items-center text-center">
        <AppLogo className="h-28 w-28" />
        <p className="eyebrow gold-text mt-7">Biblioteka e shtëpisë</p>
        <h1 className="mt-2 font-serif text-5xl font-bold">BookNest</h1>
        <p className="mt-3 text-lg text-white/75">Çdo libër, në vendin e vet.</p>
        <span aria-hidden className="gold-rule mt-6 block w-40" />
      </div>

      <form
        onSubmit={submit}
        className="animate-rise mx-auto mt-8 w-full max-w-md rounded-[2rem] bg-card p-6 text-ink shadow-[0_30px_60px_-25px_rgba(0,0,0,0.6)]"
      >
        <h2 className="mb-1 flex items-center gap-2 text-2xl font-semibold">
          <LockIcon className="h-6 w-6 shrink-0 text-gold" />
          {TITLES[mode]}
        </h2>
        <p className="mb-5 text-base text-muted">{HINTS[mode]}</p>

        {sentTo ? (
          <p role="status" className="flex gap-3 rounded-xl bg-accent/10 px-4 py-3 text-lg">
            <CheckIcon className="mt-1 h-6 w-6 shrink-0 text-accent" />
            <span>
              Nëse <strong>{sentTo}</strong> ka llogari, lidhja u dërgua. Hapni email-in në këtë telefon dhe prekni lidhjen.
            </span>
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {needsEmail && (
              <div>
                <label htmlFor="email" className="mb-1 block text-lg font-semibold">
                  Email-i
                </label>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete={mode === "signup" ? "email" : "username"}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="emri@gmail.com"
                  className={`${fieldClass} placeholder:text-muted/50`}
                />
              </div>
            )}
            {needsPassword && (
              <div>
                <label htmlFor="password" className="mb-1 block text-lg font-semibold">
                  {mode === "login" ? "Fjalëkalimi" : "Fjalëkalimi i ri"}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${fieldClass} pr-16`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Fshih fjalëkalimin" : "Shfaq fjalëkalimin"}
                    aria-pressed={showPassword}
                    className="absolute top-1/2 right-1 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-xl text-muted hover:bg-soft"
                  >
                    {showPassword ? <EyeOffIcon className="h-7 w-7" /> : <EyeIcon className="h-7 w-7" />}
                  </button>
                </div>
                {mode !== "login" && <p className="mt-2 text-base text-muted">Të paktën 6 shkronja ose numra.</p>}
              </div>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-danger/10 px-4 py-3 text-lg font-medium text-danger">
            {error}
          </p>
        )}

        {!sentTo && (
          <button
            type="submit"
            disabled={busy || !ready}
            className="mt-5 h-16 w-full rounded-2xl bg-accent text-xl font-bold text-accent-ink shadow-card disabled:opacity-50"
          >
            {busy ? SUBMIT[mode][1] : SUBMIT[mode][0]}
          </button>
        )}

        {mode !== "reset" && (
          <div className="mt-5 flex flex-col items-center gap-1 border-t border-line pt-4 text-lg">
            {mode === "login" ? (
              <>
                <SwitchLink onClick={() => switchTo("signup")} lead="S’keni llogari?" label="Krijoni një" />
                <SwitchLink onClick={() => switchTo("forgot")} label="Kam harruar fjalëkalimin" />
              </>
            ) : (
              <SwitchLink
                onClick={() => switchTo("login")}
                lead={mode === "signup" ? "Keni llogari?" : undefined}
                label={mode === "signup" ? "Hyni" : "Kthehu te hyrja"}
              />
            )}
          </div>
        )}
      </form>
    </main>
  );
}

function SwitchLink({ lead, label, onClick }: { lead?: string; label: string; onClick: () => void }) {
  return (
    <p className="text-muted">
      {lead}{" "}
      <button type="button" onClick={onClick} className="min-h-12 px-1 font-semibold text-accent underline underline-offset-4">
        {label}
      </button>
    </p>
  );
}
