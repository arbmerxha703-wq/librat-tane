"use client";

import { useEffect, useState } from "react";
import type { Zone } from "@/lib/types";
import { normalize } from "@/lib/normalize";
import { api, photoToBase64 } from "@/lib/client";
import { CameraIcon, PlusIcon } from "./icons";

type ZoneWithUrl = Zone & { url: string | null };
type MapState = { zones: ZoneWithUrl[] };

function useLibraryMap() {
  const [map, setMap] = useState<MapState | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    api<MapState>("/api/map").then(
      (m) => alive && setMap(m),
      (err) => alive && setError((err as Error).message),
    );
    return () => {
      alive = false;
    };
  }, []);
  return { map, setMap, error, setError };
}

const findMark = (zone: Zone, shelf: string) =>
  Object.entries(zone.marks).find(([name]) => normalize(name) === normalize(shelf))?.[1];

/** Next free shelf number, so nobody has to invent or remember shelf names. */
function nextShelfName(existing: string[]): string {
  const numbers = existing.map((s) => Number.parseInt(s, 10)).filter(Number.isFinite);
  return String((numbers.length ? Math.max(...numbers) : 0) + 1);
}

function Marker({ name, current }: { name: string; current: boolean }) {
  return current ? (
    <span className="relative flex h-16 w-16 items-center justify-center">
      <span className="absolute inset-0 animate-ping rounded-full bg-red-500/50" />
      <span className="relative flex h-16 w-16 items-center justify-center rounded-full border-4 border-red-500 bg-red-500/25 text-sm font-bold text-white drop-shadow">
        {name}
      </span>
    </span>
  ) : (
    <span className="flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-white bg-black/70 px-1 text-xs font-bold text-white">
      {name}
    </span>
  );
}

function ZonePhoto({
  zone,
  shelf,
  onTap,
}: {
  zone: ZoneWithUrl;
  shelf: string;
  onTap?: (point: { x: number; y: number }, rect: DOMRect) => void;
}) {
  if (!zone.url) return null;
  return (
    <div
      onClick={(e) => {
        if (!onTap) return;
        const rect = e.currentTarget.getBoundingClientRect();
        onTap(
          {
            x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
            y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
          },
          rect,
        );
      }}
      className={`relative overflow-hidden rounded-2xl border border-line bg-black shadow-md ${onTap ? "cursor-crosshair" : ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
      <img src={zone.url} alt={`Fotografia: ${zone.name}`} className="block w-full select-none" draggable={false} />
      {Object.entries(zone.marks).map(([name, p]) => (
        <div
          key={name}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
        >
          <Marker name={name} current={normalize(name) === normalize(shelf)} />
        </div>
      ))}
    </div>
  );
}

/**
 * "Ku është?" — the library photo that contains this shelf, with a red circle on it.
 * Shows nothing when the shelf has not been marked.
 */
export function ShelfOnMap({ shelf }: { shelf: string }) {
  const { map } = useLibraryMap();
  const zone = map?.zones.find((z) => findMark(z, shelf));
  if (!map) return null;
  if (!zone) {
    return (
      <p className="rounded-xl bg-soft px-4 py-3 text-base text-muted">
        Ky raft s’është shënuar ende në foton e bibliotekës.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {map.zones.length > 1 && <p className="text-lg font-semibold">{zone.name}</p>}
      <ZonePhoto zone={zone} shelf={shelf} />
    </div>
  );
}

/**
 * Scanning step 1: tap the shelf on a photo of the library.
 * Tapping near an existing shelf picks it; tapping elsewhere creates the next shelf there.
 */
export function ShelfPicker({
  shelves,
  shelf,
  onPick,
}: {
  /** Shelves that already have books. */
  shelves: string[];
  /** The currently chosen shelf ("" if none). */
  shelf: string;
  onPick: (shelf: string) => void;
}) {
  const { map, setMap, error, setError } = useLibraryMap();
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");

  const zones = map?.zones ?? [];
  // Show the zone of the current shelf, else the one chosen, else the first.
  const zone =
    zones.find((z) => z.id === zoneId) ?? zones.find((z) => shelf && findMark(z, shelf)) ?? zones[0];

  async function addPhoto(file: File | undefined, replace?: ZoneWithUrl) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const photo = await photoToBase64(file, 2000);
      const name = replace?.name ?? (newName.trim() || `Pjesa ${zones.length + 1}`);
      const next = await api<MapState>("/api/map", {
        method: "POST",
        body: JSON.stringify({ photo, name, zoneId: replace?.id }),
      });
      setMap(next);
      setZoneId(replace?.id ?? next.zones.at(-1)?.id ?? null);
      setNewName("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function tap(point: { x: number; y: number }, rect: DOMRect) {
    if (!zone) return;
    // A tap within ~40px of an existing shelf picks that shelf.
    const near = Object.entries(zone.marks).find(
      ([, p]) => Math.hypot((p.x - point.x) * rect.width, (p.y - point.y) * rect.height) < 40,
    );
    if (near) return onPick(near[0]);

    const allNames = [...shelves, ...zones.flatMap((z) => Object.keys(z.marks))];
    const name = nextShelfName(allNames);
    setMap((m) => m && { zones: m.zones.map((z) => (z.id === zone.id ? { ...z, marks: { ...z.marks, [name]: point } } : z)) });
    onPick(name);
    try {
      setMap(
        await api<MapState>("/api/map", {
          method: "PATCH",
          body: JSON.stringify({ zoneId: zone.id, shelf: name, point }),
        }),
      );
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function removeZone(z: ZoneWithUrl) {
    if (!window.confirm(`Ta heqim foton "${z.name}"? Librat nuk preken.`)) return;
    try {
      setMap(await api<MapState>("/api/map", { method: "DELETE", body: JSON.stringify({ zoneId: z.id }) }));
      setZoneId(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!map) return error ? <p className="text-base text-danger">{error}</p> : <p className="text-muted">Duke ngarkuar…</p>;

  const addInputId = "zone-photo-add";
  const replaceInputId = "zone-photo-replace";

  return (
    <div className="flex flex-col gap-3">
      <input
        id={addInputId}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          addPhoto(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        id={replaceInputId}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          addPhoto(e.target.files?.[0], zone);
          e.target.value = "";
        }}
      />

      {zone ? (
        <>
          {zones.length > 1 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Pjesët e bibliotekës">
              {zones.map((z) => (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => setZoneId(z.id)}
                  aria-pressed={z.id === zone.id}
                  className={`h-11 rounded-xl px-4 text-base font-semibold ${
                    z.id === zone.id ? "bg-accent text-accent-ink" : "bg-soft text-ink"
                  }`}
                >
                  {z.name}
                </button>
              ))}
            </div>
          )}
          <p className="text-lg">
            {shelf && findMark(zone, shelf) ? (
              <>
                U zgjodh <strong>rafti {shelf}</strong> (rrethi i kuq). Për një raft tjetër, prekeni në foto.
              </>
            ) : (
              <>
                <strong>Prekni në foto raftin</strong> që do të fotografoni.
              </>
            )}
          </p>
          <ZonePhoto zone={zone} shelf={shelf} onTap={tap} />
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-base font-semibold text-accent-strong">
            <label htmlFor={replaceInputId} className="cursor-pointer underline">
              Ndrysho këtë foto
            </label>
            <button type="button" onClick={() => removeZone(zone)} className="text-danger underline">
              Hiqe këtë foto
            </button>
          </div>
        </>
      ) : (
        <p className="text-lg">
          Fotografoni <strong>bibliotekën</strong> (ose një pjesë të saj). Pastaj thjesht prekni mbi foto raftin që do
          të skanoni — pa numra për të mbajtur mend.
        </p>
      )}

      <div className="rounded-2xl border-2 border-dashed border-accent bg-soft/50 p-3">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={`Emri, p.sh. “Muri majtas” (Pjesa ${zones.length + 1})`}
          aria-label="Emri i pjesës së re të bibliotekës"
          className="mb-2 h-12 w-full rounded-xl border-2 border-line bg-card px-3 text-lg outline-none focus:border-accent"
        />
        <label
          htmlFor={addInputId}
          className={`flex cursor-pointer items-center gap-3 ${busy ? "pointer-events-none opacity-70" : ""}`}
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink">
            {zones.length ? <PlusIcon className="h-7 w-7" /> : <CameraIcon className="h-7 w-7" />}
          </span>
          <span className="text-lg font-bold text-accent-strong">
            {busy ? "Duke ruajtur…" : zones.length ? "Shto foto të një pjese tjetër" : "Fotografo bibliotekën"}
          </span>
        </label>
      </div>
      {error && <p className="text-base text-danger">{error}</p>}
    </div>
  );
}

