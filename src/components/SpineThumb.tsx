"use client";

/**
 * A close-up of the shelf photo around one book, with that book lit up — so it can be
 * recognised by its spine without counting anything.
 */
export function SpineThumb({ url, x0, x1 }: { url: string; x0: number; x1: number }) {
  const a = x0 / 1000;
  const b = x1 / 1000;
  // Show the book plus its neighbours: at least a quarter of the shelf, or four spine widths.
  const frac = Math.min(1, Math.max(0.25, (b - a) * 4));
  const start = Math.min(Math.max((a + b) / 2 - frac / 2, 0), 1 - frac);
  const left = ((a - start) / frac) * 100;
  const width = ((b - a) / frac) * 100;

  return (
    <div className="relative h-44 overflow-hidden bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
      <img
        src={url}
        alt=""
        loading="lazy"
        draggable={false}
        className="absolute top-1/2 max-w-none -translate-y-1/2 select-none"
        style={{ width: `${100 / frac}%`, left: `${(-start / frac) * 100}%` }}
      />
      <div className="absolute inset-y-0 left-0 bg-black/55" style={{ width: `${left}%` }} />
      <div className="absolute inset-y-0 right-0 bg-black/55" style={{ width: `${100 - left - width}%` }} />
      <div
        className="absolute inset-y-1.5 rounded-md ring-2 ring-[#f0dca8] shadow-[0_0_22px_rgba(240,220,168,0.7)]"
        style={{ left: `${left}%`, width: `${width}%` }}
      />
    </div>
  );
}
