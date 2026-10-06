import type { Dashboard } from "@/lib/dashboard";
import {
  DAY_BEFORE,
  DURING_RACE,
  RACE_MORNING,
  START_LABEL,
  TRAINING_NOTES,
  gelSchedule,
  type FuelingNote,
} from "@/lib/raceFueling";
import { formatDuration } from "@/lib/training";
import { Collapsible, FuelingNotes } from "./ProgressTab";

function NoteCard({ note, children }: { note: FuelingNote; children?: React.ReactNode }) {
  return (
    <article className="surface-card p-5">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{note.when}</p>
      <h4 className="mt-1 font-display text-xl font-bold">{note.title}</h4>
      {children}
      <ul className="mt-3 space-y-2 text-sm">
        {note.points.map((p) => (
          <li key={p} className="grid grid-cols-[0.75rem_minmax(0,1fr)] gap-1">
            <span aria-hidden className="text-muted-foreground">
              ·
            </span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

/**
 * Fueling notes: everyday training meals, around long runs, alcohol, then the
 * race weekend (day before, race morning, gels by mile at the goal pace).
 */
export function RaceFuelingNotes({ d }: { d: Dashboard }) {
  const goal = d.activeTarget?.target_seconds ?? 4.25 * 3600;
  const gels = gelSchedule(goal);

  return (
    <section id="fueling" className="scroll-mt-6 space-y-4">
      <h3 className="section-kicker">Fueling notes</h3>
      <p className="text-sm text-muted-foreground">
        General recommendations from Claude, not medical advice. Adjust to what works for your
        stomach, and try anything new on a long run, never on race day.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {TRAINING_NOTES.map((note) => (
          <NoteCard key={note.title} note={note} />
        ))}
      </div>
      <h4 className="section-kicker pt-2">Race weekend</h4>
      <p className="text-sm text-muted-foreground">
        Times assume a {START_LABEL} start; shift them to your wave.
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        <NoteCard note={DAY_BEFORE} />
        <NoteCard note={RACE_MORNING} />
        <NoteCard note={DURING_RACE}>
          <table className="mt-3 w-full text-sm tnum">
            <caption className="mb-1 text-left text-xs text-muted-foreground">
              Gels at your {formatDuration(goal)} goal pace
            </caption>
            <tbody>
              {gels.map((g) => (
                <tr key={g.mile} className="border-t border-border">
                  <td className="py-1.5 pr-3 font-semibold">Mile {g.mile}</td>
                  <td className="py-1.5 pr-3">{g.clock}</td>
                  <td className="py-1.5 text-right text-muted-foreground">
                    {g.optional ? "Optional gel" : "Gel + water"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </NoteCard>
      </div>
      <Collapsible title="What you've practiced">
        <FuelingNotes d={d} />
      </Collapsible>
    </section>
  );
}
