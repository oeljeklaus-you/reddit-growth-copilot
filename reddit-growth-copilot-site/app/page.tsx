import type { Metadata } from "next";
import Image from "next/image";
import {
  CHROME_STORE_URL,
  HOME_DESCRIPTION,
  HOME_OG_DESCRIPTION,
  HOME_OG_TITLE,
  HOME_TITLE,
  SEO_KEYWORDS,
  SITE_NAME,
  SITE_URL,
} from "./site";

export const metadata: Metadata = {
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  keywords: SEO_KEYWORDS,
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: HOME_OG_TITLE,
    description: HOME_OG_DESCRIPTION,
    type: "website",
    siteName: SITE_NAME,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_OG_TITLE,
    description: HOME_OG_DESCRIPTION,
  },
};

const problems = [
  "OP posted and disappeared",
  "Replies keep growing but no one is engaging",
  "Your thoughtful comment gets buried",
  "High comment count makes the thread look active, but the real conversation is over",
  "You waste time writing replies on dead threads",
];

const outcomes = [
  {
    title: "Avoid dead threads",
    copy: "Skip posts where OP disappeared or the real discussion has already moved on.",
  },
  {
    title: "Find still-alive conversations",
    copy: "Spot smaller threads where replies can still start real conversations.",
  },
  {
    title: "Comment with better timing",
    copy: "Use reply window, OP activity, and opportunity score before writing.",
  },
];

const features = [
  {
    title: "Opportunity Score",
    copy: "Helps you quickly judge whether a thread is worth replying to with a clear thread opportunity score.",
  },
  {
    title: "OP Activity",
    copy: "Shows whether the original poster is still active in the discussion so you can judge likely engagement quality.",
  },
  {
    title: "Reply Window",
    copy: "Helps identify whether the thread is fresh, still alive, crowded, risky, or dead before you spend time writing.",
  },
  {
    title: "Fake Active Risk",
    copy: "Warns when a thread looks active on the surface but may not produce real engagement.",
  },
  {
    title: "Action Suggestion",
    copy: "Gives a clear suggestion: comment now, wait, or skip based on reply timing and thread signals.",
  },
  {
    title: "Thread Timing Signals",
    copy: "Helps you prioritize threads based on timing, OP activity, and engagement quality instead of guesswork.",
  },
];

const audience = [
  "Indie hackers",
  "SaaS founders",
  "Chrome extension builders",
  "Solopreneurs",
  "Growth marketers",
  "People doing manual Reddit outreach",
];

const trustItems = [
  "No mass posting",
  "No auto-commenting",
  "No fake engagement",
  "No selling user data",
  "Designed to support manual, human replies",
];

const faqs = [
  {
    question: "What is Reddit Growth Copilot?",
    answer:
      "Reddit Growth Copilot is a Chrome extension and Reddit thread analyzer that helps users evaluate thread timing, OP activity, reply windows, and fake-active risk before commenting.",
  },
  {
    question: "Is Reddit Growth Copilot a Reddit marketing tool?",
    answer:
      "Yes. It is designed for manual Reddit marketing workflows, especially for founders, indie hackers, SaaS builders, and growth marketers who want to choose better threads to reply to.",
  },
  {
    question: "Does Reddit Growth Copilot automate Reddit comments?",
    answer:
      "No. It does not mass post, auto-comment, or replace human judgment. It helps users decide whether a thread is worth replying to.",
  },
  {
    question: "What is OP activity?",
    answer:
      "OP activity refers to whether the original poster is still participating in the discussion. A thread with an active OP is often more valuable than a thread that only looks busy.",
  },
  {
    question: "What is fake-active risk?",
    answer:
      "Fake-active risk means a thread may have comments or activity but little real opportunity for a new reply to be noticed or answered.",
  },
  {
    question: "Who should use this Chrome extension?",
    answer:
      "It is useful for indie hackers, SaaS founders, Chrome extension builders, solopreneurs, growth marketers, and people doing thoughtful manual Reddit outreach.",
  },
  {
    question: "Can Reddit Growth Copilot guarantee customers or traffic?",
    answer:
      "No. It does not guarantee traffic, customers, replies, or sales. It helps users make better engagement decisions.",
  },
  {
    question: "Where can I install Reddit Growth Copilot?",
    answer: "You can install Reddit Growth Copilot from the Chrome Web Store.",
  },
];

const screenshotCards = [
  {
    title: "Spot active threads faster",
    src: "/png/2.png",
    alt: "Reddit Growth Copilot Chrome extension showing thread opportunity score",
  },
  {
    title: "Avoid fake-active discussions",
    src: "/png/3.png",
    alt: "Reddit Growth Copilot OP activity and reply timing panel",
  },
  {
    title: "Decide when to reply",
    src: "/png/4.png",
    alt: "Reddit thread analyzer showing fake-active risk and action suggestion",
  },
];

function ExternalCta({ secondary = false }: { secondary?: boolean }) {
  return (
    <a
      href={CHROME_STORE_URL}
      target="_blank"
      rel="noreferrer"
      className={
        secondary
          ? "inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white hover:border-white/30 hover:bg-white/5"
          : "inline-flex items-center justify-center rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-soft hover:bg-emerald-300"
      }
    >
      Add to Chrome
    </a>
  );
}

function StoreLink({ label = "View on Chrome Web Store" }: { label?: string }) {
  return (
    <a
      href={CHROME_STORE_URL}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center justify-center rounded-full border border-sky-300/25 bg-sky-300/10 px-5 py-3 text-sm font-medium text-sky-100 hover:border-sky-300/40 hover:bg-sky-300/15"
    >
      {label}
    </a>
  );
}

function SectionHeading({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
}) {
  return (
    <div className="max-w-3xl">
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="section-title mt-5">{title}</h2>
      {copy ? <p className="section-copy mt-4">{copy}</p> : null}
    </div>
  );
}

export default function HomePage() {
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      applicationCategory: "BrowserApplication",
      operatingSystem: "Chrome",
      description:
        "A Reddit marketing Chrome extension that helps users analyze Reddit thread timing, OP activity, reply windows, and fake-active risk before commenting.",
      url: SITE_URL,
      downloadUrl: CHROME_STORE_URL,
      browserRequirements: "Google Chrome",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
  ];

  return (
    <main id="main-content">
      <section className="section-shell py-16 sm:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className="eyebrow">Reddit growth tool</span>
            <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-tight text-white sm:text-6xl">
              Stop replying to dead Reddit threads.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Reddit Growth Copilot helps you check whether a Reddit thread is still alive, worth replying to, or
              already too crowded before you spend time writing a thoughtful comment.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ExternalCta />
              <StoreLink label="View on Chrome Web Store" />
            </div>
            <p className="mt-4 text-sm text-slate-400">
              Free Chrome extension · No spam automation · Built for manual Reddit outreach
            </p>
          </div>

          <div className="panel p-5 sm:p-6">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 shadow-soft">
              <Image
                src="/png/1.png"
                alt="Reddit Growth Copilot Chrome extension showing thread opportunity score, OP activity, reply timing, and fake-active risk"
                width={1280}
                height={800}
                priority
                className="h-auto w-full"
              />
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              Preview of the Growth Copilot panel. Replace this with a real Reddit thread screenshot before launch.
            </p>
          </div>
        </div>
      </section>

      <section className="section-shell py-16 sm:py-20">
        <div className="panel p-8 sm:p-10">
          <SectionHeading
            eyebrow="Search-friendly overview"
            title="Know which Reddit threads are still worth your time."
            copy="Reddit Growth Copilot works like a lightweight Reddit thread analyzer for manual Reddit marketing. It helps founders, indie hackers, and marketers review OP activity, reply timing, engagement quality, and fake-active risk before writing a thoughtful Reddit reply."
          />
        </div>
      </section>

      <section className="section-shell py-16 sm:py-20">
        <div className="panel p-8 sm:p-10">
          <SectionHeading
            eyebrow="The problem"
            title="Reddit marketing is not just about commenting early."
            copy="A lot of people assume Reddit marketing is about showing up first and replying carefully. In practice, many threads look active long after the real opportunity is gone."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {problems.map((problem) => (
              <div key={problem} className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
                <p className="text-base leading-7 text-slate-200">{problem}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-shell py-16 sm:py-20">
        <SectionHeading
          eyebrow="What you get"
          title="Spend your Reddit reply time where it still has a chance to be seen."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {outcomes.map((outcome) => (
            <div key={outcome.title} className="panel p-6">
              <h3 className="text-xl font-semibold text-white">{outcome.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{outcome.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section-shell py-16 sm:py-20">
        <div className="panel p-8 sm:p-10">
          <SectionHeading
            eyebrow="Timing"
            title="Why reply timing matters on Reddit"
            copy="Reddit marketing is not only about being early. Some threads look busy but no longer have meaningful engagement. Others are smaller but still have an active OP and a better chance of starting a real conversation. Reddit Growth Copilot helps users compare those signals before deciding where to engage."
          />
        </div>
      </section>

      <section className="section-shell py-16 sm:py-20">
        <SectionHeading
          eyebrow="Features"
          title="See the reply opportunity before you comment."
          copy="This Chrome extension gives you a practical Reddit thread analyzer for OP activity, reply timing, fake-active risk, and thread opportunity score in one place."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="panel p-6">
              <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{feature.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section-shell py-16 sm:py-20">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <SectionHeading
            eyebrow="How it works"
            title="How it works"
            copy="Designed for fast, manual decision-making inside your normal Reddit workflow."
          />
          <div className="grid gap-5 md:grid-cols-3">
            {[
              "Open a Reddit thread",
              "Check the Growth Copilot panel",
              "Decide whether to comment, skip, or move faster",
            ].map((step, index) => (
              <div key={step} className="panel p-6">
                <div className="text-sm font-medium text-emerald-200">Step {index + 1}</div>
                <p className="mt-3 text-lg font-medium text-white">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-shell py-16 sm:py-20">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="panel p-8">
            <SectionHeading
              eyebrow="Who it is for"
              title="Built for people who use Reddit for real distribution."
              copy="If you are doing manual Reddit outreach, this Reddit growth tool helps you avoid wasting attention on threads that are no longer worth the effort."
            />
            <div className="mt-8 flex flex-wrap gap-3">
              {audience.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-200"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="panel p-8">
            <SectionHeading
              eyebrow="What it is not"
              title="Not a bot. Not spam automation."
              copy="Reddit Growth Copilot does not mass post, does not auto-comment, does not replace human judgment, and does not promise traffic, customers, or sales. It helps you make better timing decisions before you reply."
            />
          </div>
        </div>
      </section>

      <section className="section-shell py-16 sm:py-20">
        <div className="panel p-8 sm:p-10">
          <SectionHeading
            eyebrow="Privacy and trust"
            title="Built for thoughtful, manual Reddit engagement."
            copy="The extension is designed to focus on Reddit thread analysis and manual decision support."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {trustItems.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 text-sm text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-shell py-16 sm:py-20">
        <SectionHeading
          eyebrow="Screenshots"
          title="What the product experience can look like."
          copy="Replace these three mock UI cards with real plugin screenshots when you are ready. Until then, they keep the landing page polished and deployment-ready."
        />
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {screenshotCards.map((card) => (
            <div key={card.title} className="panel p-5">
              {/* TODO: Replace or reorder these real screenshots if you capture better product views later. */}
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/75">
                <Image
                  src={card.src}
                  alt={card.alt}
                  width={1280}
                  height={800}
                  className="h-auto w-full"
                />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-white">{card.title}</h3>
            </div>
          ))}
        </div>
      </section>

      <section className="section-shell py-16 sm:py-20">
        <div className="panel p-8 sm:p-10">
          <SectionHeading
            eyebrow="Chrome Web Store"
            title="Install from the official Chrome Web Store."
            copy="Reddit Growth Copilot is available as a Chrome extension from the Chrome Web Store. It is designed for manual Reddit engagement and thread analysis, not automated posting or mass commenting."
          />
          <div className="mt-8">
            <StoreLink label="View on Chrome Web Store" />
          </div>
        </div>
      </section>

      <section className="section-shell py-16 sm:py-20">
        <SectionHeading
          eyebrow="FAQ"
          title="Questions people should be able to answer fast."
          copy="Clear positioning matters when you share a Chrome extension on Reddit, X, Indie Hackers, or in the Chrome Web Store."
        />
        <dl className="mt-10 grid gap-5 lg:grid-cols-2">
          {faqs.map((item) => (
            <div key={item.question} className="panel p-6">
              <dt>
                <h3 className="text-lg font-semibold text-white">{item.question}</h3>
              </dt>
              <dd>
                {item.question === "Where can I install Reddit Growth Copilot?" ? (
                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    You can install Reddit Growth Copilot from the{" "}
                    <a
                      href={CHROME_STORE_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-200 underline decoration-sky-200/40 underline-offset-4 hover:text-white"
                    >
                      Chrome Web Store
                    </a>
                    .
                  </p>
                ) : (
                  <p className="mt-3 text-sm leading-7 text-slate-300">{item.answer}</p>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="section-shell py-16 sm:py-20">
        <div className="panel overflow-hidden p-8 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <span className="eyebrow">Final CTA</span>
              <h2 className="mt-5 max-w-3xl text-3xl font-semibold text-white sm:text-4xl">
                Stop guessing which Reddit threads are worth your time.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Use Reddit Growth Copilot to assess OP activity, reply timing, and thread opportunity score before you
                write another comment into a dead thread.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <ExternalCta />
              <StoreLink label="View on Chrome Web Store" />
            </div>
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </main>
  );
}
