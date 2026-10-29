'use client'

import { useRouter } from 'next/navigation'

export default function AboutUsPage() {
  const router = useRouter()

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-ex-bg overflow-y-auto"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      <div className="flex items-center gap-3 px-4 h-14 shrink-0">
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          className="text-ex-ink text-2xl font-extrabold leading-none"
        >
          ‹
        </button>
        <h1
          className="text-ex-ink font-extrabold text-[17px]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          About us
        </h1>
      </div>

      <div className="flex-1 px-5 pt-2 pb-10 flex flex-col gap-8">
        <section className="flex flex-col gap-2">
          <div
            className="text-[22px] font-extrabold text-ex-ink leading-tight tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Experium Nature Virtual Audio Tour
          </div>
          <p className="text-[14px] text-ex-muted leading-relaxed">
            India&apos;s first AI-powered nature audio tour — right here in Hyderabad. Scan a QR
            marker near any exhibit to hear a 60-second narration about the plant, structure, or
            water body in front of you.
          </p>
        </section>

        <div className="h-px bg-ex-border" />

        <section className="flex flex-col gap-2">
          <div
            className="text-[17px] font-extrabold text-ex-ink leading-snug"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Built by Aikya Technology
          </div>
          <p className="text-[14px] text-ex-muted leading-relaxed">
            We build experiences that make the natural world more accessible. This audio tour is our
            first product — made in Hyderabad, for Hyderabad.
          </p>
        </section>

        <div className="h-px bg-ex-border" />

        <section className="flex flex-col gap-3">
          <div
            className="text-[17px] font-extrabold text-ex-ink leading-snug"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Get in touch
          </div>
          <p className="text-[13px] text-ex-muted leading-relaxed">
            For enquiries or ad placements, reach out to us:
          </p>
          <a
            href="mailto:experium@aikyatechnology.in"
            className="flex items-center gap-3 no-underline"
          >
            <span className="text-[14px] text-ex-forest font-semibold">
              experium@aikyatechnology.in
            </span>
          </a>
          <a
            href="https://www.instagram.com/aikya.creations/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 no-underline"
          >
            <span className="text-[14px] text-ex-forest font-semibold">
              Follow us on Instagram → @aikya.creations
            </span>
          </a>
        </section>
      </div>
    </div>
  )
}
