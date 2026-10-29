import type { MetadataRoute } from "next";

/** Lets "Add to Home Screen" install the app with its own name, icon and colours. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Librat Tanë",
    short_name: "Librat Tanë",
    description: "Biblioteka e shtëpisë — gjeni çdo libër në sekonda.",
    lang: "sq",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f3d33",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
