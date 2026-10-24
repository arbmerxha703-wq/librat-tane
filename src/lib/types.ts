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

/** One photo of the whole bookcase, with a mark (0–1 of width/height) for each shelf. */
export type LibraryMap = {
  path: string | null;
  marks: Record<string, { x: number; y: number }>;
};
