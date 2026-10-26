"use client";

import { useState } from "react";
import type { Book, NewBook } from "@/lib/types";
import { normalize } from "@/lib/normalize";
import { Modal } from "./Modal";
import { CheckIcon, MinusIcon, PlusIcon } from "./icons";

const inputClass =
  "h-15 w-full rounded-2xl border border-line bg-bg px-4 text-xl outline-none focus:border-gold focus:ring-4 focus:ring-gold/20";

/** Fix a title, or record that a book moved to another shelf or position. */
export function EditBookSheet({
  book,
  shelves,
  busy,
  onSave,
  onClose,
}: {
  book: Book;
  shelves: string[];
  busy: boolean;
  onSave: (patch: Partial<NewBook>) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [shelf, setShelf] = useState(book.shelf);
  const [position, setPosition] = useState(String(book.position));
  const [isRead, setIsRead] = useState(book.is_read);
  const [error, setError] = useState("");

  const movedShelf = normalize(shelf) !== normalize(book.shelf);

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !shelf.trim() || !position) {
      setError("Plotësoni titullin, raftin dhe vendin.");
      return;
    }
    const patch: Partial<NewBook> = {
      title: title.replace(/\s+/g, " ").trim(),
      author: author.replace(/\s+/g, " ").trim(),
      shelf: shelf.trim(),
      position: Number(position),
      is_read: isRead,
    };
    // The old shelf photo no longer shows where the book is.
    if (movedShelf) Object.assign(patch, { photo_path: null, x0: null, x1: null });
    onSave(patch);
  }

  return (
    <Modal title="Ndrysho librin" onClose={onClose}>
      <form onSubmit={save} className="flex flex-col gap-5">
        <div>
          <label htmlFor="edit-title" className="mb-2 block text-lg font-semibold">
            Titulli
          </label>
          <input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} className={`${inputClass} font-serif`} />
        </div>
        <div>
          <label htmlFor="edit-author" className="mb-2 block text-lg font-semibold">
            Autori
          </label>
          <input id="edit-author" value={author} onChange={(e) => setAuthor(e.target.value)} className={inputClass} />
        </div>

        <div className="brass rounded-2xl p-4">
          <p className="eyebrow mb-3 opacity-80">Ku ndodhet libri?</p>
          <label htmlFor="edit-shelf" className="mb-2 block text-lg font-semibold">
            Rafti
          </label>
          {shelves.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Raftet ekzistuese">
              {shelves.map((s) => {
                const active = normalize(s) === normalize(shelf);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setShelf(s)}
                    aria-pressed={active}
                    className={`h-12 min-w-12 rounded-xl px-4 text-xl font-bold ${
                      active ? "bg-accent text-accent-ink" : "bg-card text-ink ring-1 ring-brass-line hover:ring-accent"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          )}
          <input
            id="edit-shelf"
            value={shelf}
            onChange={(e) => setShelf(e.target.value)}
            autoComplete="off"
            className="h-14 w-full rounded-xl border-2 border-brass-line bg-card px-4 text-xl text-ink outline-none focus:border-accent"
          />

          <label htmlFor="edit-position" className="mt-4 mb-2 block text-lg font-semibold">
            Vendi në raft <span className="font-normal opacity-75">(i sati nga e majta)</span>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPosition((p) => String(Math.max(1, (Number(p) || 1) - 1)))}
              aria-label="Një vend më pak"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-card text-ink ring-1 ring-brass-line"
            >
              <MinusIcon className="h-7 w-7" />
            </button>
            <input
              id="edit-position"
              type="number"
              inputMode="numeric"
              min={0}
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="h-14 w-full min-w-0 rounded-xl border-2 border-brass-line bg-card text-center font-serif text-3xl font-bold text-ink outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => setPosition((p) => String((Number(p) || 0) + 1))}
              aria-label="Një vend më shumë"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-card text-ink ring-1 ring-brass-line"
            >
              <PlusIcon className="h-7 w-7" />
            </button>
          </div>
          {movedShelf && book.photo_path && (
            <p className="mt-3 text-base">
              Libri po kalon në raft tjetër: fotoja e vjetër hiqet. Bëni foto raftit të ri që ta shihni prapë të ndriçuar.
            </p>
          )}
        </div>

        <label
          className={`flex min-h-15 cursor-pointer items-center gap-4 rounded-2xl px-4 text-xl font-medium ring-1 ${
            isRead ? "bg-ok/10 text-ok ring-ok/40" : "ring-line"
          }`}
        >
          <input type="checkbox" checked={isRead} onChange={(e) => setIsRead(e.target.checked)} className="sr-only" />
          <span
            aria-hidden
            className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${isRead ? "border-ok bg-ok text-card" : "border-muted"}`}
          >
            {isRead && <CheckIcon className="h-5 w-5" />}
          </span>
          E kam lexuar
        </label>

        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-lg text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="h-16 rounded-2xl bg-accent text-xl font-bold text-accent-ink shadow-card disabled:opacity-60"
        >
          {busy ? "Duke ruajtur…" : "Ruaj ndryshimet"}
        </button>
      </form>
    </Modal>
  );
}
