export type Book = {
  id: string;
  title: string;
  author: string;
  shelf: string;
  position: number;
  is_read: boolean;
  is_sample: boolean;
  created_at: string;
  /** Photo of the shelf the book was scanned from (storage path), if any. */
  photo_path?: string | null;
  /** Left and right edge of the spine in that photo, 0–1000 of its width. */
  x0?: number | null;
  x1?: number | null;
  /** Who borrowed the book and when (ISO date), if it is out on loan. */
  loaned_to?: string;
  loaned_at?: string;
};

export type NewBook = {
  title: string;
  author: string;
  shelf: string;
  position: number;
  is_read: boolean;
  photo_path?: string | null;
  x0?: number | null;
  x1?: number | null;
};

/** A photo of (part of) the library, with a mark (0–1 of width/height) for each shelf on it. */
export type Zone = {
  id: string;
  name: string;
  path: string;
  marks: Record<string, { x: number; y: number }>;
};

/** The big library can need several photos ("zones"), e.g. one per wall. */
export type LibraryMap = { zones: Zone[] };
