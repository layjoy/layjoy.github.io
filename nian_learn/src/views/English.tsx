import { useEffect, useState } from "react";
import { speak } from "../lib/speech";
import { useApp } from "../state/AppState";
import type { EnglishWord } from "../types";
import { DonePanel, Pic, Shell, StepDots, TopBar } from "../ui/bits";

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function English({ onHome }: { onHome: () => void }) {
  const { pack, data, record } = useApp();
  const count = data?.ageBand === "g1" ? 3 : 2;
  const [round, setRound] = useState(() => makeRound(pack?.english ?? [], count));
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [wrong, setWrong] = useState<string[]>([]);
  const [micMsg, setMicMsg] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!round) return;
    if (step === 1) speak(`${round.target.zh}，${round.target.en}`, "zh-CN");
    if (step === 2) speak(round.target.en, "en-US");
    if (step === 3) speak("跟我读一读", "zh-CN");
    return () => {};
  }, [step, round]);

  if (!pack || !data || !round) return null;

  function nextRound() {
    setRound(makeRound(pack!.english, data!.ageBand === "g1" ? 3 : 2));
    setStep(1);
    setWrong([]);
    setMicMsg("");
    setDone(false);
  }

  async function tryMic() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMicMsg("这台设备没法录音。你可以自己听一听，再点「我说对了」。");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      rec.start();
      setMicMsg("正在听你说…");
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
      await new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
        if (rec.state !== "inactive") rec.stop();
        else resolve();
      });
      stream.getTracks().forEach((track) => track.stop());
      setMicMsg("我听到声音啦。你觉得自己说对了吗？声音不会被保存。");
    } catch {
      setMicMsg("没有麦克风也可以。听一听，再点「我说对了」。");
    }
  }

  return (
    <Shell testId="english-screen">
      <TopBar title="英语" onBack={onHome} />
      <StepDots step={step} />
      {step === 1 ? (
        <section className="stack center">
          <Pic emoji={round.target.emoji} label={round.target.zh} />
          <p className="word-en">{round.target.en}</p>
          <p className="hint">{round.target.zh}</p>
          <button type="button" className="tap" data-testid="en-listen" onClick={() => speak(round.target.en, "en-US")}>
            听一听
          </button>
          <button type="button" className="tap ghost" data-testid="en-next" onClick={() => setStep(2)}>
            下一步
          </button>
        </section>
      ) : null}
      {step === 2 ? (
        <section className="stack">
          <h2>听声音，点图片</h2>
          <button type="button" className="tap ghost" data-testid="en-replay" onClick={() => speak(round.target.en, "en-US")}>
            再听一次
          </button>
          <div className="choice-grid multi">
            {round.options.map((word) => (
              <button
                key={word.id}
                type="button"
                className="tap choice"
                data-testid="en-choice"
                data-wrong={wrong.includes(word.id) ? "1" : "0"}
                onClick={() => {
                  if (word.id === round.target.id) {
                    setStep(3);
                    setWrong([]);
                  } else {
                    setWrong((prev) => (prev.includes(word.id) ? prev : [...prev, word.id]));
                    speak("再试一次");
                  }
                }}
              >
                <Pic emoji={word.emoji} label={`图片 ${word.emoji}`} />
              </button>
            ))}
          </div>
          <p className="msg" role="status">{wrong.length ? "再试一次" : "听不见时，可以再听一次"}</p>
        </section>
      ) : null}
      {step === 3 && !done ? (
        <section className="stack center">
          <Pic emoji={round.target.emoji} label={round.target.zh} />
          <p className="word-en">{round.target.en}</p>
          <button type="button" className="tap ghost" onClick={() => speak(round.target.en, "en-US")}>
            听一听
          </button>
          <button type="button" className="tap ghost" data-testid="en-mic" onClick={() => void tryMic()}>
            试着说一说
          </button>
          {micMsg ? <p className="msg" role="status">{micMsg}</p> : null}
          <button
            type="button"
            className="tap"
            data-testid="en-self-ok"
            onClick={() => {
              record("english");
              setDone(true);
              speak("完成啦");
            }}
          >
            我说对了
          </button>
        </section>
      ) : null}
      {done ? (
        <div className="stack">
          <DonePanel text="完成啦" onHome={onHome} />
          <button type="button" className="tap ghost" data-testid="activity-again" onClick={nextRound}>
            再来一个
          </button>
        </div>
      ) : null}
    </Shell>
  );
}

function makeRound(words: EnglishWord[], count: number) {
  if (words.length < 2) return null;
  const shuffled = shuffle(words);
  const target = shuffled[0];
  const options = shuffle(shuffled.slice(0, Math.min(count, shuffled.length)));
  return { target, options };
}
