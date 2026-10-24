"use client";

import { useEffect, useState } from "react";
import type { LibraryMap as MapData } from "@/lib/types";
import { normalize } from "@/lib/normalize";
import { api, photoToBase64 } from "@/lib/client";
import { CameraIcon } from "./icons";

type MapState = MapData & { url: string | null };

/**
 * The photo of the whole bookcase with a red circle on the given shelf.
 * When `editable`, tapping the photo marks where that shelf is, and the photo can be taken or replaced.
 */
export function LibraryMap({ passcode, shelf, editable }: { passcode: string; shelf: string; editable?: boolean }) {
  const [map, setMap] = useState<MapState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputId = `map-photo-${editable ? "edit" : "view"}`;

  useEffect(() => {
    let alive = true;
    api<MapState>("/api/map", passcode).then(
      (m) => alive && setMap(m),
      (err) => alive && setError((err as Error).message),
    );
    return () => {
      alive = false;
    };
  }, [passcode]);

  const markKey = map ? Object.keys(map.marks).find((k) => normalize(k) === normalize(shelf)) : undefined;
  const mark = markKey ? map!.marks[markKey] : undefined;

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const photo = await photoToBase64(file, 1600);
      setMap(await api<MapState>("/api/map", passcode, { method: "POST", body: JSON.stringify({ photo }) }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function placeMark(e: React.MouseEvent<HTMLDivElement>) {
    if (!editable || !shelf.trim()) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const point = {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
    setMap((m) => (m ? { ...m, marks: { ...m.marks, [shelf.trim()]: point } } : m));
    try {
      setMap(
        await api<MapState>("/api/map", passcode, {
          method: "PATCH",
          body: JSON.stringify({ shelf: markKey ?? shelf.trim(), point }),
        }),
      );
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!map) return error ? <p className="text-base text-danger">{error}</p> : null;
  if (!map.url && !editable) return null;

  return (
    <div className="flex flex-col gap-3">
      <input
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          uploadPhoto(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {map.url ? (
        <>
          {editable && (
            <p className="text-lg">
              {mark ? (
                <>Rrethi i kuq tregon ku është <strong>Rafti {shelf}</strong>. Prekni diku tjetër për ta lëvizur.</>
              ) : (
                <>
                  Prekni mbi foto <strong>ku ndodhet Rafti {shelf}</strong>.
                </>
              )}
            </p>
          )}
          <div
            onClick={placeMark}
            className={`relative overflow-hidden rounded-2xl border border-line bg-black shadow-md ${editable ? "cursor-crosshair" : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
            <img src={map.url} alt="Fotografia e bibliotekës" className="block w-full select-none" draggable={false} />
            {Object.entries(map.marks).map(([name, p]) => {
              const current = normalize(name) === normalize(shelf);
              return (
                <div
                  key={name}
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                >
                  {current ? (
                    <span className="relative flex h-16 w-16 items-center justify-center">
                      <span className="absolute inset-0 animate-ping rounded-full bg-red-500/50" />
                      <span className="relative flex h-16 w-16 items-center justify-center rounded-full border-4 border-red-500 bg-red-500/25 text-sm font-bold text-white drop-shadow">
                        {name}
                      </span>
                    </span>
                  ) : (
                    <span className="rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">{name}</span>
                  )}
                </div>
              );
            })}
          </div>
          {editable && (
            <label htmlFor={inputId} className="cursor-pointer self-start text-base font-semibold text-accent-strong underline">
              {busy ? "Duke ruajtur…" : "Ndrysho foton e bibliotekës"}
            </label>
          )}
        </>
      ) : (
        <label
          htmlFor={inputId}
          className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed border-accent bg-soft/60 p-4 ${busy ? "pointer-events-none opacity-70" : ""}`}
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-ink">
            <CameraIcon className="h-8 w-8" />
          </span>
          <span>
            <span className="block text-xl font-bold text-accent-strong">
              {busy ? "Duke ruajtur…" : "Fotografo gjithë bibliotekën"}
            </span>
            <span className="block text-base text-muted">Një herë mjafton. Pastaj shënoni ku është çdo raft.</span>
          </span>
        </label>
      )}
      {error && <p className="text-base text-danger">{error}</p>}
    </div>
  );
}
