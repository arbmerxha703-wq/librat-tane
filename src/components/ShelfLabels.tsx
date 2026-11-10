"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import type { Book, LibraryInfo } from "@/lib/types";
import { compareShelves } from "@/lib/normalize";
import { api, booksLabel, getSavedLibrary } from "@/lib/client";
import { getSession } from "@/lib/session";
import { shelfColor, shelfInk } from "@/lib/shelves";

/** The link a QR code opens: one shelf's books, or (no shelf) the whole library, shelf by shelf. */
export function shelfLink(library: string, shelf?: string) {
  const base = `${window.location.origin}/?library=${encodeURIComponent(library)}`;
  return shelf ? `${base}&shelf=${encodeURIComponent(shelf)}` : base;
}

const WHOLE = "\u0000whole";
const qr = (link: string) => QRCode.toString(link, { type: "svg", margin: 0 });

/**
 * A printable sheet of labels: one for the whole library (for the side of a big bookcase) and one per
 * shelf, with the shelf's colour, number and a QR code. Pointing the phone's camera at a label opens
 * those books. Any label can be left out, so a library with many shelves needs only a few.
 */
export function ShelfLabels() {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [libraries, setLibraries] = useState<LibraryInfo[]>([]);
  const [library, setLibrary] = useState(() => getSavedLibrary() ?? "main");
  const [error, setError] = useState("");
  const [codes, setCodes] = useState<Record<string, string>>({});
  /** Labels left out, as "library\u0000shelf" (or the WHOLE key for the library's own label). */
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!getSession()) {
      window.location.replace("/");
      return;
    }
    api<{ books: Book[]; libraries: LibraryInfo[] }>("/api/books").then(
      (r) => {
        setBooks(r.books);
        setLibraries(r.libraries);
      },
      (err) => setError((err as Error).message),
    );
  }, []);

  const current = libraries.find((l) => l.id === library) ?? libraries[0];
  const shelves = useMemo(() => {
    const n = new Map<string, number>();
    for (const b of books ?? []) if (b.library_id === current?.id) n.set(b.shelf, (n.get(b.shelf) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => compareShelves(a[0], b[0]));
  }, [books, current]);

  useEffect(() => {
    if (!current) return;
    let alive = true;
    Promise.all([
      qr(shelfLink(current.id)).then((svg) => [WHOLE, svg] as const),
      ...shelves.map(async ([shelf]) => [shelf, await qr(shelfLink(current.id, shelf))] as const),
    ]).then((list) => alive && setCodes(Object.fromEntries(list)));
    return () => {
      alive = false;
    };
  }, [shelves, current]);

  const key = (shelf: string) => `${current?.id}\u0000${shelf}`;
  const wanted = (shelf: string) => !skipped.has(key(shelf));
  function toggle(shelf: string) {
    setSkipped((prev) => {
      const next = new Set(prev);
      if (!next.delete(key(shelf))) next.add(key(shelf));
      return next;
    });
  }
  function setAllShelves(on: boolean) {
    setSkipped((prev) => {
      const next = new Set(prev);
      for (const [shelf] of shelves) {
        if (on) next.delete(key(shelf));
        else next.add(key(shelf));
      }
      return next;
    });
  }
  const chosenShelves = shelves.filter(([shelf]) => wanted(shelf));
  const wholeWanted = wanted(WHOLE);
  const labelCount = chosenShelves.length + (wholeWanted ? 1 : 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 print:max-w-none print:p-0">
      <div className="flex flex-col gap-4 print:hidden">
        <Link href="/" className="text-lg font-semibold text-accent-strong">
          ← Kthehu te librat
        </Link>
        <h1 className="font-serif text-4xl font-bold">Etiketat për raftet</h1>
        <p className="text-lg text-muted">
          Printojini, prijini dhe ngjitni secilën në vendin e vet. Kur e drejtoni kamerën e telefonit te kodi, hapen ata
          libra. Ngjyra e etiketës është e njëjtë me ngjyrën e raftit në aplikacion.
        </p>
        {libraries.length > 1 && (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Biblioteka">
            {libraries.map((l) => (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={l.id === current?.id}
                onClick={() => setLibrary(l.id)}
                className={`h-12 rounded-full px-4 text-lg font-semibold ${
                  l.id === current?.id ? "bg-accent text-accent-ink" : "bg-card text-ink ring-1 ring-line"
                }`}
              >
                {l.name}
              </button>
            ))}
          </div>
        )}
        {shelves.length > 0 && (
          <section className="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-line">
            <h2 className="text-xl font-bold">Cilat etiketa t&apos;i printoj?</h2>
            <Check checked={wholeWanted} onChange={() => toggle(WHOLE)}>
              <span>
                <strong>Gjithë biblioteka</strong> <span className="text-muted">· një etiketë për anën e bibliotekës</span>
              </span>
            </Check>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="mr-1 text-lg font-semibold">Raftet:</span>
              <button type="button" onClick={() => setAllShelves(true)} className="h-10 rounded-full px-4 text-base font-semibold ring-1 ring-line hover:ring-gold">
                Të gjitha
              </button>
              <button type="button" onClick={() => setAllShelves(false)} className="h-10 rounded-full px-4 text-base font-semibold ring-1 ring-line hover:ring-gold">
                Asnjë
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {shelves.map(([shelf, count]) => (
                <Check key={shelf} checked={wanted(shelf)} onChange={() => toggle(shelf)}>
                  <span aria-hidden className="h-4 w-4 shrink-0 rounded-full" style={{ background: shelfColor(shelf).hex }} />
                  <span>
                    Rafti <strong>{shelf}</strong> <span className="text-base text-muted">({count})</span>
                  </span>
                </Check>
              ))}
            </div>
          </section>
        )}
        {shelves.length > 0 && (
          <button
            type="button"
            onClick={() => window.print()}
            disabled={labelCount === 0}
            className="h-16 rounded-2xl bg-accent text-xl font-bold text-accent-ink shadow-card disabled:opacity-50 sm:w-80"
          >
            {labelCount === 0 ? "Zgjidhni të paktën një" : `Printo ${labelCount === 1 ? "1 etiketë" : `${labelCount} etiketa`}`}
          </button>
        )}
        {error && <p className="rounded-xl bg-danger/10 px-4 py-3 text-lg text-danger">{error}</p>}
        {books && shelves.length === 0 && (
          <p className="rounded-xl bg-soft px-4 py-3 text-lg">Në këtë bibliotekë ende nuk ka libra, prandaj as rafte.</p>
        )}
        {!books && !error && <p className="text-lg text-muted">Duke ngarkuar…</p>}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 print:mt-0 print:grid-cols-3 print:gap-[4mm]">
        {wholeWanted && shelves.length > 0 && (
          <div className="flex break-inside-avoid overflow-hidden rounded-2xl bg-white text-[#1d1a14] ring-1 ring-black/15 sm:col-span-2 print:col-span-2 print:h-[52mm] print:rounded-[3mm]">
            <div
              className="flex w-[55%] flex-col justify-center gap-2 p-4"
              style={{ background: "#17382f", color: "#f3e7c4", printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
            >
              <span className="text-sm font-bold tracking-[0.2em] uppercase opacity-80">Biblioteka</span>
              <span className="font-serif text-3xl leading-tight font-bold break-words">{current?.name}</span>
              <span className="flex flex-wrap gap-1" aria-hidden>
                {shelves.slice(0, 12).map(([shelf]) => (
                  <span key={shelf} className="h-3 w-3 rounded-full" style={{ background: shelfColor(shelf).hex }} />
                ))}
              </span>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-1.5 p-3 text-center">
              <div
                className="aspect-square w-full max-w-[34mm] [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: codes[WHOLE] ?? "" }}
              />
              <span className="text-xs leading-tight font-semibold">Të gjithë librat, raft pas rafti</span>
            </div>
          </div>
        )}
        {chosenShelves.map(([shelf, count]) => {
          const color = shelfColor(shelf);
          return (
            <div
              key={shelf}
              className="flex break-inside-avoid overflow-hidden rounded-2xl bg-white text-[#1d1a14] ring-1 ring-black/15 print:h-[52mm] print:rounded-[3mm]"
            >
              <div
                className="flex w-[38%] flex-col items-center justify-center p-3 text-center"
                style={{ background: color.hex, color: shelfInk(color), printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
              >
                <span className="text-sm font-bold tracking-[0.2em] uppercase">Rafti</span>
                <span className="font-serif text-6xl leading-none font-bold break-all">{shelf}</span>
              </div>
              <div className="flex flex-1 flex-col items-center justify-center gap-1.5 p-3 text-center">
                <div
                  className="aspect-square w-full max-w-[30mm] [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: codes[shelf] ?? "" }}
                />
                <span className="text-xs leading-tight font-semibold">{current?.name}</span>
                <span className="text-[0.65rem] leading-tight text-black/60 print:hidden">{booksLabel(count)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label
      className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-lg ring-1 ${
        checked ? "bg-accent/10 ring-accent" : "ring-line"
      }`}
    >
      <input type="checkbox" checked={checked} onChange={onChange} className="h-6 w-6 shrink-0 accent-[var(--accent)]" />
      <span className="flex items-center gap-2">{children}</span>
    </label>
  );
}
