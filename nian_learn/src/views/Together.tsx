import { useState } from "react";
import { speak } from "../lib/speech";
import { useApp } from "../state/AppState";
import { DonePanel, Shell, StepDots, TopBar } from "../ui/bits";

type Activity = "colors" | "count" | "praise" | null;

export function Together({ onHome }: { onHome: () => void }) {
  const { pack, data, record } = useApp();
  const [activity, setActivity] = useState<Activity>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [colorId, setColorId] = useState<string | null>(null);
  const [stars, setStars] = useState<boolean[]>([]);
  const [childLine, setChildLine] = useState<string | null>(null);
  const [parentLine, setParentLine] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!pack || !data) return null;
  const copy = pack.together;
  const starCount = copy.countByBand[data.ageBand] ?? copy.countByBand.pre ?? 5;

  function open(next: Activity) {
    setActivity(next);
    setStep(1);
    setColorId(null);
    setStars(Array.from({ length: starCount }, () => false));
    setChildLine(null);
    setParentLine(null);
    setDone(false);
    if (next === "colors") speak(copy.lines.colorsAsk);
    if (next === "count") speak(copy.lines.countAsk);
    if (next === "praise") speak(copy.lines.praiseAsk);
  }

  function finish() {
    record("together");
    setDone(true);
    setStep(3);
    speak("完成啦");
  }

  return (
    <Shell testId="together-screen">
      <TopBar title="一起玩" onBack={onHome} />
      {!activity ? (
        <section className="stack">
          <h2>请爸爸妈妈一起来</h2>
          <button type="button" className="tap" data-testid="together-colors" onClick={() => open("colors")}>
            颜色问答
          </button>
          <button type="button" className="tap" data-testid="together-count" onClick={() => open("count")}>
            一起数数
          </button>
          <button type="button" className="tap" data-testid="together-praise" onClick={() => open("praise")}>
            互相夸奖
          </button>
        </section>
      ) : (
        <StepDots step={step} />
      )}
      {activity === "colors" && step === 1 ? (
        <section className="stack center">
          <p className="cheer">{copy.lines.colorsAsk}</p>
          <button type="button" className="tap" data-testid="together-start" onClick={() => setStep(2)}>
            开始
          </button>
        </section>
      ) : null}
      {activity === "colors" && step === 2 ? (
        <section className="stack">
          <div className="choice-grid multi">
            {copy.colors.map((color) => (
              <button
                key={color.id}
                type="button"
                className="tap choice"
                data-testid={`color-${color.id}`}
                style={{ background: color.swatch }}
                onClick={() => setColorId(color.id)}
              >
                {color.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="tap"
            data-testid="together-heard"
            disabled={!colorId}
            onClick={finish}
          >
            {copy.lines.colorsHeard}
          </button>
        </section>
      ) : null}
      {activity === "count" && step === 1 ? (
        <section className="stack center">
          <p className="cheer">{copy.lines.countAsk}</p>
          <button type="button" className="tap" data-testid="together-start" onClick={() => setStep(2)}>
            开始数
          </button>
        </section>
      ) : null}
      {activity === "count" && step === 2 ? (
        <section className="stack">
          <div className="star-grid">
            {stars.map((on, index) => (
              <button
                key={index}
                type="button"
                className={on ? "tap star on" : "tap star"}
                data-testid={`star-${index}`}
                onClick={() => {
                  if (stars[index]) return;
                  const next = stars.slice();
                  next[index] = true;
                  setStars(next);
                  speak(String(next.filter(Boolean).length));
                }}
              >
                {on ? "⭐" : "☆"}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="tap"
            data-testid="count-done"
            disabled={stars.some((on) => !on)}
            onClick={finish}
          >
            数完了
          </button>
        </section>
      ) : null}
      {activity === "praise" && step === 1 ? (
        <section className="stack center">
          <p className="cheer">{copy.lines.praiseAsk}</p>
          <button type="button" className="tap" data-testid="together-start" onClick={() => setStep(2)}>
            开始
          </button>
        </section>
      ) : null}
      {activity === "praise" && step === 2 ? (
        <section className="stack">
          <h2>孩子说</h2>
          <div className="choice-grid">
            {copy.praises.child.map((line) => (
              <button
                key={line}
                type="button"
                className={childLine === line ? "tap" : "tap ghost"}
                data-testid="praise-child"
                onClick={() => setChildLine(line)}
              >
                {line}
              </button>
            ))}
          </div>
          <h2>家长说</h2>
          <div className="choice-grid">
            {copy.praises.parent.map((line) => (
              <button
                key={line}
                type="button"
                className={parentLine === line ? "tap" : "tap ghost"}
                data-testid="praise-parent"
                onClick={() => setParentLine(line)}
              >
                {line}
              </button>
            ))}
          </div>
          <button type="button" className="tap" data-testid="praise-done" disabled={!childLine || !parentLine} onClick={finish}>
            说完了
          </button>
        </section>
      ) : null}
      {done ? <DonePanel text="一起完成啦" onHome={onHome} /> : null}
    </Shell>
  );
}
