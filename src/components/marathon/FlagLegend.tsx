import { EFFORT_BANDS } from "@/lib/effort";

/** What each warning flag means. Keep in step with runFlags in effort.ts. */
const FLAG_MEANINGS: { flag: string; meaning: string }[] = [
  {
    flag: "Short faster than 8:25",
    meaning: "A run under 5 mi averaged faster than 8:25/mi without a planned workout.",
  },
  {
    flag: "Medium / Long faster than 9:50",
    meaning: "A run of 5 mi or more averaged faster than easy pace (9:50/mi) without a workout.",
  },
  {
    flag: "Back-to-back fast days",
    meaning: "Faster than 9:00/mi on two days in a row.",
  },
  {
    flag: "Big jump",
    meaning: "More than 30% longer than your longest run in the previous 2 weeks.",
  },
  {
    flag: "Faded late",
    meaning: "The second half of the miles averaged over 20 s/mi slower than the first half.",
  },
  {
    flag: "Clock left running",
    meaning: "The watch kept recording through a long stop, so time and pace may be off.",
  },
  {
    flag: "Long-run check: Even, Negative split, Faded",
    meaning:
      "Second half within 10 s/mi of the first (Even), faster than the first (Negative split), or over 20 s/mi slower (Faded).",
  },
];

/** Key for the effort colours, run lengths and warning flags used across the app. */
export function FlagLegend() {
  return (
    <section aria-label="Legend" className="rounded-lg border border-border px-4 py-3 text-xs">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-semibold uppercase tracking-widest text-muted-foreground">
          Effort by avg pace
        </span>
        {EFFORT_BANDS.map((band) => (
          <span key={band.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: band.color }} aria-hidden />
            {band.label}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-semibold uppercase tracking-widest text-muted-foreground">
          Run length
        </span>
        <span>Short: under 5 mi</span>
        <span>Medium: 5 to 10 mi</span>
        <span>Long: 10 mi or more</span>
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer font-semibold text-foreground underline-offset-4 hover:underline">
          What the warning flags mean
        </summary>
        <dl className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
          {FLAG_MEANINGS.map((f) => (
            <div key={f.flag} className="contents">
              <dt className="font-semibold">{f.flag}</dt>
              <dd className="mb-1 text-muted-foreground sm:mb-0">{f.meaning}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}
