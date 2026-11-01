"use client";

import { useState } from "react";
import type { LibraryInfo } from "@/lib/types";
import { api, booksLabel } from "@/lib/client";
import { Modal } from "./Modal";
import { PlusIcon, TrashIcon } from "./icons";

const inputClass =
  "h-14 w-full min-w-0 rounded-xl border border-line bg-bg px-4 text-xl outline-none focus:border-gold focus:ring-4 focus:ring-gold/20";

/** Add a library (another bookcase or room), rename one, or remove an empty one. */
export function LibrariesSheet({
  libraries,
  counts,
  onSaved,
  onClose,
}: {
  libraries: LibraryInfo[];
  /** Books in each library, by id. */
  counts: Record<string, number>;
  /** The saved list, and the library just added (if any) so it can be opened. */
  onSaved: (libraries: LibraryInfo[], added?: LibraryInfo) => void;
  onClose: () => void;
}) {
  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(libraries.map((l) => [l.id, l.name])),
  );
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(list: LibraryInfo[], added?: LibraryInfo) {
    setBusy(true);
    setError("");
    try {
      const { libraries: saved } = await api<{ libraries: LibraryInfo[] }>("/api/libraries", {
        method: "PUT",
        body: JSON.stringify({ libraries: list }),
      });
      onSaved(saved, added);
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const current = () => libraries.map((l) => ({ ...l, name: (names[l.id] ?? l.name).trim() || l.name }));
  const renamed = libraries.some((l) => (names[l.id] ?? l.name).trim() !== l.name);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const added = { id: crypto.randomUUID(), name };
    if (await save([...current(), added], added)) onClose();
  }

  function remove(lib: LibraryInfo) {
    if (!window.confirm(`Ta heqim bibliotekën „${lib.name}“?`)) return;
    save(current().filter((l) => l.id !== lib.id));
  }

  return (
    <Modal title="Bibliotekat" onClose={onClose}>
      <div className="flex flex-col gap-6">
        <form onSubmit={add} className="brass flex flex-col gap-3 rounded-2xl p-4">
          <label htmlFor="new-library" className="text-xl font-bold">
            Shto bibliotekë
          </label>
          <p className="text-base opacity-80">
            P.sh. një raft në dhomë tjetër. Çdo bibliotekë ka raftet, librat dhe fotot e veta.
          </p>
          <input
            id="new-library"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="p.sh. Dhoma e gjumit"
            maxLength={40}
            autoComplete="off"
            className={`${inputClass} border-brass-line bg-card text-ink placeholder:text-muted/60`}
          />
          <button
            type="submit"
            disabled={busy || !newName.trim()}
            className="flex h-14 items-center justify-center gap-2 rounded-xl bg-accent text-xl font-bold text-accent-ink shadow-card disabled:opacity-50"
          >
            <PlusIcon className="h-6 w-6" />
            {busy ? "Duke ruajtur…" : "Shto"}
          </button>
        </form>

        <section className="flex flex-col gap-3">
          <h3 className="text-xl font-bold">Emrat</h3>
          {libraries.map((l) => {
            const count = counts[l.id] ?? 0;
            const canRemove = libraries.length > 1 && count === 0;
            return (
              <div key={l.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <input
                    value={names[l.id] ?? l.name}
                    onChange={(e) => setNames((n) => ({ ...n, [l.id]: e.target.value }))}
                    aria-label={`Emri i bibliotekës ${l.name}`}
                    maxLength={40}
                    autoComplete="off"
                    className={inputClass}
                  />
                  {canRemove && (
                    <button
                      type="button"
                      onClick={() => remove(l)}
                      disabled={busy}
                      aria-label={`Hiq bibliotekën ${l.name}`}
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-danger ring-1 ring-line hover:bg-danger/5"
                    >
                      <TrashIcon className="h-6 w-6" />
                    </button>
                  )}
                </div>
                <p className="px-1 text-base text-muted">{count ? booksLabel(count) : "Bosh"}</p>
              </div>
            );
          })}
          {renamed && (
            <button
              type="button"
              onClick={() => save(current()).then((ok) => ok && onClose())}
              disabled={busy}
              className="h-14 rounded-xl border-2 border-accent text-xl font-semibold text-accent-strong disabled:opacity-60"
            >
              {busy ? "Duke ruajtur…" : "Ruaj emrat"}
            </button>
          )}
        </section>

        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-lg text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
