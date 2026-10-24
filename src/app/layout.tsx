import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"] });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "Librat Tanë",
  description: "Katalogu i bibliotekës së shtëpisë",
  appleWebApp: { title: "Librat Tanë", capable: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6efe0" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1611" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sq" className={`${inter.variable} ${playfair.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
