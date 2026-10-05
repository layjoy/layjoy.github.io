import { useState } from "react";
import { makeQuestion, type MathQuestion } from "../lib/math";
import { speak } from "../lib/speech";
import { useApp } from "../state/AppState";
import { DonePanel, Shell, StepDots, TopBar } from "../ui/bits";

export function MathActivity({ onHome }: { onHome: () => void }) {
  const { pack, data, record } = useApp();
  const band = pack?.math[data?.ageBand ?? "pre"] ?? pack?.math.pre;
  const [question, setQuestion] = useState<MathQuestion | null>(() => (band ? makeQuestion(band) : null));
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [wrong, setWrong] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  if (!question || !band) return null;

  return (
    <Shell testId="math-screen">
      <TopBar title="数学" onBack={onHome} />
      <StepDots step={step} />
      {step === 1 ? (
        <section className="stack center">
          <p className="prompt" data-testid="math-prompt">{question.prompt}</p>
          <button type="button" className="tap ghost" data-testid="math-listen" onClick={() => speak(question.speak)}>
            听一听
          </button>
          <button type="button" className="tap" data-testid="math-start" onClick={() => { setStep(2); speak(question.speak); }}>
            我来答
          </button>
        </section>
      ) : null}
      {step === 2 ? (
        <section className="stack">
          <p className="prompt">{question.prompt}</p>
          <div className="choice-grid multi">
            {question.options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="tap choice"
                data-testid="math-option"
                data-wrong={wrong.includes(opt.id) ? "1" : "0"}
                onClick={() => {
                  if (opt.correct) {
                    record("math");
                    setDone(true);
                    setStep(3);
                    speak("做得好");
                  } else {
                    setWrong((prev) => (prev.includes(opt.id) ? prev : [...prev, opt.id]));
                    speak("再试一次");
                  }
                }}
              >
                {opt.emoji ? <span className="pic sm" aria-hidden="true">{opt.emoji}</span> : null}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
          <p className="msg" role="status">{wrong.length ? "再试一次" : "点一个答案"}</p>
        </section>
      ) : null}
      {step === 3 && done ? (
        <div className="stack">
          <DonePanel text="做对啦" onHome={onHome} />
          <button
            type="button"
            className="tap ghost"
            data-testid="activity-again"
            onClick={() => {
              setQuestion(makeQuestion(band));
              setStep(1);
              setWrong([]);
              setDone(false);
            }}
          >
            再来一题
          </button>
        </div>
      ) : null}
    </Shell>
  );
}
