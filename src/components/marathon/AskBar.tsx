import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { askCoach } from "@/lib/ai.functions";
import { useQuestions, useSaveQuestion } from "@/lib/data";
import { buildAiContext, type Dashboard } from "@/lib/dashboard";

export function AskBar({ d, daysAvailable }: { d: Dashboard; daysAvailable: string[] }) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const history = useQuestions(d.userId);
  const saveQuestion = useSaveQuestion(d.userId);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setBusy(true);
    setAnswer(null);
    try {
      const res = await askCoach({
        data: { question: question.trim(), context: buildAiContext(d, { daysAvailable }) },
      });
      setAnswer(res.answer);
      await saveQuestion.mutateAsync({
        question: question.trim(),
        answer: res.answer,
        suggested_workout: res.suggested ?? null,
      });
      setQuestion("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reach your coach right now");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface-card poster-field p-6">
      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={ask}>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-12 pl-10 text-base"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a training question…"
          />
        </div>
        <Button type="submit" className="h-12 px-7" disabled={busy}>
          {busy ? "Thinking…" : "Ask"}
        </Button>
      </form>

      {answer && (
        <div className="mt-4 rounded-lg bg-muted/60 p-4">
          <p className="whitespace-pre-wrap text-sm">{answer}</p>
        </div>
      )}

      {(history.data?.length ?? 0) > 0 && (
        <button
          type="button"
          className="mt-2 inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => setShowHistory(!showHistory)}
        >
          {showHistory ? "Hide" : "Show"} past questions ({history.data?.length ?? 0})
        </button>
      )}

      {showHistory && (
        <ul className="mt-3 space-y-3">
          {(history.data ?? []).map((q) => (
            <li key={q.id} className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground tnum">
                {new Date(q.asked_at).toLocaleString()}
              </p>
              <p className="mt-1 text-sm font-medium">{q.question}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{q.answer}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
