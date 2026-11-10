import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { TEXT_SIZE_SCRIPT } from "@/lib/client";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"] });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "BookNest",
  description: "Biblioteka e shtëpisë — gjeni çdo libër në sekonda.",
  // From the home screen the emerald header runs up under the status bar.
  appleWebApp: { title: "BookNest", capable: true, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#134a3e" },
    { media: "(prefers-color-scheme: dark)", color: "#10382f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sq" className={`${inter.variable} ${playfair.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEXT_SIZE_SCRIPT }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
