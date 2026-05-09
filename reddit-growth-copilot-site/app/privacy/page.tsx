import Link from "next/link";
import type { Metadata } from "next";
import {
  CHROME_STORE_URL,
  LAST_UPDATED,
  PRIVACY_DESCRIPTION,
  PRIVACY_TITLE,
} from "../site";

export const metadata: Metadata = {
  title: PRIVACY_TITLE,
  description: PRIVACY_DESCRIPTION,
  alternates: {
    canonical: "/privacy",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function PrivacyPage() {
  return (
    <main className="section-shell py-16 sm:py-24">
      <div className="mx-auto max-w-4xl panel p-8 sm:p-10">
        <span className="eyebrow">Privacy Policy</span>
        <h1 className="mt-5 text-4xl font-semibold text-white sm:text-5xl">
          Privacy Policy for Reddit Growth Copilot
        </h1>
        <p className="mt-4 text-sm text-slate-400">Last updated: {LAST_UPDATED}</p>
        <p className="mt-6 text-base leading-8 text-slate-300">
          Reddit Growth Copilot is a Chrome extension designed to help users analyze Reddit thread signals and support
          manual decision-making about whether a thread is still worth replying to.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white hover:border-white/30 hover:bg-white/5"
          >
            Back to the homepage
          </Link>
          <a
            href={CHROME_STORE_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-sky-300/25 bg-sky-300/10 px-5 py-3 text-sm font-medium text-sky-100 hover:border-sky-300/40 hover:bg-sky-300/15"
          >
            View Reddit Growth Copilot on the Chrome Web Store
          </a>
        </div>

        <div className="mt-10 space-y-8 text-slate-300">
          <section>
            <h2 className="text-2xl font-semibold text-white">What the extension is for</h2>
            <p className="mt-3 text-base leading-8">
              The extension is built to analyze signals such as thread activity, OP activity, reply timing, and
              related context that may help a user judge whether a Reddit conversation is still active or already too
              late to engage.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">Manual decision support</h2>
            <p className="mt-3 text-base leading-8">
              Reddit Growth Copilot is intended to assist manual decision-making. It does not automate posting, does
              not mass comment, and is not presented as a replacement for human judgment.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">User data and storage</h2>
            <p className="mt-3 text-base leading-8">
              The extension does not sell user data. Depending on how the product is configured, local settings or user
              preferences may be stored using browser storage to support the extension experience.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">Future updates</h2>
            <p className="mt-3 text-base leading-8">
              If analytics or additional data-related features are added in the future, this privacy policy should be
              updated so that users can review the latest data practices.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">Contact</h2>
            <p className="mt-3 text-base leading-8">Contact: oeljeklaus2heart@gmail.com</p>
          </section>
        </div>
      </div>
    </main>
  );
}
