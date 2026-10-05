import { useState } from "react";
import { speak } from "../lib/speech";
import { useApp } from "../state/AppState";
import type { HabitState } from "../types";
import { DonePanel, Shell, StepDots, TopBar } from "../ui/bits";

export function Habits({ onHome }: { onHome: () => void }) {
  const { pack, data, markHabit } = useApp();
  const [picked, setPicked] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [result, setResult] = useState<HabitState | null>(null);
  if (!pack || !data) return null;
  const habit = pack.habits.find((item) => item.id === picked) ?? null;

  return (
    <Shell testId="habits-screen">
      <TopBar title="习惯" onBack={onHome} />
      <StepDots step={step} />
      {step === 1 ? (
        <section className="stack">
          <h2>今天做到了哪一件？</h2>
          <div className="choice-grid">
            {pack.habits.map((item) => {
              const state = data.progress.habits[item.id];
              const doneToday = state?.lastDate === data.usage.date;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="tap choice"
                  data-testid={`habit-${item.id}`}
                  onClick={() => {
                    setPicked(item.id);
                    setStep(2);
                    speak(item.label);
                  }}
                >
                  <span className="pic sm" aria-hidden="true">{item.emoji}</span>
                  <span>{item.label}</span>
                  <span className="hint">{doneToday ? "今天贴过了" : item.hint}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
      {step === 2 && habit ? (
        <section className="stack center">
          <p className="cheer">给「{habit.label}」贴上星星吗？</p>
          <p className="hint">{habit.hint}</p>
          <button
            type="button"
            className="tap"
            data-testid="habit-confirm"
            onClick={() => {
              const state = markHabit(habit.id);
              setResult(state);
              setStep(3);
              speak(state.lastDate === data.usage.date && state.total > 0 ? "贴好啦" : "贴好啦");
            }}
          >
            贴上星星
          </button>
        </section>
      ) : null}
      {step === 3 && habit && result ? (
        <div className="stack">
          <p className="cheer" data-testid="habit-streak">
            {result.lastDate === data.usage.date && data.progress.habits[habit.id]?.lastDate === data.usage.date && result.streak >= 1
              ? `连续 ${result.streak} 天`
              : `连续 ${result.streak} 天`}
          </p>
          <DonePanel text={already(data.usage.date, result) ? "今天的星星在这儿" : "贴好啦"} onHome={onHome} />
        </div>
      ) : null}
    </Shell>
  );
}

function already(today: string, result: HabitState): boolean {
  return result.lastDate === today && result.total > 1 && result.streak >= 1;
}
