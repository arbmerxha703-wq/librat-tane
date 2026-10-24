/**
 * A shelf photo is read as 3 overlapping parts (left, middle, right), as fractions of its width.
 * Shared by the phone (which cuts the parts) and the server (which maps positions back).
 */
export const SHELF_TILES: [number, number][] = [
  [0, 0.38],
  [0.31, 0.69],
  [0.62, 1],
];
