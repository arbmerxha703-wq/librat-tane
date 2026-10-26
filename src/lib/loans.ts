import "server-only";
import { getStore } from "./store";
import type { Book } from "./types";

/**
 * Who has a book on loan. Kept as one small JSON setting (book id → loan) rather than
 * extra book columns, so it needs no database change.
 */
export type Loan = { to: string; at: string };
type Loans = Record<string, Loan>;

const KEY = "loans";

export function getLoans(): Promise<Loans> {
  return getStore().getSetting<Loans>(KEY, {});
}

export async function setLoan(bookId: string, loan: Loan | null): Promise<void> {
  const loans = await getLoans();
  if (loan) loans[bookId] = loan;
  else if (bookId in loans) delete loans[bookId];
  else return;
  await getStore().setSetting(KEY, loans);
}

/** Adds loaned_to / loaned_at to books that are out on loan. */
export function withLoans(books: Book[], loans: Loans): Book[] {
  return books.map((b) => (loans[b.id] ? { ...b, loaned_to: loans[b.id].to, loaned_at: loans[b.id].at } : b));
}
