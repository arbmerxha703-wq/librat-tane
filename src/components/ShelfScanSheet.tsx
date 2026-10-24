"use client";

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Book, NewBook } from "@/lib/types";
import { normalize } from "@/lib/normalize";
import { api, ApiError, booksLabel, getLastShelf, nextPosition, prepareShelfPhoto, saveLastShelf } from "@/lib/client";
import { Modal } from "./Modal";
import { ShelfPhoto } from "./ShelfPhoto";
import { ShelfPicker } from "./LibraryMap";
import { CameraIcon, CheckIcon, CloseIcon, MinusIcon, PlusIcon, ShelvesIcon } from "./icons";

type Draft = { key: number; title: string; author: string; x0: number | null; x1: number | null; readable: boolean };
type Step = "setup" | "scanning" | "review" | "done";
type ScanResult = {
  books: { title: string; author: string; x0: number | null; x1: number | null }[];
  photoPath: string | null;
  photoUrl: string | null;
};

const PHOTO_INPUT_ID = "shelf-photo-input";
const MAX_WAITS = 3;

export function ShelfScanSheet({
  books,
  shelves,
  passcode,
  onSaved,
  onClose,
}: {
  books: Book[];
  shelves: string[];
  passcode: string;
  onSaved: (books: Book[]) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("setup");
  // Start on the last shelf used on this phone; otherwise the shelf is picked on the library photo.
  const [shelf, setShelf] = useState(getLastShelf);
  const [startPos, setStartPos] = useState(() => nextPosition(books, getLastShelf()));
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [photo, setPhoto] = useState<{ path: string | null; url: string | null }>({ path: null, url: null });
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<{ count: number; from: number; to: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nextKey = useRef(0);
  const focusKey = useRef<number | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Titles already in the catalog, to warn about photographing the same books twice.
  const existing = useMemo(() => {
    const map = new Map<string, Book>();
    for (const b of books) map.set(normalize(b.title), b);
    return map;
  }, [books]);

  // Put the cursor in a book that was just added by hand.
  useEffect(() => {
    if (focusKey.current == null) return;
    document.getElementById(`draft-title-${focusKey.current}`)?.focus();
    focusKey.current = null;
  }, [drafts]);

  function changeShelf(value: string) {
    setShelf(value);
    setStartPos(nextPosition(books, value));
  }

  async function scan(file: File | undefined) {
    if (!file) return;
    setStep("scanning");
    setError("");
    setWaitSeconds(0);
    try {
      const payload = JSON.stringify(await prepareShelfPhoto(file));
      let result: ScanResult | null = null;
      for (let attempt = 0; !result; attempt++) {
        try {
          result = await api<ScanResult>("/api/scan-shelf", passcode, { method: "POST", body: payload });
        } catch (err) {
          // The free photo-reading service allows about one shelf photo a minute: wait, then try again.
          if (!(err instanceof ApiError && err.status === 429 && attempt < MAX_WAITS)) throw err;
          for (let s = err.retryAfter ?? 30; s > 0; s--) {
            if (!alive.current) return;
            setWaitSeconds(s);
            await new Promise((r) => setTimeout(r, 1000));
          }
          setWaitSeconds(0);
        }
      }
      if (!alive.current) return;
      setDrafts(
        result.books.map((b) => ({ ...b, key: nextKey.current++, readable: !!b.title })),
      );
      setPhoto({ path: result.photoPath, url: result.photoUrl });
      setStep("review");
    } catch (err) {
      if (!alive.current) return;
      setError((err as Error).message);
      setStep("setup");
    } finally {
      setWaitSeconds(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function updateDraft(key: number, patch: Partial<Draft>) {
    setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  /** Adds an empty book at `index` (a book the photo reading missed); the ones after it move up one place. */
  function insertAt(index: number) {
    const key = nextKey.current++;
    focusKey.current = key;
    setDrafts((list) => [
      ...list.slice(0, index),
      { key, title: "", author: "", x0: null, x1: null, readable: true },
      ...list.slice(index),
    ]);
  }

  async function saveAll() {
    const missingIndex = drafts.findIndex((d) => !d.title.trim());
    if (missingIndex !== -1) {
      setError(`Shkruani titullin e librit te vendi ${startPos + missingIndex}, ose hiqeni me ×.`);
      document.getElementById(`draft-title-${drafts[missingIndex].key}`)?.focus();
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload: NewBook[] = drafts.map((d, i) => ({
        title: d.title.replace(/\s+/g, " ").trim(),
        author: d.author.replace(/\s+/g, " ").trim(),
        shelf: shelf.trim(),
        position: startPos + i,
        is_read: false,
        photo_path: photo.path,
        x0: d.x0,
        x1: d.x1,
      }));
      const { books: saved } = await api<{ books: Book[] }>("/api/books/bulk", passcode, {
        method: "POST",
        body: JSON.stringify({ books: payload }),
      });
      saveLastShelf(shelf.trim());
      onSaved(saved);
      const lastPos = startPos + drafts.length - 1;
      setLastSaved({ count: saved.length, from: startPos, to: lastPos });
      setStartPos(lastPos + 1);
      setDrafts([]);
      setStep("done");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const unreadable = drafts.filter((d) => !d.title.trim()).length;
  const markers = drafts.flatMap((d, i) =>
    d.x0 != null && d.x1 != null ? [{ key: d.key, label: startPos + i, x0: d.x0, x1: d.x1 }] : [],
  );

  return (
    <Modal title="Fotografo raftin" onClose={onClose}>
      <input
        ref={fileRef}
        id={PHOTO_INPUT_ID}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => scan(e.target.files?.[0])}
      />

      {error && step !== "setup" && (
        <p role="alert" className="mb-5 rounded-xl bg-danger/10 px-4 py-3 text-lg text-danger">
          {error}
        </p>
      )}

      {step === "setup" && (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h3 className="flex items-center gap-3 text-xl font-bold">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-lg text-accent-ink">1</span>
              Ku është rafti?
            </h3>
            <ShelfPicker passcode={passcode} shelves={shelves} shelf={shelf} onPick={changeShelf} />

            <details className="rounded-2xl border border-line bg-soft/40 px-4 py-3">
              <summary className="cursor-pointer text-base font-semibold text-muted">Ose zgjidhni raftin me numër</summary>
              <div className="brass mt-3 rounded-2xl p-4">
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
                  id="scan-shelf"
                  value={shelf}
                  onChange={(e) => changeShelf(e.target.value)}
                  placeholder={shelves.length ? "ose shkruani një raft të ri" : "p.sh. 1"}
                  aria-label="Rafti"
                  autoComplete="off"
                  className="h-14 w-full rounded-xl border-2 border-brass-line bg-card px-4 text-xl text-ink outline-none placeholder:text-muted focus:border-accent"
                />
              </div>
            </details>
          </section>

          {shelf.trim() && (
            <section className="flex flex-col gap-3">
              <h3 className="flex items-center gap-3 text-xl font-bold">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-lg text-accent-ink">2</span>
                Bëj foto raftit
              </h3>
              <p className="rounded-xl bg-soft px-4 py-3 text-base text-muted">
                Qëndroni <strong className="text-ink">drejt përballë</strong> raftit, rreth <strong className="text-ink">15 libra</strong>{" "}
                në një foto, me dritë të mirë. Raft i gjatë? Fotografojeni pjesë-pjesë, nga e majta në të djathtë.
              </p>

              <details className="text-base text-muted">
                <summary className="cursor-pointer">
                  Libri i parë në foto ruhet si i <strong className="text-ink">{startPos}-ti</strong> në raftin {shelf}{" "}
                  <span className="underline">(ndrysho)</span>
                </summary>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStartPos((p) => Math.max(1, p - 1))}
                    aria-label="Një vend më pak"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-soft"
                  >
                    <MinusIcon className="h-6 w-6" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={startPos}
                    onChange={(e) => setStartPos(Math.max(1, Number(e.target.value) || 1))}
                    aria-label="Vendi i librit të parë"
                    className="h-12 w-full min-w-0 rounded-xl border-2 border-line bg-bg text-center font-serif text-2xl font-bold outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setStartPos((p) => p + 1)}
                    aria-label="Një vend më shumë"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-soft"
                  >
                    <PlusIcon className="h-6 w-6" />
                  </button>
                </div>
              </details>

              {error && (
                <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-lg text-danger">
                  {error}
                </p>
              )}

              <label
                htmlFor={PHOTO_INPUT_ID}
                onClick={() => setError("")}
                className="flex h-18 cursor-pointer items-center justify-center gap-3 rounded-2xl bg-accent text-2xl font-bold text-accent-ink shadow-md active:scale-[0.99]"
              >
                <CameraIcon className="h-8 w-8" />
                Bëj foto raftit
              </label>
            </section>
          )}
        </div>
      )}

      {step === "scanning" && (
        <div className="flex flex-col items-center gap-5 py-10 text-center" role="status">
          <span className="flex h-20 w-20 animate-pulse items-center justify-center rounded-3xl bg-accent text-accent-ink">
            <ShelvesIcon className="h-11 w-11" />
          </span>
          {waitSeconds > 0 ? (
            <>
              <p className="font-serif text-2xl font-bold">Po pres {waitSeconds} sekonda…</p>
              <p className="text-lg text-muted">
                Shërbimi falas lexon rreth një foto në minutë. Vazhdon vetë, mos e mbyllni ekranin.
              </p>
            </>
          ) : (
            <>
              <p className="font-serif text-2xl font-bold">Duke lexuar shpinat e librave…</p>
              <p className="text-lg text-muted">Kjo zgjat disa sekonda. Mos e mbyllni ekranin.</p>
            </>
          )}
        </div>
      )}

      {step === "review" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-ok/10 px-4 py-3 text-lg text-ok">
            U gjetën <strong>{booksLabel(drafts.length)}</strong> në Raftin {shelf}.
            {unreadable > 0 && (
              <span className="mt-1 block text-danger">
                {unreadable === 1 ? "1 libër s’ka titull" : `${unreadable} libra s’kanë titull`} — shkruajeni ose hiqeni me ×.
              </span>
            )}
          </div>

          {photo.url && (
            <>
              <ShelfPhoto
                url={photo.url}
                markers={markers}
                onMarkerClick={(key) =>
                  document.getElementById(`draft-${key}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
                }
              />
              <p className="text-base text-muted">
                Çdo libër i gjetur ka një <strong>numër</strong> në foto. Nëse një libër s’ka numër, prekni{" "}
                <strong>“+ Shto libër këtu”</strong> në vendin e tij. Nëse diçka s’është libër, hiqeni me ×.
              </p>
            </>
          )}

          <ul className="flex flex-col">
            <InsertHere onClick={() => insertAt(0)} />
            {drafts.map((d, i) => {
              const dup = d.title.trim() ? existing.get(normalize(d.title)) : undefined;
              const position = startPos + i;
              return (
                <Fragment key={d.key}>
                  <li
                    id={`draft-${d.key}`}
                    className={`flex gap-2 rounded-2xl border-2 bg-card p-2.5 ${
                      d.title.trim() ? "border-line" : "border-dashed border-danger/60"
                    }`}
                  >
                    <div className="brass flex w-12 shrink-0 flex-col items-center justify-center rounded-xl py-1">
                      <span className="text-[0.55rem] font-bold tracking-[0.1em]">VENDI</span>
                      <span className="font-serif text-2xl leading-none font-bold">{position}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <AutoTextarea
                        id={`draft-title-${d.key}`}
                        value={d.title}
                        onChange={(e) => updateDraft(d.key, { title: e.target.value })}
                        placeholder={d.readable ? "Shkruani titullin" : "Titulli (nuk u lexua)"}
                        aria-label={`Titulli i librit te vendi ${position}`}
                        className="w-full resize-none overflow-hidden rounded-lg border-2 border-transparent bg-transparent px-2 py-1.5 font-serif text-xl leading-snug font-bold outline-none placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:text-danger focus:border-accent focus:bg-bg"
                      />
                      <AutoTextarea
                        value={d.author}
                        onChange={(e) => updateDraft(d.key, { author: e.target.value })}
                        placeholder="Autori"
                        aria-label={`Autori i librit te vendi ${position}`}
                        className="w-full resize-none overflow-hidden rounded-lg border-2 border-transparent bg-transparent px-2 py-1 text-lg leading-snug text-muted outline-none focus:border-accent focus:bg-bg"
                      />
                      {dup && (
                        <p className="px-2 text-sm text-danger">
                          Ky titull ekziston: Rafti {dup.shelf}, Vendi {dup.position}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setDrafts((list) => list.filter((x) => x.key !== d.key))}
                      aria-label={`Hiq librin te vendi ${position}`}
                      className="-mr-1 flex h-12 w-10 shrink-0 items-center justify-center self-center rounded-full text-muted hover:bg-danger/10 hover:text-danger"
                    >
                      <CloseIcon className="h-6 w-6" />
                    </button>
                  </li>
                  <InsertHere onClick={() => insertAt(i + 1)} />
                </Fragment>
              );
            })}
          </ul>

          <div className="sticky -bottom-6 -mx-6 -mb-6 flex flex-col gap-2 border-t border-line bg-card px-6 pt-3 pb-6 shadow-[0_-10px_20px_-12px_rgba(80,50,20,0.35)]">
            {error && <p className="text-base text-danger">{error}</p>}
            <button
              type="button"
              onClick={saveAll}
              disabled={saving || drafts.length === 0}
              className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-accent text-xl font-bold text-accent-ink shadow-md disabled:opacity-60"
            >
              <CheckIcon className="h-6 w-6" />
              {saving ? "Duke ruajtur…" : `Ruaj ${booksLabel(drafts.length)}`}
            </button>
            <button
              type="button"
              onClick={() => {
                setDrafts([]);
                setError("");
                setStep("setup");
              }}
              className="h-12 rounded-2xl text-lg font-semibold text-muted"
            >
              Bëj foto prapë
            </button>
          </div>
        </div>
      )}

      {step === "done" && lastSaved && (
        <div className="flex flex-col gap-4 text-center">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-ok text-card">
            <CheckIcon className="h-11 w-11" />
          </span>
          <p className="font-serif text-2xl font-bold">U ruajtën {booksLabel(lastSaved.count)}</p>
          <p className="text-lg text-muted">
            Rafti {shelf}, vendet {lastSaved.from}–{lastSaved.to}
          </p>
          <div className="mt-2 flex flex-col gap-3">
            <label
              htmlFor={PHOTO_INPUT_ID}
              onClick={() => setStep("setup")}
              className="flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-xl font-bold text-accent-ink"
            >
              <CameraIcon className="h-7 w-7" />
              Vazhdo këtë raft (nga vendi {startPos})
            </label>
            <button
              type="button"
              onClick={() => {
                setShelf("");
                setStartPos(1);
                setStep("setup");
              }}
              className="h-16 rounded-2xl border-2 border-accent text-xl font-semibold text-accent-strong"
            >
              Raft tjetër
            </button>
            <button type="button" onClick={onClose} className="h-14 rounded-2xl text-lg font-semibold text-muted">
              Mbaro
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function InsertHere({ onClick }: { onClick: () => void }) {
  return (
    <li className="flex justify-center py-1">
      <button
        type="button"
        onClick={onClick}
        className="flex h-10 items-center gap-1.5 rounded-full px-4 text-base font-semibold text-accent-strong hover:bg-soft"
      >
        <PlusIcon className="h-5 w-5" />
        Shto libër këtu
      </button>
    </li>
  );
}

/** Multi-line text field that grows with its content, so long titles stay fully visible. */
function AutoTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      enterKeyHint="done"
      onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
      {...props}
    />
  );
}
