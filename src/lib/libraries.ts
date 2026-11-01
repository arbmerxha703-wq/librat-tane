import "server-only";
import type { Store } from "./store";
import { MAIN_LIBRARY, type LibraryInfo } from "./types";

const KEY = "libraries";

/** Until a second library is added, every account has just this one (its books have library_id "main"). */
const DEFAULT: LibraryInfo[] = [{ id: MAIN_LIBRARY, name: "Biblioteka kryesore" }];

export async function getLibraries(store: Store): Promise<LibraryInfo[]> {
  const list = await store.getSetting<LibraryInfo[]>(KEY, []);
  return list.length ? list : DEFAULT;
}

export function setLibraries(store: Store, list: LibraryInfo[]): Promise<void> {
  return store.setSetting(KEY, list);
}
