"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Book } from "@/lib/types";
import { compareByLocation, compareShelves, matchesQuery } from "@/lib/normalize";
import { api, ApiError, booksLabel, getSavedPasscode, savePasscode } from "@/lib/client";
import { PasscodeScreen } from "./PasscodeScreen";
import { BookCard } from "./BookCard";
import { AddBookSheet } from "./AddBookSheet";
import { ShelfScanSheet } from "./ShelfScanSheet";
import { LocateSheet } from "./LocateSheet";
import { ConfirmDialog } from "./Modal";
import { BookOpenIcon, CameraIcon, CheckIcon, CloseIcon, PlusIcon, SearchIcon, ShelvesIcon, SparkleIcon } from "./icons";

type Filter = "all" | "read" | "unread";

export function Library() {
  const [passcode, setPasscode] = useState<string | null>(getSavedPasscode);
  const [reloadTick, setReloadTick] = useState(0);
  const [lockNotice, setLockNotice] = useState("");
  const [books, setBooks] = useState<Book[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [byShelf, setByShelf] = useState(false);
  const [adding, setAdding] = useState(false);
  const [scanningShelf, setScanningShelf] = useState(false);
  const [toDelete, setToDelete] = useState<Book | null>(null);
  const [locating, setLocating] = useState<Book | null>(null);
  // Short-lived links to shelf photos, for the close-ups on the book cards.
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [removingSamples, setRemovingSamples] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const lock = useCallback((notice = "") => {
    savePasscode(null);
    setPasscode(null);
    setBooks(null);
    setLockNotice(notice);
  }, []);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) lock("Kodi ka ndryshuar. Shkruajeni përsëri.");
      else setToast((err as Error).message);
    },
    [lock],
  );

  useEffect(() => {
    if (!passcode) return;
    const run = () =>
      api<{ books: Book[] }>("/api/books", passcode).then(
        ({ books }) => {
          setBooks(books);
          setLoadError("");
        },
        (err) => {
          if (err instanceof ApiError && err.status === 401) lock();
          else setLoadError((err as Error).message);
        },
      );
    run();
    // Pick up books added on the other phone when this one is reopened.
    const onVisible = () => document.visibilityState === "visible" && run();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [passcode, lock, reloadTick]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const shelves = useMemo(
    () => [...new Set((books ?? []).map((b) => b.shelf))].sort(compareShelves),
    [books],
  );

  const counts = useMemo(() => {
    const all = books?.length ?? 0;
    const read = books?.filter((b) => b.is_read).length ?? 0;
    return { all, read, unread: all - read };
  }, [books]);

  const visible = useMemo(() => {
    const list = (books ?? []).filter(
      (b) => (filter === "all" || (filter === "read") === b.is_read) && matchesQuery(b, query),
    );
    return byShelf
      ? list.sort(compareByLocation)
      : list.sort((a, b) => a.title.localeCompare(b.title, "sq", { sensitivity: "base" }));
  }, [books, filter, query, byShelf]);

  // Fetch links for the shelf photos of the books on screen (first 60), 20 at a time.
  const missingPaths = useMemo(
    () =>
      [...new Set(visible.slice(0, 60).map((b) => b.photo_path).filter((p): p is string => !!p))].filter(
        (p) => !(p in photoUrls),
      ),
    [visible, photoUrls],
  );
  useEffect(() => {
    if (!passcode || missingPaths.length === 0) return;
    let alive = true;
    const batches = [];
    for (let i = 0; i < missingPaths.length; i += 20) batches.push(missingPaths.slice(i, i + 20));
    Promise.all(
      batches.map((paths) =>
        api<{ urls: Record<string, string> }>("/api/photos", passcode, { method: "POST", body: JSON.stringify({ paths }) }),
      ),
    ).then(
      (results) => {
        if (!alive) return;
        // Paths with no link (e.g. a deleted photo) are remembered as "" so they aren't asked for again.
        const found = Object.assign({}, ...results.map((r) => r.urls));
        setPhotoUrls((prev) => ({ ...prev, ...Object.fromEntries(missingPaths.map((p) => [p, found[p] ?? ""])) }));
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [missingPaths, passcode]);

  const groups = useMemo(() => {
    const map = new Map<string, Book[]>();
    for (const b of visible) map.set(b.shelf, [...(map.get(b.shelf) ?? []), b]);
    return [...map.entries()];
  }, [visible]);

  const sampleCount = books?.filter((b) => b.is_sample).length ?? 0;

  async function toggleRead(book: Book) {
    if (!passcode) return;
    setBooks((prev) => prev?.map((b) => (b.id === book.id ? { ...b, is_read: !b.is_read } : b)) ?? null);
    try {
      await api(`/api/books/${book.id}`, passcode, {
        method: "PATCH",
        body: JSON.stringify({ is_read: !book.is_read }),
      });
    } catch (err) {
      setBooks((prev) => prev?.map((b) => (b.id === book.id ? book : b)) ?? null);
      handleError(err);
    }
  }

  async function confirmDelete() {
    if (!passcode || !toDelete) return;
    setBusy(true);
    try {
      await api(`/api/books/${toDelete.id}`, passcode, { method: "DELETE" });
      setBooks((prev) => prev?.filter((b) => b.id !== toDelete.id) ?? null);
      setToast(`„${toDelete.title}“ u fshi.`);
      setToDelete(null);
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  async function changeSamples(method: "POST" | "DELETE") {
    if (!passcode) return;
    setBusy(true);
    try {
      const { books } = await api<{ books: Book[] }>("/api/samples", passcode, { method });
      setBooks(books);
      setToast(method === "POST" ? "U shtuan librat shembull." : "Librat shembull u hoqën.");
      setRemovingSamples(false);
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  if (passcode === null) {
    return (
      <PasscodeScreen
        notice={lockNotice}
        onUnlock={(code) => {
          savePasscode(code);
          setPasscode(code);
        }}
      />
    );
  }

  const filters: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "Të gjitha", count: counts.all },
    { value: "read", label: "Lexuar", count: counts.read },
    { value: "unread", label: "Pa lexuar", count: counts.unread },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 pb-40">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-4 pt-5">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-ink shadow-card">
            <BookOpenIcon className="h-7 w-7" />
          </span>
          <div className="leading-tight">
            <p className="font-serif text-2xl font-bold">Librat Tanë</p>
            <p className="text-sm font-medium text-muted">Biblioteka e shtëpisë</p>
          </div>
        </div>
        {books && (
          <div className="text-right leading-tight">
            <p className="font-serif text-2xl font-bold tabular-nums">{counts.all}</p>
            <p className="text-sm font-medium text-muted">{counts.all === 1 ? "libër" : "libra"}</p>
          </div>
        )}
      </header>

      <h1 className="mt-8 font-serif text-[2rem] leading-tight font-bold sm:text-4xl">Çfarë libri kërkoni?</h1>
      <p className="mt-1 text-lg text-muted">Shkruani një pjesë të titullit ose të autorit.</p>

      {/* Search */}
      <div className="sticky top-0 z-20 -mx-4 bg-bg/90 px-4 pt-3 pb-3 backdrop-blur-md">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-5 h-7 w-7 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="p.sh. Kadare"
            aria-label="Kërko titullin ose autorin"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            className="h-17 w-full rounded-2xl border border-line bg-card pr-16 pl-15 text-2xl shadow-card outline-none placeholder:text-muted/60 focus:border-accent focus:ring-4 focus:ring-accent/15 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Pastro kërkimin"
              className="absolute top-1/2 right-2 flex h-13 w-13 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-soft"
            >
              <CloseIcon className="h-7 w-7" />
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="mt-1 flex flex-col gap-3">
        <div role="radiogroup" aria-label="Shfaq" className="grid grid-cols-3 gap-1 rounded-2xl bg-soft p-1">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={`flex h-15 flex-col items-center justify-center rounded-xl leading-tight transition-colors ${
                filter === f.value ? "bg-card text-ink shadow-card" : "text-muted hover:text-ink"
              }`}
            >
              <span className="text-lg font-semibold whitespace-nowrap">{f.label}</span>
              <span className={`text-sm font-semibold tabular-nums ${filter === f.value ? "text-accent" : ""}`}>{f.count}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 px-1">
          <p className="text-lg text-muted">
            {books && (query || filter !== "all") ? booksLabel(visible.length) : ""}
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={byShelf}
            onClick={() => setByShelf((v) => !v)}
            className="flex h-12 shrink-0 items-center gap-3 rounded-full px-2 text-lg font-semibold"
          >
            <ShelvesIcon className={`h-6 w-6 ${byShelf ? "text-accent" : "text-muted"}`} />
            Sipas rafteve
            <span aria-hidden className={`relative h-7 w-12 rounded-full transition-colors ${byShelf ? "bg-accent" : "bg-line"}`}>
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${byShelf ? "left-[22px]" : "left-0.5"}`}
              />
            </span>
          </button>
        </div>
      </div>

      <main className="mt-4" aria-live="polite">
        {books === null ? (
          <div className="py-12 text-center text-xl text-muted">
            {loadError ? (
              <>
                <p>{loadError}</p>
                <button
                  type="button"
                  onClick={() => setReloadTick((t) => t + 1)}
                  className="mt-4 h-14 rounded-xl bg-accent px-6 font-semibold text-accent-ink"
                >
                  Provo përsëri
                </button>
              </>
            ) : (
              <LoadingShelf />
            )}
          </div>
        ) : books.length === 0 ? (
          <EmptyCatalog
            busy={busy}
            onAdd={() => setAdding(true)}
            onScanShelf={() => setScanningShelf(true)}
            onSamples={() => changeSamples("POST")}
          />
        ) : visible.length === 0 ? (
          <div className="animate-rise rounded-3xl border border-dashed border-line px-6 py-12 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-soft text-muted">
              <SearchIcon className="h-8 w-8" />
            </span>
            <p className="mt-4 font-serif text-2xl font-bold">Nuk u gjet asnjë libër</p>
            <p className="mt-2 text-lg text-muted">
              {query ? "Provoni vetëm një fjalë, p.sh. mbiemrin e autorit." : "Asnjë libër në këtë listë."}
            </p>
          </div>
        ) : byShelf ? (
          <div className="flex flex-col gap-8">
            {groups.map(([shelf, list]) => (
              <section key={shelf} aria-label={`Rafti ${shelf}`}>
                <h2 className="mb-3 flex items-baseline justify-between gap-3 border-b border-line pb-2">
                  <span className="font-serif text-2xl font-bold">Rafti {shelf}</span>
                  <span className="text-base font-medium text-muted">{booksLabel(list.length)}</span>
                </h2>
                <BookList books={list} query={query} onToggleRead={toggleRead} onDelete={setToDelete} onLocate={setLocating} photoUrls={photoUrls} />
              </section>
            ))}
          </div>
        ) : (
          <BookList books={visible} query={query} onToggleRead={toggleRead} onDelete={setToDelete} onLocate={setLocating} photoUrls={photoUrls} />
        )}
      </main>

      {sampleCount > 0 && (
        <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-line bg-card p-5 shadow-card">
          <p className="flex gap-3 text-lg">
            <SparkleIcon className="mt-1 h-6 w-6 shrink-0 text-gold" />
            <span>
              Në katalog ka <strong>{booksLabel(sampleCount)} shembull</strong>, për të provuar aplikacionin.
            </span>
          </p>
          <button
            type="button"
            onClick={() => setRemovingSamples(true)}
            className="h-13 w-full rounded-xl border border-danger/40 text-lg font-semibold text-danger hover:bg-danger/5"
          >
            Hiq librat shembull
          </button>
        </div>
      )}

      {books && books.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/85 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-lg">
          <div className="mx-auto grid max-w-2xl grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setScanningShelf(true)}
              className="flex h-16 items-center justify-center gap-2 rounded-2xl border border-line bg-card text-xl font-bold text-ink shadow-card active:scale-[0.99]"
            >
              <CameraIcon className="h-7 w-7 shrink-0 text-accent" />
              Foto e raftit
            </button>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-accent text-xl font-bold text-accent-ink shadow-card active:scale-[0.99]"
            >
              <PlusIcon className="h-7 w-7 shrink-0" />
              Shto libër
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="animate-rise fixed inset-x-4 bottom-28 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-5 py-4 text-lg text-bg shadow-xl"
        >
          <CheckIcon className="h-6 w-6 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {adding && (
        <AddBookSheet
          books={books ?? []}
          shelves={shelves}
          passcode={passcode}
          onClose={() => setAdding(false)}
          onSaved={(book) => {
            setBooks((prev) => [...(prev ?? []), book]);
            setToast(`„${book.title}“ u ruajt — Rafti ${book.shelf}, Vendi ${book.position}.`);
          }}
        />
      )}

      {scanningShelf && (
        <ShelfScanSheet
          books={books ?? []}
          shelves={shelves}
          passcode={passcode}
          onClose={() => setScanningShelf(false)}
          onSaved={(saved) => setBooks((prev) => [...(prev ?? []), ...saved])}
        />
      )}

      {locating && passcode && (
        <LocateSheet book={locating} passcode={passcode} onClose={() => setLocating(null)} />
      )}

      {toDelete && (
        <ConfirmDialog
          title="Ta fshijmë?"
          message={
            <>
              Libri <strong>„{toDelete.title}“</strong> do të hiqet nga katalogu.
            </>
          }
          confirmLabel="Po, fshije"
          busy={busy}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}

      {removingSamples && (
        <ConfirmDialog
          title="Hiq librat shembull?"
          message={`Do të hiqen ${booksLabel(sampleCount)} shembull. Librat tuaj nuk preken.`}
          confirmLabel="Po, hiqi"
          busy={busy}
          onConfirm={() => changeSamples("DELETE")}
          onCancel={() => setRemovingSamples(false)}
        />
      )}
    </div>
  );
}

function BookList({
  books,
  query,
  onToggleRead,
  onDelete,
  onLocate,
  photoUrls,
}: {
  books: Book[];
  query: string;
  onToggleRead: (b: Book) => void;
  onDelete: (b: Book) => void;
  onLocate: (b: Book) => void;
  photoUrls: Record<string, string>;
}) {
  return (
    <ul className="flex flex-col gap-4">
      {books.map((b, i) => (
        <BookCard
          key={b.id}
          book={b}
          query={query}
          index={i}
          onToggleRead={onToggleRead}
          onDelete={onDelete}
          onLocate={onLocate}
          photoUrl={b.photo_path ? photoUrls[b.photo_path] || null : null}
        />
      ))}
    </ul>
  );
}

function LoadingShelf() {
  return (
    <div className="flex flex-col gap-4" aria-label="Duke ngarkuar librat">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-36 animate-pulse rounded-2xl bg-soft" />
      ))}
    </div>
  );
}

function EmptyCatalog({
  busy,
  onAdd,
  onScanShelf,
  onSamples,
}: {
  busy: boolean;
  onAdd: () => void;
  onScanShelf: () => void;
  onSamples: () => void;
}) {
  return (
    <div className="animate-rise overflow-hidden rounded-3xl border border-line bg-card shadow-card">
      <div className="wood flex flex-col items-center px-6 pt-8 pb-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/20">
          <BookOpenIcon className="h-9 w-9" />
        </span>
        <p className="mt-4 font-serif text-3xl font-bold">Biblioteka është bosh</p>
        <p className="mt-2 text-lg text-white/80">
          Mënyra më e shpejtë: bëni foto një rafti dhe librat shtohen të gjithë njëherësh.
        </p>
      </div>
      <div className="flex flex-col gap-3 p-5">
        <button
          type="button"
          onClick={onScanShelf}
          className="flex h-17 items-center justify-center gap-3 rounded-2xl bg-accent text-xl font-bold text-accent-ink shadow-card"
        >
          <CameraIcon className="h-8 w-8" />
          Fotografo një raft
        </button>
        <button
          type="button"
          onClick={onAdd}
          className="flex h-16 items-center justify-center gap-2 rounded-2xl border border-line text-xl font-semibold text-ink hover:bg-soft"
        >
          <PlusIcon className="h-7 w-7 text-accent" />
          Shto një libër
        </button>
        <button
          type="button"
          onClick={onSamples}
          disabled={busy}
          className="flex h-13 items-center justify-center gap-2 rounded-2xl text-lg font-semibold text-muted disabled:opacity-60"
        >
          <SparkleIcon className="h-6 w-6" />
          {busy ? "Duke shtuar…" : "Provo me 10 libra shembull"}
        </button>
      </div>
    </div>
  );
}
