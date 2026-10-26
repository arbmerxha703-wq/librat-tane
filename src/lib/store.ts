import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Book, LibraryMap, NewBook } from "./types";

const TABLE = "books";
const SETTINGS = "app_settings";
const BUCKET = "photos";
const URL_TTL = 60 * 60; // signed photo links last an hour

export interface Store {
  list(): Promise<Book[]>;
  add(book: NewBook, isSample?: boolean): Promise<Book>;
  addMany(books: NewBook[], isSample?: boolean): Promise<Book[]>;
  update(id: string, patch: Partial<NewBook>): Promise<Book>;
  remove(id: string): Promise<void>;
  removeSamples(): Promise<void>;
  /** Saves a JPEG (base64) and returns its storage path. */
  savePhoto(folder: "shelves" | "map", base64: string): Promise<string>;
  /** Short-lived links the browser can load, keyed by storage path. */
  photoUrls(paths: string[]): Promise<Record<string, string>>;
  getMap(): Promise<LibraryMap>;
  setMap(map: LibraryMap): Promise<void>;
  /** Small shared settings (e.g. loans), stored as JSON by key. */
  getSetting<T>(key: string, fallback: T): Promise<T>;
  setSetting(key: string, value: unknown): Promise<void>;
  /** The cheapest possible query, so the free database never counts as idle. */
  ping(): Promise<void>;
}

const EMPTY_MAP: LibraryMap = { zones: [] };

/** Reads the stored map, upgrading the earlier single-photo shape { path, marks }. */
function toMap(value: unknown): LibraryMap {
  const v = value as { zones?: LibraryMap["zones"]; path?: string | null; marks?: LibraryMap["zones"][number]["marks"] } | null;
  if (v?.zones) return { zones: v.zones };
  if (v?.path) return { zones: [{ id: "biblioteka", name: "Biblioteka", path: v.path, marks: v.marks ?? {} }] };
  return EMPTY_MAP;
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

  async savePhoto(folder: "shelves" | "map", base64: string) {
    const path = `${folder}/${crypto.randomUUID()}.jpg`;
    const { error } = await this.db.storage
      .from(BUCKET)
      .upload(path, Buffer.from(base64, "base64"), { contentType: "image/jpeg" });
    if (error) throw error;
    return path;
  }

  async photoUrls(paths: string[]) {
    if (paths.length === 0) return {};
    const { data, error } = await this.db.storage.from(BUCKET).createSignedUrls(paths, URL_TTL);
    if (error) throw error;
    const urls: Record<string, string> = {};
    for (const d of data) if (d.path && d.signedUrl) urls[d.path] = d.signedUrl;
    return urls;
  }

  async getMap() {
    const { data, error } = await this.db.from(SETTINGS).select("value").eq("key", "map").maybeSingle();
    if (error) throw error;
    return toMap(data?.value);
  }

  async setMap(map: LibraryMap) {
    await this.setSetting("map", map);
  }

  async getSetting<T>(key: string, fallback: T) {
    const { data, error } = await this.db.from(SETTINGS).select("value").eq("key", key).maybeSingle();
    if (error) throw error;
    return (data?.value as T | undefined) ?? fallback;
  }

  async setSetting(key: string, value: unknown) {
    const { error } = await this.db.from(SETTINGS).upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) throw error;
  }

  async ping() {
    const { error } = await this.db.from(TABLE).select("id").limit(1);
    if (error) throw error;
  }
}

/** Local-development fallback when Supabase isn't configured. Data is lost on restart. */
class MemoryStore implements Store {
  private books: Book[] = [];
  private photos = new Map<string, string>();
  private map: LibraryMap = EMPTY_MAP;

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

  async savePhoto(folder: "shelves" | "map", base64: string) {
    const path = `${folder}/${crypto.randomUUID()}.jpg`;
    this.photos.set(path, `data:image/jpeg;base64,${base64}`);
    return path;
  }

  async photoUrls(paths: string[]) {
    return Object.fromEntries(paths.filter((p) => this.photos.has(p)).map((p) => [p, this.photos.get(p)!]));
  }

  async getMap() {
    return toMap(this.map);
  }

  async setMap(map: LibraryMap) {
    this.map = map;
  }

  private settings = new Map<string, unknown>();

  async getSetting<T>(key: string, fallback: T) {
    return (this.settings.get(key) as T | undefined) ?? fallback;
  }

  async setSetting(key: string, value: unknown) {
    this.settings.set(key, value);
  }

  async ping() {}
}

const globalForStore = globalThis as unknown as { libratStore?: Store };

export function getStore(): Store {
  if (globalForStore.libratStore) return globalForStore.libratStore;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let store: Store;
  // `npm run dev:memory` tries changes without touching the real catalog.
  const forceMemory = process.env.LIBRAT_MEMORY_STORE === "1" && process.env.NODE_ENV !== "production";
  if (url && key && !forceMemory) {
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
