"use client";

import dynamic from "next/dynamic";

// Needs the account saved on this device, so it renders in the browser only.
export const ShelfLabelsLoader = dynamic(() => import("./ShelfLabels").then((m) => m.ShelfLabels), { ssr: false });
