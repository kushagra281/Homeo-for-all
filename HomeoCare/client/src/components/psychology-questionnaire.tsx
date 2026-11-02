import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { PSY_QUESTIONS, PSY_SECTIONS, type PsyAnswers } from "@/lib/psychology";

interface Props {
  initialAnswers: PsyAnswers;
  initialNote: string;
  onDone: (answers: PsyAnswers, note: string) => void;
  onCancel: () => void;
}

// One screen per section. Nothing is required: "Skip section" and "Done" are always available.
export default function PsychologyQuestionnaire({ initialAnswers, initialNote, onDone, onCancel }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<PsyAnswers>(initialAnswers);
  const [note, setNote] = useState(initialNote);

  const lastStep = PSY_SECTIONS.length;               // the extra step is the free-text note
  const isNoteStep = step === lastStep;
  const section = PSY_SECTIONS[step];
  const questions = PSY_QUESTIONS.filter((x) => x.section === section);

  const choose = (id: number, label: string, multi: boolean) =>
    setAnswers((prev) => {
      const current = prev[id] || [];
      const next = multi
        ? (current.includes(label) ? current.filter((x) => x !== label) : [...current, label])
        : (current[0] === label ? [] : [label]);
      return { ...prev, [id]: next };
    });

  const clearSection = () =>
    setAnswers((prev) => {
      const copy = { ...prev };
      for (const x of questions) delete copy[x.id];
      return copy;
    });

  const answered = Object.values(answers).filter((a) => a.length > 0).length;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold">Mind and emotions</h2>
        <button className="text-sm text-neutral-500 hover:underline" onClick={onCancel}>Cancel</button>
      </div>
      <p className="text-sm text-neutral-500 mb-3">
        Optional. Answer only what applies; what you pick is added to your search as mental symptoms.
      </p>
      <Progress value={((step + 1) / (lastStep + 1)) * 100} className="mb-4" />

      {!isNoteStep ? (
        <>
          <h3 className="font-semibold mb-4">
            {step + 1}. {section}
          </h3>
          <div className="space-y-5">
            {questions.map((x) => (
              <div key={x.id}>
                <p className="text-sm font-medium mb-2">
                  {x.text} {x.multi && <span className="text-neutral-400 font-normal">(choose all that apply)</span>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {x.options.map((op) => {
                    const on = (answers[x.id] || []).includes(op.label);
                    return (
                      <button
                        key={op.label}
                        type="button"
                        aria-pressed={on}
                        onClick={() => choose(x.id, op.label, x.multi)}
                        className={`px-3 py-1.5 rounded-full border text-sm transition ${
                          on ? "bg-green-600 border-green-600 text-white" : "bg-white border-gray-300 hover:border-green-500"
                        }`}
                      >
                        {on && <Check className="inline w-3.5 h-3.5 mr-1" />}{op.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <h3 className="font-semibold mb-2">Anything else?</h3>
          <p className="text-sm text-neutral-500 mb-2">Describe your emotional state in your own words (optional).</p>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            placeholder="For example: I cry when alone, but cannot talk about it"
            rows={4}
          />
          <p className="text-xs text-neutral-400 mt-1">{answered} mental questions answered</p>
        </>
      )}

      <div className="flex justify-between mt-6">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div className="flex gap-2">
          {!isNoteStep && (
            <Button variant="ghost" onClick={() => { clearSection(); setStep((s) => s + 1); }}>Skip section</Button>
          )}
          {isNoteStep ? (
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => onDone(answers, note.trim())}>Done</Button>
          ) : (
            <Button onClick={() => setStep((s) => s + 1)}>Next <ArrowRight className="w-4 h-4 ml-1" /></Button>
          )}
        </div>
      </div>
      {!isNoteStep && (
        <button className="mt-3 text-xs text-neutral-500 hover:underline" onClick={() => onDone(answers, note.trim())}>
          Finish now with what I have answered
        </button>
      )}
    </Card>
  );
}
