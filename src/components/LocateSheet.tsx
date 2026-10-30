"use client";

import { useEffect, useState } from "react";
import type { Book } from "@/lib/types";
import { api } from "@/lib/client";
import { Modal } from "./Modal";
import { ShelfPhoto } from "./ShelfPhoto";
import { ShelfOnMap } from "./LibraryMap";

/**
 * "Ku është?" — pictures first, so nobody has to count shelves: the library photo with a red circle on
 * the shelf, then the shelf photo with the book lit up. The numbers stay as a small note.
 */
export function LocateSheet({ book, onClose }: { book: Book; onClose: () => void }) {
  const [shelfUrl, setShelfUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!book.photo_path) return;
    let alive = true;
    api<{ urls: Record<string, string> }>("/api/photos", {
      method: "POST",
      body: JSON.stringify({ paths: [book.photo_path] }),
    }).then(
      ({ urls }) => alive && setShelfUrl(urls[book.photo_path!] ?? null),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [book.photo_path]);

  const highlight = book.x0 != null && book.x1 != null ? { x0: book.x0, x1: book.x1 } : null;

  return (
    <Modal title="Ku është?" onClose={onClose}>
      <div className="flex flex-col gap-6">
        <div>
          <h3 className="font-serif text-2xl leading-tight font-bold">{book.title}</h3>
          {book.author && <p className="mt-1 text-lg text-muted">{book.author}</p>}
        </div>

        <section className="flex flex-col gap-2">
          <h4 className="flex items-center gap-2 text-xl font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-base text-white">1</span>
            Rafti — te rrethi i kuq
          </h4>
          <ShelfOnMap shelf={book.shelf} />
        </section>

        <section className="flex flex-col gap-2">
          <h4 className="flex items-center gap-2 text-xl font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e0a92e] text-base text-white">2</span>
            Libri — ai që ndriçon
          </h4>
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

        <p className="rounded-xl bg-soft px-4 py-3 text-center text-lg">
          Rafti <strong>{book.shelf}</strong> · libri i <strong>{book.position}-të</strong> nga e majta
        </p>
      </div>
    </Modal>
  );
}
