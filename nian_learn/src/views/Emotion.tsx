import { useState } from "react";
import { speak } from "../lib/speech";
import { useApp } from "../state/AppState";
import { DonePanel, Shell, StepDots, TopBar } from "../ui/bits";

export function Emotion({ onHome }: { onHome: () => void }) {
  const { pack, record } = useApp();
  const [picked, setPicked] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [breath, setBreath] = useState<"吸气" | "呼气">("吸气");
  const [done, setDone] = useState(false);
  if (!pack) return null;
  const item = pack.emotions.find((emotion) => emotion.id === picked) ?? null;

  return (
    <Shell testId="emotion-screen">
      <TopBar title="心情" onBack={onHome} />
      <StepDots step={step} />
      {step === 1 ? (
        <section className="stack">
          <h2>现在心里是什么感觉？</h2>
          <div className="choice-grid multi">
            {pack.emotions.map((emotion) => (
              <button
                key={emotion.id}
                type="button"
                className="tap choice"
                data-testid={`emo-${emotion.id}`}
                onClick={() => {
                  setPicked(emotion.id);
                  setStep(2);
                  speak(emotion.line);
                }}
              >
                <span className="pic sm" aria-hidden="true">{emotion.emoji}</span>
                <span>{emotion.label}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {step === 2 && item ? (
        <section className="stack center">
          <p className="cheer">{item.line}</p>
          <div className={breath === "呼气" ? "breath out" : "breath"} aria-hidden="true" />
          <button
            type="button"
            className="tap ghost"
            data-testid="emo-breath"
            onClick={() => {
              const next = breath === "吸气" ? "呼气" : "吸气";
              setBreath(next);
              speak(next);
            }}
          >
            跟着呼吸：{breath}
          </button>
          <button
            type="button"
            className="tap"
            data-testid="emo-next"
            onClick={() => {
              record("emotion", picked ? { emotionId: picked } : undefined);
              setDone(true);
              setStep(3);
              speak("我在这儿");
            }}
          >
            下一步
          </button>
        </section>
      ) : null}
      {done ? <DonePanel text="谢谢你告诉我。" onHome={onHome} /> : null}
    </Shell>
  );
}
