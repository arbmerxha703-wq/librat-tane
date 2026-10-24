import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Book, NewBook } from "./types";

const TABLE = "books";

export interface Store {
  list(): Promise<Book[]>;
  add(book: NewBook, isSample?: boolean): Promise<Book>;
  addMany(books: NewBook[], isSample?: boolean): Promise<Book[]>;
  update(id: string, patch: Partial<NewBook>): Promise<Book>;
  remove(id: string): Promise<void>;
  removeSamples(): Promise<void>;
}

class SupabaseStore implements Store {
  constructor(private db: SupabaseClient) {}

  async list() {
    const { data, error } = await this.db.from(TABLE).select("*").order("created_at");
    if (error) throw error;
    return data as Book[];
  }

  async add(book: NewBook, isSample = false) {
    const [created] = await this.addMany([book], isSample);
    return created;
  }

  async addMany(books: NewBook[], isSample = false) {
    const rows = books.map((b) => ({ ...b, is_sample: isSample }));
    const { data, error } = await this.db.from(TABLE).insert(rows).select("*");
    if (error) throw error;
    return data as Book[];
  }

  async update(id: string, patch: Partial<NewBook>) {
    const { data, error } = await this.db.from(TABLE).update(patch).eq("id", id).select("*").single();
    if (error) throw error;
    return data as Book;
  }

  async remove(id: string) {
    const { error } = await this.db.from(TABLE).delete().eq("id", id);
    if (error) throw error;
  }

  async removeSamples() {
    const { error } = await this.db.from(TABLE).delete().eq("is_sample", true);
    if (error) throw error;
  }
}

/** Local-development fallback when Supabase isn't configured. Data is lost on restart. */
class MemoryStore implements Store {
  private books: Book[] = [];

  async list() {
    return [...this.books];
  }

  async add(book: NewBook, isSample = false) {
    const created: Book = {
      ...book,
      id: crypto.randomUUID(),
      is_sample: isSample,
      created_at: new Date().toISOString(),
    };
    this.books.push(created);
    return created;
  }

  async addMany(books: NewBook[], isSample = false) {
    const created: Book[] = [];
    for (const b of books) created.push(await this.add(b, isSample));
    return created;
  }

  async update(id: string, patch: Partial<NewBook>) {
    const book = this.books.find((b) => b.id === id);
    if (!book) throw new Error("Libri nuk u gjet");
    Object.assign(book, patch);
    return book;
  }

  async remove(id: string) {
    this.books = this.books.filter((b) => b.id !== id);
  }

  async removeSamples() {
    this.books = this.books.filter((b) => !b.is_sample);
  }
}

const globalForStore = globalThis as unknown as { libratStore?: Store };

export function getStore(): Store {
  if (globalForStore.libratStore) return globalForStore.libratStore;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let store: Store;
  if (url && key) {
    store = new SupabaseStore(createClient(url, key, { auth: { persistSession: false } }));
  } else if (process.env.NODE_ENV !== "production") {
    console.warn("[librat] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — using in-memory store.");
    store = new MemoryStore();
  } else {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  }
  globalForStore.libratStore = store;
  return store;
}
