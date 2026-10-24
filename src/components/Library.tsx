"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Book } from "@/lib/types";
import { compareByLocation, compareShelves, matchesQuery } from "@/lib/normalize";
import { api, ApiError, booksLabel, getSavedPasscode, savePasscode } from "@/lib/client";
import { PasscodeScreen } from "./PasscodeScreen";
import { BookCard } from "./BookCard";
import { AddBookSheet } from "./AddBookSheet";
import { ShelfScanSheet } from "./ShelfScanSheet";
import { ConfirmDialog } from "./Modal";
import { BookIcon, CameraIcon, CheckIcon, CloseIcon, PlusIcon, SearchIcon, ShelfDecoration, ShelvesIcon, SparkleIcon } from "./icons";

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
      {/* Header: a wooden shelf */}
      <header className="wood relative mt-4 overflow-hidden rounded-3xl px-5 pt-5 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-[#f3dfae]/80 uppercase">Biblioteka e shtëpisë</p>
            <h1 className="mt-1 font-serif text-4xl leading-tight font-bold sm:text-5xl">Librat Tanë</h1>
          </div>
          <BookIcon className="mt-1 h-9 w-9 shrink-0 text-[#f3dfae]/80" />
        </div>
        <p className="mt-2 text-lg text-[#fbf1df]/85">
          {books ? (
            <>
              <strong className="font-semibold text-[#fbf1df]">{booksLabel(counts.all)}</strong> në{" "}
              {shelves.length === 1 ? "1 raft" : `${shelves.length} rafte`}
            </>
          ) : (
            "Duke ngarkuar…"
          )}
        </p>
        <ShelfDecoration className="mt-4 ml-1" />
        <div aria-hidden className="-mx-5 h-3 bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]" />
      </header>

      {/* Search */}
      <div className="sticky top-0 z-20 -mx-4 mt-4 bg-gradient-to-b from-bg via-bg to-bg/0 px-4 pt-2 pb-4">
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-xl bg-accent text-accent-ink"
          >
            <SearchIcon className="h-7 w-7" />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kërko librin…"
            aria-label="Kërko titullin ose autorin"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            className="h-18 w-full rounded-2xl border-2 border-line bg-card pr-16 pl-18 text-2xl shadow-[0_10px_30px_-15px_rgba(80,50,20,0.45)] outline-none placeholder:text-muted/70 focus:border-accent [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Pastro kërkimin"
              className="absolute top-1/2 right-2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-soft"
            >
              <CloseIcon className="h-7 w-7" />
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div role="radiogroup" aria-label="Shfaq" className="grid grid-cols-3 gap-1 rounded-2xl border border-line bg-soft p-1.5">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={`flex h-16 flex-col items-center justify-center rounded-xl leading-tight transition-colors ${
                filter === f.value ? "bg-card text-accent-strong shadow-md" : "text-muted hover:text-ink"
              }`}
            >
              <span className="text-lg font-semibold">{f.label}</span>
              <span className="text-sm font-medium opacity-80">{f.count}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={byShelf}
          onClick={() => setByShelf((v) => !v)}
          className={`flex h-16 items-center gap-3 rounded-2xl border-2 px-4 text-lg font-semibold transition-colors ${
            byShelf ? "border-accent bg-card" : "border-line bg-card"
          }`}
        >
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${byShelf ? "bg-accent text-accent-ink" : "bg-soft text-muted"}`}
          >
            <ShelvesIcon className="h-6 w-6" />
          </span>
          <span className="flex-1 text-left">Sipas rafteve</span>
          <span aria-hidden className={`relative h-8 w-14 rounded-full transition-colors ${byShelf ? "bg-accent" : "bg-line"}`}>
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${byShelf ? "left-7" : "left-1"}`}
            />
          </span>
        </button>
      </div>

      <main className="mt-6" aria-live="polite">
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
          <div className="animate-rise rounded-3xl border border-dashed border-line bg-card/60 px-6 py-10 text-center">
            <SearchIcon className="mx-auto h-12 w-12 text-muted/60" />
            <p className="mt-3 font-serif text-2xl font-bold">Nuk u gjet asnjë libër</p>
            <p className="mt-2 text-lg text-muted">
              {query ? "Provoni vetëm një fjalë, p.sh. mbiemrin e autorit." : "Asnjë libër në këtë listë."}
            </p>
          </div>
        ) : (
          <>
            {(query || filter !== "all") && (
              <p className="mb-3 px-1 text-lg text-muted">
                {visible.length === 1 ? "U gjet 1 libër" : `U gjetën ${visible.length} libra`}
              </p>
            )}
            {byShelf ? (
              <div className="flex flex-col gap-8">
                {groups.map(([shelf, list]) => (
                  <section key={shelf} aria-label={`Rafti ${shelf}`}>
                    <h2 className="wood mb-4 flex items-center justify-between rounded-2xl px-5 py-3 shadow-md">
                      <span className="font-serif text-3xl font-bold">Rafti {shelf}</span>
                      <span className="rounded-full bg-black/25 px-3 py-1 text-base font-semibold">
                        {booksLabel(list.length)}
                      </span>
                    </h2>
                    <BookList books={list} query={query} onToggleRead={toggleRead} onDelete={setToDelete} />
                  </section>
                ))}
              </div>
            ) : (
              <BookList books={visible} query={query} onToggleRead={toggleRead} onDelete={setToDelete} />
            )}
          </>
        )}
      </main>

      {sampleCount > 0 && (
        <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-line bg-soft p-4">
          <p className="flex gap-3 text-lg">
            <SparkleIcon className="mt-1 h-6 w-6 shrink-0 text-accent" />
            <span>
              Në katalog ka <strong>{booksLabel(sampleCount)} shembull</strong>, për të provuar aplikacionin.
            </span>
          </p>
          <button
            type="button"
            onClick={() => setRemovingSamples(true)}
            className="h-14 w-full rounded-xl border-2 border-danger bg-card text-lg font-semibold text-danger"
          >
            Hiq librat shembull
          </button>
        </div>
      )}

      {books && books.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-bg via-bg/95 to-transparent px-4 pt-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto grid max-w-2xl grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setScanningShelf(true)}
              className="flex h-18 items-center justify-center gap-2 rounded-2xl border-2 border-accent bg-card text-xl font-bold text-accent-strong shadow-[0_12px_30px_-12px_rgba(80,50,20,0.5)] active:scale-[0.99]"
            >
              <CameraIcon className="h-7 w-7 shrink-0" />
              Foto e raftit
            </button>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex h-18 items-center justify-center gap-2 rounded-2xl bg-accent text-xl font-bold text-accent-ink shadow-[0_12px_30px_-10px_rgba(80,50,20,0.7)] active:scale-[0.99]"
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
          className="animate-rise fixed inset-x-4 bottom-32 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-5 py-4 text-lg text-bg shadow-xl"
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
}: {
  books: Book[];
  query: string;
  onToggleRead: (b: Book) => void;
  onDelete: (b: Book) => void;
}) {
  return (
    <ul className="flex flex-col gap-4">
      {books.map((b, i) => (
        <BookCard key={b.id} book={b} query={query} index={i} onToggleRead={onToggleRead} onDelete={onDelete} />
      ))}
    </ul>
  );
}

function LoadingShelf() {
  return (
    <div className="flex flex-col items-center gap-4">
      <ShelfDecoration className="animate-pulse" />
      <p>Duke ngarkuar librat…</p>
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
    <div className="animate-rise rounded-3xl border border-line bg-card p-6 text-center shadow-sm">
      <ShelfDecoration className="mx-auto w-fit opacity-90" />
      <div aria-hidden className="wood mx-auto h-2.5 w-64 max-w-full rounded-sm" />
      <p className="mt-6 font-serif text-3xl font-bold">Raftet janë bosh</p>
      <p className="mt-2 text-lg text-muted">
        Mënyra më e shpejtë: bëni foto një rafti të tërë dhe librat shtohen të gjithë njëherësh.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={onScanShelf}
          className="flex h-18 items-center justify-center gap-3 rounded-2xl bg-accent text-xl font-bold text-accent-ink shadow-md"
        >
          <CameraIcon className="h-8 w-8" />
          Fotografo një raft
        </button>
        <button
          type="button"
          onClick={onAdd}
          className="flex h-16 items-center justify-center gap-2 rounded-2xl border-2 border-accent text-xl font-semibold text-accent-strong"
        >
          <PlusIcon className="h-7 w-7" />
          Shto libër
        </button>
        <button
          type="button"
          onClick={onSamples}
          disabled={busy}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl text-lg font-semibold text-muted disabled:opacity-60"
        >
          <SparkleIcon className="h-6 w-6" />
          {busy ? "Duke shtuar…" : "Shto 10 libra shembull"}
        </button>
      </div>
    </div>
  );
}
