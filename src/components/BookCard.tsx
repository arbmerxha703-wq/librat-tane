"use client";

import type { Book } from "@/lib/types";
import { matchRanges } from "@/lib/normalize";
import { spineColor } from "@/lib/client";
import { CheckIcon, MapPinIcon, TrashIcon } from "./icons";
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
  const hasPhoto = !!photoUrl && book.x0 != null && book.x1 != null;
  const where = `Rafti ${book.shelf} · i ${book.position}-ti`;

  return (
    <li
      className="animate-rise overflow-hidden rounded-2xl border border-line bg-card shadow-card"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      {/* The book's spine, cut from the shelf photo — tap to see where it stands */}
      {hasPhoto && (
        <button
          type="button"
          onClick={() => onLocate(book)}
          aria-label={`Shiko ku është: ${where}`}
          className="relative block w-full text-left"
        >
          <SpineThumb url={photoUrl!} x0={book.x0!} x1={book.x1!} />
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-1 text-base font-semibold text-white backdrop-blur-sm">
            <MapPinIcon className="h-4 w-4" />
            {where}
          </span>
        </button>
      )}

      <div className="flex gap-4 p-4">
        {!hasPhoto && (
          // A small "cover" so books without a photo still read as books at a glance.
          <div
            aria-hidden
            className="book-spine flex h-20 w-14 shrink-0 items-center justify-center rounded-md font-serif text-2xl font-bold text-white/90 shadow-card"
            style={{ background: color }}
          >
            {book.title.trim().charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className="min-w-0 flex-1 font-serif text-2xl leading-tight font-bold break-words">
              <Highlight text={book.title} query={query} />
            </h3>
            {book.is_sample && (
              <span className="shrink-0 rounded-full bg-soft px-2.5 py-0.5 text-sm font-semibold text-muted">Shembull</span>
            )}
          </div>
          {book.author && (
            <p className="mt-1 text-lg text-muted break-words">
              <Highlight text={book.author} query={query} />
            </p>
          )}
          {!hasPhoto && (
            <p className="brass mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-base font-semibold">
              <MapPinIcon className="h-4 w-4" />
              {where}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_auto] border-t border-line">
        <button
          type="button"
          onClick={() => onLocate(book)}
          className="flex h-14 items-center justify-center gap-2 text-lg font-bold text-accent-strong hover:bg-soft active:bg-soft"
        >
          <MapPinIcon className="h-6 w-6" />
          Ku është?
        </button>
        <button
          type="button"
          aria-pressed={book.is_read}
          onClick={() => onToggleRead(book)}
          className={`flex h-14 items-center gap-2 border-l border-line px-4 text-lg font-semibold hover:bg-soft ${
            book.is_read ? "text-ok" : "text-muted"
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
          Lexuar
        </button>
        <button
          type="button"
          onClick={() => onDelete(book)}
          aria-label={`Fshi „${book.title}“`}
          className="flex h-14 w-14 items-center justify-center border-l border-line text-muted hover:bg-danger/10 hover:text-danger"
        >
          <TrashIcon className="h-6 w-6" />
        </button>
      </div>
    </li>
  );
}
