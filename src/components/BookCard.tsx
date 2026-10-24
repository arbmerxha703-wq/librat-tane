"use client";

import type { Book } from "@/lib/types";
import { matchRanges } from "@/lib/normalize";
import { spineColor } from "@/lib/client";
import { CheckIcon, TrashIcon } from "./icons";
import { SpineThumb } from "./SpineThumb";

export function Highlight({ text, query }: { text: string; query: string }) {
  const ranges = matchRanges(text, query);
  if (ranges.length === 0) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], i) => {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(<mark key={i}>{text.slice(start, end)}</mark>);
    cursor = end;
  });
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}

export function BookCard({
  book,
  query,
  index,
  onToggleRead,
  onDelete,
  onLocate,
  photoUrl,
}: {
  book: Book;
  query: string;
  index: number;
  /** Link to the shelf photo this book was scanned from, if any. */
  photoUrl?: string | null;
  onToggleRead: (book: Book) => void;
  onDelete: (book: Book) => void;
  onLocate: (book: Book) => void;
}) {
  const color = spineColor(book.title);
  return (
    <li
      className="animate-rise flex overflow-hidden rounded-2xl border border-line bg-card shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(80,50,20,0.35)]"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      {/* Book spine */}
      <div aria-hidden className="book-spine relative flex w-9 shrink-0 flex-col items-center py-3" style={{ background: color }}>
        <span className="h-0.5 w-full bg-[#e9cf93]/70" />
        <span className="mt-0.5 h-px w-full bg-[#e9cf93]/50" />
        <span className="mt-3 font-serif text-xl font-bold text-[#fbf1df]">{book.title.trim().charAt(0).toUpperCase()}</span>
        <span className="mt-auto h-px w-full bg-[#e9cf93]/50" />
        <span className="mt-0.5 h-0.5 w-full bg-[#e9cf93]/70" />
      </div>

      <div className="min-w-0 flex-1 p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-2xl font-bold leading-tight break-words">
              <Highlight text={book.title} query={query} />
            </h3>
            {book.author && (
              <p className="mt-1 text-lg text-muted break-words">
                <Highlight text={book.author} query={query} />
              </p>
            )}
          </div>
          {book.is_sample && (
            <span className="shrink-0 rounded-full bg-soft px-2.5 py-1 text-sm font-semibold text-muted">Shembull</span>
          )}
        </div>

        {/* Where to find it — tap to see it on the photos */}
        {photoUrl && book.x0 != null && book.x1 != null ? (
          <button
            type="button"
            onClick={() => onLocate(book)}
            aria-label={`Shiko ku është: rafti ${book.shelf}`}
            className="mt-4 block w-full overflow-hidden rounded-xl border border-line text-left active:scale-[0.99]"
          >
            <SpineThumb url={photoUrl} x0={book.x0} x1={book.x1} />
            <span className="brass flex items-center justify-between gap-2 px-4 py-2.5">
              <span className="text-lg font-bold">📍 Shiko ku është</span>
              <span className="text-sm font-semibold opacity-75">
                Rafti {book.shelf} · i {book.position}-ti
              </span>
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onLocate(book)}
            aria-label={`Rafti ${book.shelf}, vendi ${book.position}. Shiko ku është`}
            className="brass mt-4 block w-full overflow-hidden rounded-xl text-left active:scale-[0.99]"
          >
            <span className="grid grid-cols-2">
              <span className="px-4 py-2 text-center">
                <span className="block text-xs font-bold tracking-[0.18em] opacity-75">RAFTI</span>
                <span className="block font-serif text-4xl leading-none font-bold">{book.shelf}</span>
              </span>
              <span className="border-l border-[color:var(--brass-ink)]/20 px-4 py-2 text-center">
                <span className="block text-xs font-bold tracking-[0.18em] opacity-75">VENDI</span>
                <span className="block font-serif text-4xl leading-none font-bold">{book.position}</span>
              </span>
            </span>
            <span className="flex items-center justify-center gap-1.5 border-t border-[color:var(--brass-ink)]/20 bg-black/5 py-1.5 text-base font-bold">
              📍 Shiko ku është
            </span>
          </button>
        )}

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            aria-pressed={book.is_read}
            onClick={() => onToggleRead(book)}
            className={`flex h-13 flex-1 items-center justify-center gap-2 rounded-xl border-2 px-3 text-lg font-semibold transition-colors ${
              book.is_read ? "border-ok bg-ok/10 text-ok" : "border-line text-muted hover:bg-soft"
            }`}
          >
            <span
              aria-hidden
              className={`flex h-6 w-6 items-center justify-center rounded-md border-2 ${
                book.is_read ? "border-ok bg-ok text-card" : "border-current"
              }`}
            >
              {book.is_read && <CheckIcon className="h-4 w-4" />}
            </span>
            {book.is_read ? "E lexuar" : "E kam lexuar"}
          </button>
          <button
            type="button"
            onClick={() => onDelete(book)}
            aria-label={`Fshi „${book.title}“`}
            className="flex h-13 items-center gap-1.5 rounded-xl px-3 text-lg font-medium text-danger hover:bg-danger/10"
          >
            <TrashIcon className="h-5 w-5" />
            Fshi
          </button>
        </div>
      </div>
    </li>
  );
}
