"use client";

import { useRef, useState } from "react";
import type { Book } from "@/lib/types";
import { normalize } from "@/lib/normalize";
import { api, getLastShelf, nextPosition, photoToBase64, saveLastShelf } from "@/lib/client";
import { Modal } from "./Modal";
import { CameraIcon, CheckIcon, MinusIcon, PlusIcon } from "./icons";

const inputClass =
  "h-16 w-full rounded-2xl border-2 border-line bg-bg px-4 text-xl outline-none focus:border-accent";

export function AddBookSheet({
  books,
  shelves,
  passcode,
  onSaved,
  onClose,
}: {
  books: Book[];
  shelves: string[];
  passcode: string;
  onSaved: (book: Book) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [shelf, setShelf] = useState(getLastShelf);
  const [position, setPosition] = useState(() => String(nextPosition(books, getLastShelf())));
  const [positionTouched, setPositionTouched] = useState(false);
  const [isRead, setIsRead] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; kind: "error" | "info" } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  function changeShelf(value: string) {
    setShelf(value);
    if (!positionTouched) setPosition(String(nextPosition(books, value)));
  }

  function stepPosition(delta: number) {
    setPosition((p) => String(Math.max(1, (Number(p) || 0) + delta)));
    setPositionTouched(true);
  }

  async function scanCover(file: File | undefined) {
    if (!file) return;
    setScanning(true);
    setMessage(null);
    try {
      const image = await photoToBase64(file);
      const result = await api<{ title: string; author: string }>("/api/scan", passcode, {
        method: "POST",
        body: JSON.stringify({ image, mediaType: "image/jpeg" }),
      });
      setTitle(result.title);
      setAuthor(result.author);
      setMessage({ text: "U lexua! Kontrolloni titullin, pastaj zgjidhni raftin dhe vendin.", kind: "info" });
    } catch (err) {
      setMessage({ text: (err as Error).message, kind: "error" });
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save(addAnother: boolean) {
    if (!title.trim() || !shelf.trim() || position === "") {
      setMessage({ text: "Plotësoni titullin, raftin dhe vendin.", kind: "error" });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const { book } = await api<{ book: Book }>("/api/books", passcode, {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          author: author.trim(),
          shelf: shelf.trim(),
          position: Number(position),
          is_read: isRead,
        }),
      });
      saveLastShelf(book.shelf);
      onSaved(book);
      if (!addAnother) return onClose();
      // Same shelf, next slot: the usual way to catalogue a shelf book by book.
      setTitle("");
      setAuthor("");
      setIsRead(false);
      setPosition(String(book.position + 1));
      setPositionTouched(false);
      setMessage({ text: `„${book.title}“ u ruajt. Shtoni librin tjetër.`, kind: "info" });
      titleRef.current?.focus();
    } catch (err) {
      setMessage({ text: (err as Error).message, kind: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Shto libër" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(false);
        }}
        className="flex flex-col gap-6"
      >
        <input
          ref={fileRef}
          id="cover-photo-input"
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          disabled={scanning}
          onChange={(e) => scanCover(e.target.files?.[0])}
        />
        <label
          htmlFor="cover-photo-input"
          aria-disabled={scanning}
          className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed border-accent bg-soft/60 p-4 text-left ${
            scanning ? "pointer-events-none opacity-70" : ""
          }`}
        >
          <span
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-ink ${scanning ? "animate-pulse" : ""}`}
          >
            <CameraIcon className="h-8 w-8" />
          </span>
          <span>
            <span className="block text-xl font-bold text-accent-strong">
              {scanning ? "Duke lexuar kopertinën…" : "Fotografo kopertinën"}
            </span>
            <span className="block text-base text-muted">Titulli dhe autori plotësohen vetë</span>
          </span>
        </label>

        {message && (
          <p
            role={message.kind === "error" ? "alert" : "status"}
            className={`rounded-xl px-4 py-3 text-lg ${
              message.kind === "error" ? "bg-danger/10 text-danger" : "bg-ok/10 text-ok"
            }`}
          >
            {message.text}
          </p>
        )}

        <div className="flex items-center gap-3 text-sm font-semibold tracking-[0.15em] text-muted uppercase">
          <span className="h-px flex-1 bg-line" />
          ose shkruajeni
          <span className="h-px flex-1 bg-line" />
        </div>

        <Field label="Titulli" htmlFor="title">
          <input
            ref={titleRef}
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoComplete="off"
            className={`${inputClass} font-serif`}
          />
        </Field>
        <Field label="Autori" htmlFor="author">
          <input
            id="author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            autoComplete="off"
            className={inputClass}
          />
        </Field>

        <div className="brass rounded-2xl p-4">
          <p className="mb-3 text-sm font-bold tracking-[0.18em] uppercase opacity-80">Ku vendoset libri?</p>

          <label htmlFor="shelf" className="mb-2 block text-lg font-semibold">
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
                    onClick={() => changeShelf(s)}
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
            id="shelf"
            value={shelf}
            onChange={(e) => changeShelf(e.target.value)}
            placeholder={shelves.length ? "ose shkruani një raft të ri" : "p.sh. 3"}
            autoComplete="off"
            className="h-14 w-full rounded-xl border-2 border-brass-line bg-card px-4 text-xl text-ink outline-none placeholder:text-muted focus:border-accent"
          />

          <label htmlFor="position" className="mt-4 mb-2 block text-lg font-semibold">
            Vendi në raft <span className="font-normal opacity-75">(i sati nga e majta)</span>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => stepPosition(-1)}
              aria-label="Një vend më pak"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-card text-ink ring-1 ring-brass-line hover:ring-accent"
            >
              <MinusIcon className="h-7 w-7" />
            </button>
            <input
              id="position"
              type="number"
              inputMode="numeric"
              min={1}
              value={position}
              onChange={(e) => {
                setPosition(e.target.value);
                setPositionTouched(true);
              }}
              className="h-14 w-full min-w-0 rounded-xl border-2 border-brass-line bg-card text-center font-serif text-3xl font-bold text-ink outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => stepPosition(1)}
              aria-label="Një vend më shumë"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-card text-ink ring-1 ring-brass-line hover:ring-accent"
            >
              <PlusIcon className="h-7 w-7" />
            </button>
          </div>
        </div>

        <label
          className={`flex min-h-16 cursor-pointer items-center gap-4 rounded-2xl border-2 px-4 text-xl font-medium transition-colors ${
            isRead ? "border-ok bg-ok/10 text-ok" : "border-line"
          }`}
        >
          <input type="checkbox" checked={isRead} onChange={(e) => setIsRead(e.target.checked)} className="sr-only" />
          <span
            aria-hidden
            className={`flex h-8 w-8 items-center justify-center rounded-lg border-2 ${
              isRead ? "border-ok bg-ok text-card" : "border-muted"
            }`}
          >
            {isRead && <CheckIcon className="h-5 w-5" />}
          </span>
          E kam lexuar
        </label>

        <div className="flex flex-col gap-3">
          <button
            type="submit"
            disabled={saving || scanning}
            className="h-16 rounded-2xl bg-accent text-xl font-bold text-accent-ink shadow-md disabled:opacity-60"
          >
            {saving ? "Duke ruajtur…" : "Ruaj"}
          </button>
          <button
            type="button"
            onClick={() => save(true)}
            disabled={saving || scanning}
            className="h-16 rounded-2xl border-2 border-accent text-xl font-semibold text-accent-strong disabled:opacity-60"
          >
            Ruaj dhe shto tjetër
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-lg font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}
