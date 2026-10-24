"use client";

import { ArrowDownIcon } from "./icons";

/**
 * A stored shelf photo. Either numbers every scanned book (to spot missing ones while checking a scan),
 * or dims everything except one book (to show where a book stands).
 */
export function ShelfPhoto({
  url,
  markers,
  highlight,
  onMarkerClick,
}: {
  url: string;
  markers?: { key: number | string; label: string | number; x0: number; x1: number }[];
  highlight?: { x0: number; x1: number } | null;
  onMarkerClick?: (key: number | string) => void;
}) {
  const band = highlight && highlight.x1 > highlight.x0 ? highlight : null;
  // A thin spine is easier to see with a little extra room around it.
  const left = band ? Math.max(0, band.x0 - 6) / 10 : 0;
  const right = band ? Math.min(1000, band.x1 + 6) / 10 : 0;
  // With many numbered books the photo is made wider than the screen and scrolls sideways,
  // so the numbers don't pile on top of each other.
  const minWidth = markers && markers.length > 6 ? `${markers.length * 44}px` : undefined;

  return (
    <div className="overflow-x-auto overflow-y-hidden rounded-2xl border border-line bg-black shadow-card">
      <div className="relative" style={{ minWidth }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL, not optimisable */}
        <img src={url} alt="Fotografia e raftit" className="block w-full select-none" draggable={false} />

        {band && (
          <>
            <div className="absolute inset-y-0 left-0 bg-black/60" style={{ width: `${left}%` }} />
            <div className="absolute inset-y-0 right-0 bg-black/60" style={{ width: `${100 - right}%` }} />
            <div
              className="absolute inset-y-1 rounded-md ring-4 ring-[#ffd166] shadow-[0_0_24px_rgba(255,209,102,0.8)]"
              style={{ left: `${left}%`, width: `${right - left}%` }}
            />
            <div
              className="absolute top-2 flex h-10 w-10 -translate-x-1/2 animate-bounce items-center justify-center rounded-full bg-[#ffd166] text-[#3a2a06] shadow-lg"
              style={{ left: `${(left + right) / 2}%` }}
              aria-hidden
            >
              <ArrowDownIcon className="h-6 w-6" />
            </div>
          </>
        )}

        {markers?.map((m, i) => (
          <button
            key={m.key}
            type="button"
            onClick={() => onMarkerClick?.(m.key)}
            aria-label={`Libri në vendin ${m.label}`}
            className="absolute flex h-8 min-w-8 -translate-x-1/2 items-center justify-center rounded-full border-2 border-white bg-accent px-1 text-base font-bold text-accent-ink shadow-md"
            style={{ left: `${(m.x0 + m.x1) / 20}%`, top: i % 2 ? "17%" : "5%" }}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
