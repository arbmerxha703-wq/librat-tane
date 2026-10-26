"use client";

import type { Book } from "@/lib/types";
import { matchRanges } from "@/lib/normalize";
import { loanInfo, spineColor } from "@/lib/client";
import { CheckIcon, DotsIcon, LendIcon, MapPinIcon } from "./icons";
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
  onMore,
  onLocate,
  photoUrl,
}: {
  book: Book;
  query: string;
  index: number;
  /** Link to the shelf photo this book was scanned from, if any. */
  photoUrl?: string | null;
  onToggleRead: (book: Book) => void;
  /** Opens "⋯": lend / return, edit, delete. */
  onMore: (book: Book) => void;
  onLocate: (book: Book) => void;
}) {
  const color = spineColor(book.title);
  const hasPhoto = !!photoUrl && book.x0 != null && book.x1 != null;
  const where = `Rafti ${book.shelf} · i ${book.position}-ti`;
  const loan = loanInfo(book);

  return (
    <li
      className="animate-rise overflow-hidden rounded-[1.75rem] bg-card p-2 shadow-card ring-1 ring-line/70"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      {/* The book's spine, cut from the shelf photo — tap to see where it stands */}
      {hasPhoto && (
        <button
          type="button"
          onClick={() => onLocate(book)}
          aria-label={`Shiko ku është: ${where}`}
          className="relative block w-full overflow-hidden rounded-[1.35rem] text-left"
        >
          <SpineThumb url={photoUrl!} x0={book.x0!} x1={book.x1!} />
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-base font-semibold text-white ring-1 ring-white/25 backdrop-blur-md">
            <MapPinIcon className="h-4 w-4 text-[#f0dca8]" />
            {where}
          </span>
        </button>
      )}

      <div className="flex gap-4 px-3 pt-4 pb-3">
        {!hasPhoto && (
          // A small "cover" so books without a photo still read as books at a glance.
          <div
            aria-hidden
            className="book-spine relative flex h-22 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg font-serif text-3xl font-bold text-white/90 shadow-card"
            style={{ background: color }}
          >
            <span className="absolute inset-x-2 top-2 h-px bg-[#f0dca8]/60" />
            {book.title.trim().charAt(0).toUpperCase()}
            <span className="absolute inset-x-2 bottom-2 h-px bg-[#f0dca8]/60" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-[1.65rem] leading-tight font-bold break-words">
            <Highlight text={book.title} query={query} />
          </h3>
          {book.author && (
            <p className="mt-1 text-lg text-muted break-words">
              <Highlight text={book.author} query={query} />
            </p>
          )}
          {loan && (
            <button
              type="button"
              onClick={() => onMore(book)}
              className={`mt-3 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-base font-semibold ring-1 ${
                loan.late ? "bg-danger/10 text-danger ring-danger/40" : "brass"
              }`}
            >
              <LendIcon className="h-5 w-5" />
              {loan.text}
            </button>
          )}
          {(!hasPhoto || book.is_sample) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {!hasPhoto && (
                <span className="brass inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-base font-semibold">
                  <MapPinIcon className="h-4 w-4" />
                  {where}
                </span>
              )}
              {book.is_sample && (
                <span className="inline-flex items-center rounded-full bg-soft px-3 py-1 text-base font-semibold text-muted">
                  Shembull
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onLocate(book)}
          className="flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-[1.2rem] bg-accent text-lg font-bold whitespace-nowrap text-accent-ink active:scale-[0.99]"
        >
          <MapPinIcon className="h-6 w-6" />
          Ku është?
        </button>
        <button
          type="button"
          aria-pressed={book.is_read}
          onClick={() => onToggleRead(book)}
          className={`flex h-14 shrink-0 items-center gap-1.5 rounded-[1.2rem] px-3 text-base font-semibold whitespace-nowrap ring-1 transition-colors ${
            book.is_read ? "bg-ok/10 text-ok ring-ok/40" : "text-muted ring-line hover:bg-soft"
          }`}
        >
          <span
            aria-hidden
            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
              book.is_read ? "border-ok bg-ok text-card" : "border-current"
            }`}
          >
            {book.is_read && <CheckIcon className="h-4 w-4" />}
          </span>
          Lexuar
        </button>
        <button
          type="button"
          onClick={() => onMore(book)}
          aria-label={`Më shumë për „${book.title}“: hua, ndrysho, fshi`}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.2rem] text-ink ring-1 ring-line hover:bg-soft"
        >
          <DotsIcon className="h-7 w-7" />
        </button>
      </div>
    </li>
  );
}
