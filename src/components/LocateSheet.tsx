"use client";

import { useEffect, useState } from "react";
import type { Book } from "@/lib/types";
import { api } from "@/lib/client";
import { Modal } from "./Modal";
import { ShelfPhoto } from "./ShelfPhoto";
import { LibraryMap } from "./LibraryMap";

/** "Ku është?" — where a book stands: the shelf on the bookcase photo, then the book on the shelf photo. */
export function LocateSheet({ book, passcode, onClose }: { book: Book; passcode: string; onClose: () => void }) {
  const [shelfUrl, setShelfUrl] = useState<string | null>(null);
  const [markShelf, setMarkShelf] = useState(false);

  useEffect(() => {
    if (!book.photo_path) return;
    let alive = true;
    api<{ urls: Record<string, string> }>("/api/photos", passcode, {
      method: "POST",
      body: JSON.stringify({ paths: [book.photo_path] }),
    }).then(
      ({ urls }) => alive && setShelfUrl(urls[book.photo_path!] ?? null),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [book.photo_path, passcode]);

  const highlight = book.x0 != null && book.x1 != null ? { x0: book.x0, x1: book.x1 } : null;

  return (
    <Modal title="Ku është?" onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div>
          <h3 className="font-serif text-2xl leading-tight font-bold">{book.title}</h3>
          {book.author && <p className="mt-1 text-lg text-muted">{book.author}</p>}
        </div>

        <div className="brass grid grid-cols-2 overflow-hidden rounded-2xl text-center">
          <div className="px-4 py-3">
            <div className="text-sm font-bold tracking-[0.18em] opacity-75">RAFTI</div>
            <div className="font-serif text-5xl leading-none font-bold">{book.shelf}</div>
          </div>
          <div className="border-l border-[color:var(--brass-ink)]/20 px-4 py-3">
            <div className="text-sm font-bold tracking-[0.18em] opacity-75">VENDI</div>
            <div className="font-serif text-5xl leading-none font-bold">{book.position}</div>
          </div>
        </div>
        <p className="-mt-2 text-center text-lg">
          Libri i <strong>{book.position}-të</strong> nga e <strong>majta</strong> në Raftin {book.shelf}.
        </p>

        <section className="flex flex-col gap-2">
          <h4 className="text-lg font-semibold">1. Rafti në bibliotekë</h4>
          <LibraryMap passcode={passcode} shelf={book.shelf} editable={markShelf} />
          <button
            type="button"
            onClick={() => setMarkShelf((v) => !v)}
            className="self-start text-base font-semibold text-accent-strong underline"
          >
            {markShelf ? "Mbaro shënimin" : "Shëno ose ndrysho ku është ky raft"}
          </button>
        </section>

        <section className="flex flex-col gap-2">
          <h4 className="text-lg font-semibold">2. Libri në raft</h4>
          {shelfUrl ? (
            <>
              <ShelfPhoto url={shelfUrl} highlight={highlight} />
              {!highlight && (
                <p className="text-base text-muted">Ky libër u shtua me dorë, prandaj s’ndriçohet në foto.</p>
              )}
            </>
          ) : (
            <p className="rounded-xl bg-soft px-4 py-3 text-base text-muted">
              {book.photo_path
                ? "Duke ngarkuar foton…"
                : "Për këtë libër s’ka foto. Kur ta fotografoni raftin me “Foto e raftit”, këtu do ta shihni të ndriçuar."}
            </p>
          )}
        </section>
      </div>
    </Modal>
  );
}
