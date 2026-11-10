"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import type { Book, LibraryInfo } from "@/lib/types";
import { compareShelves } from "@/lib/normalize";
import { api, booksLabel, getSavedLibrary } from "@/lib/client";
import { getSession } from "@/lib/session";
import { shelfColor, shelfInk } from "@/lib/shelves";

/** The link a shelf's QR code opens: the app, showing only that shelf's books. */
export function shelfLink(library: string, shelf: string) {
  return `${window.location.origin}/?library=${encodeURIComponent(library)}&shelf=${encodeURIComponent(shelf)}`;
}

/**
 * A printable sheet of labels, one per shelf: the shelf's colour and number, and a QR code. Stuck on
 * the real shelf, pointing the phone's camera at it opens the list of books on that shelf.
 */
export function ShelfLabels() {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [libraries, setLibraries] = useState<LibraryInfo[]>([]);
  const [library, setLibrary] = useState(() => getSavedLibrary() ?? "main");
  const [error, setError] = useState("");
  const [codes, setCodes] = useState<Record<string, string>>({});

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
    Promise.all(
      shelves.map(async ([shelf]) => [shelf, await QRCode.toString(shelfLink(current.id, shelf), { type: "svg", margin: 0 })] as const),
    ).then((list) => alive && setCodes(Object.fromEntries(list)));
    return () => {
      alive = false;
    };
  }, [shelves, current]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 print:max-w-none print:p-0">
      <div className="flex flex-col gap-4 print:hidden">
        <Link href="/" className="text-lg font-semibold text-accent-strong">
          ← Kthehu te librat
        </Link>
        <h1 className="font-serif text-4xl font-bold">Etiketat për raftet</h1>
        <p className="text-lg text-muted">
          Printojini, prijini dhe ngjitni secilën në raftin e vet. Kur e drejtoni kamerën e telefonit te kodi, hapen
          librat e atij rafti. Ngjyra e etiketës është e njëjtë me ngjyrën e raftit në aplikacion.
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
          <button
            type="button"
            onClick={() => window.print()}
            className="h-16 rounded-2xl bg-accent text-xl font-bold text-accent-ink shadow-card sm:w-72"
          >
            Printo etiketat
          </button>
        )}
        {error && <p className="rounded-xl bg-danger/10 px-4 py-3 text-lg text-danger">{error}</p>}
        {books && shelves.length === 0 && (
          <p className="rounded-xl bg-soft px-4 py-3 text-lg">Në këtë bibliotekë ende nuk ka libra, prandaj as rafte.</p>
        )}
        {!books && !error && <p className="text-lg text-muted">Duke ngarkuar…</p>}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 print:mt-0 print:grid-cols-3 print:gap-[4mm]">
        {shelves.map(([shelf, count]) => {
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
