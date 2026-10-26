"use client";

import { useState } from "react";
import type { Book } from "@/lib/types";
import { getBorrowers, loanInfo } from "@/lib/client";
import { Modal } from "./Modal";
import { LendIcon, PencilIcon, ReturnIcon, TrashIcon } from "./icons";

/** "⋯ Më shumë" for one book: lend / return, edit, delete. */
export function BookMenuSheet({
  book,
  busy,
  onLend,
  onReturn,
  onEdit,
  onDelete,
  onClose,
}: {
  book: Book;
  busy: boolean;
  onLend: (name: string) => void;
  onReturn: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const loan = loanInfo(book);
  const [lending, setLending] = useState(false);
  const [name, setName] = useState("");
  const [borrowers] = useState(getBorrowers);

  const bigButton =
    "flex h-16 w-full items-center gap-4 rounded-2xl px-5 text-left text-xl font-semibold ring-1 ring-line hover:bg-soft disabled:opacity-60";

  return (
    <Modal title={book.title} onClose={onClose}>
      <div className="flex flex-col gap-3">
        {book.author && <p className="-mt-2 mb-1 text-lg text-muted">{book.author}</p>}

        {loan ? (
          <div className={`rounded-2xl p-4 ring-1 ${loan.late ? "bg-danger/8 ring-danger/40" : "brass"}`}>
            <p className={`text-lg font-semibold ${loan.late ? "text-danger" : ""}`}>Libri është dhënë hua</p>
            <p className="mt-1 text-xl">{loan.text}</p>
            {loan.late && <p className="mt-1 text-base text-danger">Ka kaluar më shumë se një muaj.</p>}
            <button
              type="button"
              disabled={busy}
              onClick={onReturn}
              className="mt-3 flex h-15 w-full items-center justify-center gap-3 rounded-2xl bg-accent text-xl font-bold text-accent-ink disabled:opacity-60"
            >
              <ReturnIcon className="h-7 w-7" />
              {busy ? "Duke ruajtur…" : "U kthye në raft"}
            </button>
          </div>
        ) : lending ? (
          <form
            className="rounded-2xl p-4 ring-1 ring-line"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) onLend(name.trim());
            }}
          >
            <label htmlFor="borrower" className="block text-lg font-semibold">
              Kujt ia dhatë librin?
            </label>
            {borrowers.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {borrowers.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setName(b)}
                    aria-pressed={name === b}
                    className={`h-11 rounded-full px-4 text-lg font-semibold ring-1 ${
                      name === b ? "bg-accent text-accent-ink ring-accent" : "ring-line hover:bg-soft"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            )}
            <input
              id="borrower"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Emri, p.sh. Agimi"
              autoComplete="off"
              autoFocus
              className="mt-3 h-15 w-full rounded-2xl border border-line bg-bg px-4 text-xl outline-none focus:border-gold focus:ring-4 focus:ring-gold/20"
            />
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <button
                type="submit"
                disabled={busy || !name.trim()}
                className="h-15 rounded-2xl bg-accent text-xl font-bold text-accent-ink disabled:opacity-50"
              >
                {busy ? "Duke ruajtur…" : "Ruaj"}
              </button>
              <button type="button" onClick={() => setLending(false)} className="h-15 rounded-2xl px-5 text-lg font-semibold ring-1 ring-line">
                Anulo
              </button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setLending(true)} className={bigButton}>
            <LendIcon className="h-7 w-7 text-gold" />
            E dhashë hua
          </button>
        )}

        <button type="button" onClick={onEdit} className={bigButton}>
          <PencilIcon className="h-7 w-7 text-gold" />
          Ndrysho të dhënat
        </button>
        <button type="button" onClick={onDelete} className={`${bigButton} text-danger`}>
          <TrashIcon className="h-7 w-7" />
          Fshi librin
        </button>
      </div>
    </Modal>
  );
}
