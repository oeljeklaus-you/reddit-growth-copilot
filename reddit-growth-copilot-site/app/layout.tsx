import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";
import { CHROME_STORE_URL, HOME_DESCRIPTION, SITE_NAME, SITE_URL } from "./site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: SITE_NAME,
  description: HOME_DESCRIPTION,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  category: "technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-grid bg-[size:80px_80px] opacity-[0.08]" />
          <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/75 backdrop-blur-xl">
            <div className="section-shell flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <Link href="/" className="font-display text-sm font-semibold tracking-[0.22em] text-white">
                REDDIT GROWTH COPILOT
              </Link>
              <nav className="flex flex-wrap items-center gap-3 text-sm">
                <Link href="/privacy" className="text-slate-300 hover:text-white">
                  Privacy
                </Link>
                <a
                  href={CHROME_STORE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-emerald-400/30 bg-emerald-400/15 px-4 py-2 font-medium text-emerald-200 hover:border-emerald-300/60 hover:bg-emerald-400/20"
                >
                  Add to Chrome
                </a>
              </nav>
            </div>
          </header>
          {children}
          <footer className="border-t border-white/10 py-8">
            <div className="section-shell flex flex-col gap-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p>
                  Reddit Growth Copilot is a Chrome extension for Reddit thread analysis, reply timing, and manual
                  Reddit marketing workflows.
                </p>
                <p>Built for manual Reddit marketing, reply timing, and thread opportunity analysis.</p>
              </div>
              <nav className="flex flex-wrap gap-5">
                <Link href="/" className="hover:text-white">
                  Home
                </Link>
                <Link href="/privacy" className="hover:text-white">
                  Privacy Policy
                </Link>
                <a href={CHROME_STORE_URL} target="_blank" rel="noreferrer" className="hover:text-white">
                  Chrome Web Store
                </a>
              </nav>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
