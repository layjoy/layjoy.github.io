import { useMemo, useState } from "react";
import { speak } from "../lib/speech";
import { useApp } from "../state/AppState";
import type { HanziItem, PinyinItem } from "../types";
import { DonePanel, Shell, StepDots, TopBar } from "../ui/bits";

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

type Mode = "hanzi" | "pinyin";

export function Chinese({ onHome }: { onHome: () => void }) {
  const { pack, data, record } = useApp();
  const [mode, setMode] = useState<Mode>("hanzi");
  const [nonce, setNonce] = useState(0);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [wrong, setWrong] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const ageBand = data?.ageBand;
  const choiceCount = ageBand === "g1" ? 3 : 2;
  const round = useMemo(() => {
    if (!pack) return null;
    if (mode === "hanzi") return makeHanzi(pack.chinese.characters, choiceCount);
    return makePinyin(poolFor(pack.chinese.pinyin, pack.chinese.bands[ageBand ?? "pre"]), choiceCount);
  }, [pack, mode, nonce, choiceCount, ageBand]);

  if (!pack || !data || !round) return null;

  function restart(nextMode = mode) {
    setMode(nextMode);
    setNonce((n) => n + 1);
    setStep(1);
    setWrong([]);
    setDone(false);
  }

  return (
    <Shell testId="chinese-screen">
      <TopBar title="语文" onBack={onHome} />
      <StepDots step={step} />
      {step === 1 ? (
        <div className="row">
          <button type="button" className={mode === "hanzi" ? "tap" : "tap ghost"} data-testid="zh-mode-hanzi" onClick={() => restart("hanzi")}>
            汉字
          </button>
          <button type="button" className={mode === "pinyin" ? "tap" : "tap ghost"} data-testid="zh-mode-pinyin" onClick={() => restart("pinyin")}>
            拼音
          </button>
        </div>
      ) : null}
      {round?.kind === "hanzi" && step === 1 ? (
        <section className="stack center">
          <p className="hanzi">{round.target.char}</p>
          <p className="hint">{round.target.pinyin}</p>
          <p className="hint">组词：{round.target.words[0]}、{round.target.words[1]}</p>
          <button type="button" className="tap" data-testid="zh-listen" onClick={() => speak(`${round.target.char}，${round.target.words[0]}`)}>
            听一听
          </button>
          <button type="button" className="tap ghost" data-testid="zh-next" onClick={() => { setStep(2); speak("点这个字"); }}>
            下一步
          </button>
        </section>
      ) : null}
      {round?.kind === "pinyin" && step === 1 ? (
        <section className="stack center">
          <p className="hint">{round.target.group}</p>
          <p className="hanzi">{round.target.show}</p>
          <button type="button" className="tap" data-testid="zh-listen" onClick={() => speak(round.target.speak)}>
            听一听
          </button>
          <button type="button" className="tap ghost" data-testid="zh-next" onClick={() => { setStep(2); speak("点相同的"); }}>
            下一步
          </button>
        </section>
      ) : null}
      {round && step === 2 ? (
        <section className="stack">
          <h2>{round.kind === "hanzi" ? `${round.target.pinyin}，点这个字` : "听一听，点相同的"}</h2>
          <button
            type="button"
            className="tap ghost"
            onClick={() => speak(round.kind === "hanzi" ? round.target.char : round.target.speak)}
          >
            再听一次
          </button>
          <div className="choice-grid multi">
            {round.options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="tap choice"
                data-testid="zh-choice"
                data-wrong={wrong.includes(opt.id) ? "1" : "0"}
                onClick={() => {
                  if (opt.id === round.target.id) {
                    record("chinese");
                    setDone(true);
                    setStep(3);
                    speak("做得好");
                  } else {
                    setWrong((prev) => (prev.includes(opt.id) ? prev : [...prev, opt.id]));
                    speak("再试一次");
                  }
                }}
              >
                <span className="choice-letter">{opt.label}</span>
              </button>
            ))}
          </div>
          <p className="msg" role="status">{wrong.length ? "再试一次" : "点一个"}</p>
        </section>
      ) : null}
      {done ? (
        <div className="stack">
          <DonePanel text="完成啦" onHome={onHome} />
          <button type="button" className="tap ghost" data-testid="activity-again" onClick={() => restart()}>
            再来一个
          </button>
        </div>
      ) : null}
    </Shell>
  );
}

function poolFor(items: PinyinItem[], band: string[] | "all" | undefined): PinyinItem[] {
  if (!band || band === "all") return items;
  const picked = items.filter((item) => band.includes(item.id));
  return picked.length >= 2 ? picked : items;
}

function makeHanzi(items: HanziItem[], count: number) {
  const shuffled = shuffle(items);
  const target = shuffled[0];
  const options = shuffle(shuffled.slice(0, Math.min(count, shuffled.length))).map((item) => ({
    id: item.id,
    label: item.char,
  }));
  return { kind: "hanzi" as const, target, options };
}

function makePinyin(items: PinyinItem[], count: number) {
  const shuffled = shuffle(items);
  const target = shuffled[0];
  const options = shuffle(shuffled.slice(0, Math.min(count, shuffled.length))).map((item) => ({
    id: item.id,
    label: item.show,
  }));
  return { kind: "pinyin" as const, target, options };
}
