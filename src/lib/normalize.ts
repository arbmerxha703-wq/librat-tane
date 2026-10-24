import type { Book } from "./types";

/** Lowercase and strip accents, so "ë" matches "e" and "ç" matches "c". */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Every word typed must appear somewhere in the title or author (partial words allowed). */
export function matchesQuery(book: Book, query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalize(`${book.title} ${book.author}`);
  return words.every((w) => haystack.includes(w));
}

/** Character ranges of `text` that match the query words, ignoring accents — used to highlight results. */
export function matchRanges(text: string, query: string): [number, number][] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  let folded = "";
  const origin: number[] = [];
  for (let i = 0; i < text.length; i++) {
    for (const c of text[i].normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()) {
      folded += c;
      origin.push(i);
    }
  }
  const ranges: [number, number][] = [];
  for (const w of words) {
    for (let at = folded.indexOf(w); at !== -1; at = folded.indexOf(w, at + w.length)) {
      ranges.push([origin[at], origin[at + w.length - 1] + 1]);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  return merged;
}

/** Natural sort for shelf names: "2" before "10", "A" before "B". */
export function compareShelves(a: string, b: string): number {
  return a.localeCompare(b, "sq", { numeric: true, sensitivity: "base" });
}

export function compareByLocation(a: Book, b: Book): number {
  return compareShelves(a.shelf, b.shelf) || a.position - b.position;
}
