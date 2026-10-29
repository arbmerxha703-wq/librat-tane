"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { AppLogo, EyeIcon, EyeOffIcon, LockIcon } from "./icons";

export function PasscodeScreen({ onUnlock, notice }: { onUnlock: (code: string) => void; notice?: string }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(notice ?? "");
  const [busy, setBusy] = useState(false);
  const [showCode, setShowCode] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/auth", code.trim(), { method: "POST" });
      onUnlock(code.trim());
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
        <h1 className="mt-2 font-serif text-5xl font-bold">Librat Tanë</h1>
        <p className="mt-3 text-lg text-white/75">Çdo libër, në vendin e vet.</p>
        <span aria-hidden className="gold-rule mt-6 block w-40" />
      </div>

      <form onSubmit={submit} className="animate-rise mx-auto mt-8 w-full max-w-md rounded-[2rem] bg-card p-6 text-ink shadow-[0_30px_60px_-25px_rgba(0,0,0,0.6)]">
        <label htmlFor="passcode" className="mb-1 flex items-center gap-2 text-xl font-semibold">
          <LockIcon className="h-6 w-6 text-gold" />
          Shkruani kodin
        </label>
        <p className="mb-4 text-base text-muted">Kodi kërkohet vetëm një herë në këtë telefon.</p>
        <div className="relative">
          {/* Full keyboard (letters + numbers); the phone must not capitalise or "correct" the code. */}
          <input
            id="passcode"
            type={showCode ? "text" : "password"}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="h-18 w-full rounded-2xl border border-line bg-bg pr-14 pl-3 text-center text-xl outline-none focus:border-gold focus:ring-4 focus:ring-gold/20"
          />
          <button
            type="button"
            onClick={() => setShowCode((v) => !v)}
            aria-label={showCode ? "Fshih kodin" : "Shfaq kodin"}
            aria-pressed={showCode}
            className="absolute top-1/2 right-2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-xl text-muted hover:bg-soft"
          >
            {showCode ? <EyeOffIcon className="h-7 w-7" /> : <EyeIcon className="h-7 w-7" />}
          </button>
        </div>
        <p className="mt-2 text-base text-muted">
          Prekni syrin {showCode ? "për ta fshehur" : "për ta parë"} kodin që shkruani.
        </p>
        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-danger/10 px-4 py-3 text-lg font-medium text-danger">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="mt-5 h-16 w-full rounded-2xl bg-accent text-xl font-bold text-accent-ink shadow-card disabled:opacity-50"
        >
          {busy ? "Duke kontrolluar…" : "Hyr"}
        </button>
      </form>
    </main>
  );
}
