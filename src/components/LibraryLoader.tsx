"use client";

import dynamic from "next/dynamic";

// The app depends on the account saved on this device, so render it in the browser only.
export const LibraryLoader = dynamic(() => import("./Library").then((m) => m.Library), { ssr: false });
