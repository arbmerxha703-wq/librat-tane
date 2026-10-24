"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { EyeIcon, EyeOffIcon, LockIcon, ShelfDecoration } from "./icons";

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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <div className="wood animate-rise overflow-hidden rounded-[2rem] px-6 pt-8 text-center shadow-xl">
        <p className="text-sm font-semibold tracking-[0.2em] text-[#f3dfae]/80 uppercase">Biblioteka e shtëpisë</p>
        <h1 className="mt-2 font-serif text-5xl font-bold">Librat Tanë</h1>
        <ShelfDecoration className="mx-auto mt-6 w-fit" />
        <div aria-hidden className="-mx-6 h-3 bg-black/25" />
      </div>

      <form onSubmit={submit} className="animate-rise mx-1 -mt-4 rounded-3xl border border-line bg-card p-5 shadow-lg">
        <label htmlFor="passcode" className="mb-1 flex items-center gap-2 text-xl font-semibold">
          <LockIcon className="h-6 w-6 text-accent" />
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
            className="h-18 w-full rounded-2xl border-2 border-line bg-bg pr-14 pl-3 text-center text-xl outline-none focus:border-accent"
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
          className="mt-5 h-16 w-full rounded-2xl bg-accent text-xl font-bold text-accent-ink shadow-md disabled:opacity-50"
        >
          {busy ? "Duke kontrolluar…" : "Hyr"}
        </button>
      </form>
    </main>
  );
}
