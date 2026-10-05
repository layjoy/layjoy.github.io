import { useEffect, useMemo, useRef, useState } from "react";
import type { Activity, Choice, Round } from "../types";
import { useApp } from "../state";
import { activityAt, moduleEnabled, modules, openingLine } from "../extensions/subjects";
import { growthLog } from "../extensions/growth";
import { confirmTogetherLocal } from "../extensions/social";
import { dayIndex } from "../rules/time";
import { Mascot } from "../ui/Mascot";
import { EnterPin, SetPin } from "../ui/PinPad";
import { Shell, goHome } from "../ui/Shell";
import { currentCaption, speak } from "../voice/speak";

function shuffle<T>(items: T[], seed: string): T[] {
  const next = items.slice();
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
  for (let i = next.length - 1; i > 0; i -= 1) {
    hash = (Math.imul(hash ^ (hash >>> 16), 2246822507) ^ Math.imul((hash ^ (hash >>> 13)) >>> 0, 3266489909)) >>> 0;
    const j = hash % (i + 1);
    const swap = next[i];
    next[i] = next[j];
    next[j] = swap;
  }
  return next;
}

function artClass(art: string): string {
  return art.length <= 2 ? "hero-char" : "hero-word";
}

export function Play({ moduleId }: { moduleId: string }) {
  const { rules } = useApp();
  const [offset, setOffset] = useState(0);
  const meta = modules().find((item) => item.id === moduleId);
  const enabled = moduleEnabled(rules, moduleId);
  const activity = enabled ? activityAt(moduleId, rules.ageBand, offset) : null;

  if (!meta || !enabled || !activity) {
    return (
      <Shell>
        <p className="bubble">这个先不玩。回乐园选一个吧。</p>
        <button type="button" className="btn primary wide" data-act="home" onClick={goHome}>
          回乐园
        </button>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="topbar">
        <button type="button" className="btn" data-act="home" onClick={goHome}>
          回乐园
        </button>
        <h2>{meta.title}</h2>
      </div>
      <Player
        key={activity.id}
        activity={activity}
        onAgain={() => {
          const next = activityAt(moduleId, rules.ageBand, offset + 1);
          const line = openingLine(next);
          if (line) speak(line.text, line.lang);
          setOffset((value) => value + 1);
        }}
      />
    </Shell>
  );
}

function Player({ activity, onAgain }: { activity: Activity; onAgain: () => void }) {
  useEffect(() => {
    const line = openingLine(activity);
    if (line && currentCaption() !== line.text) speak(line.text, line.lang);
  }, [activity]);

  if (activity.kind === "rounds") return <Rounds activity={activity} onAgain={onAgain} />;
  if (activity.kind === "emotion") return <Emotion activity={activity} />;
  if (activity.kind === "habits") return <Habits activity={activity} />;
  return <Together activity={activity} />;
}

function useDone(activity: Activity) {
  const { rules } = useApp();
  const recorded = useRef(false);
  return () => {
    if (recorded.current) return;
    recorded.current = true;
    void growthLog.append({
      at: Date.now(),
      moduleId: activity.moduleId,
      activityId: activity.id,
      outcome: "done",
      ageBand: rules.ageBand,
    });
  };
}

function Done({ explain, onAgain }: { explain?: string; onAgain?: () => void }) {
  return (
    <div className="stack">
      <Mascot />
      <p className="banner ok" data-act="done">
        做完啦
      </p>
      {explain ? <p className="bubble">{explain}</p> : null}
      <button type="button" className="btn primary wide" data-act="home" onClick={goHome}>
        回乐园
      </button>
      {onAgain ? (
        <button type="button" className="btn wide" data-act="again" onClick={onAgain}>
          再玩一个
        </button>
      ) : null}
    </div>
  );
}

function Rounds({ activity, onAgain }: { activity: Extract<Activity, { kind: "rounds" }>; onAgain: () => void }) {
  const record = useDone(activity);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<"ask" | "ok" | "follow" | "done">("ask");
  const [wrong, setWrong] = useState<string[]>([]);
  const [explain, setExplain] = useState("");
  const round: Round | undefined = activity.rounds[step];
  const choices = useMemo(() => (round ? shuffle(round.choices, `${activity.id}-${step}`) : []), [round, activity.id, step]);

  if (!round || phase === "done") return <Done explain={explain} onAgain={onAgain} />;
  const current = round;

  function finish(text: string) {
    setExplain(text);
    setPhase("done");
    record();
    speak("做完啦");
  }

  function pick(choice: Choice) {
    if (phase !== "ask" || wrong.includes(choice.id)) return;
    if (choice.correct) {
      speak("答对啦！");
      setExplain(current.explain);
      if (current.follow) setPhase("follow");
      else if (step < activity.rounds.length - 1) setPhase("ok");
      else finish(current.explain);
      return;
    }
    speak("再试试");
    setWrong((list) => [...list, choice.id]);
  }

  function listen() {
    const line = current.listen ?? { text: current.speech, lang: current.lang };
    speak(line.text, line.lang);
  }

  return (
    <div className="stack">
      {phase === "ask" ? (
        <>
          <p className="prompt">{round.prompt}</p>
          {round.art ? <div className={artClass(round.art)}>{round.art}</div> : null}
          <button type="button" className="btn wide" data-act="listen" onClick={listen}>
            {round.listen ? "听一听" : "再听一次"}
          </button>
          {wrong.length > 0 ? <p className="banner no">再试试</p> : null}
          <div className="choices">
            {choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                className={`choice${wrong.includes(choice.id) ? " bad" : ""}`}
                data-correct={choice.correct ? "1" : "0"}
                aria-label={choice.label || "图片"}
                disabled={wrong.includes(choice.id)}
                onClick={() => pick(choice)}
              >
                {choice.art ? <span className="emo">{choice.art}</span> : null}
                {choice.label ? <span className={choice.label.length <= 2 ? "huge" : ""}>{choice.label}</span> : null}
              </button>
            ))}
          </div>
        </>
      ) : null}
      {phase === "ok" ? (
        <>
          <p className="banner ok">答对啦！</p>
          <p className="bubble">{round.explain}</p>
          <button
            type="button"
            className="btn primary wide"
            data-act="next"
            onClick={() => {
              const next = activity.rounds[step + 1];
              speak(next.speech, next.lang);
              setWrong([]);
              setPhase("ask");
              setStep((value) => value + 1);
            }}
          >
            继续
          </button>
        </>
      ) : null}
      {phase === "follow" && round.follow ? (
        <>
          <p className="banner ok">答对啦！</p>
          <div className="hero-word" lang="en">
            {round.follow.show}
          </div>
          <p className="bubble">{round.explain}</p>
          <button type="button" className="btn wide" data-act="follow" onClick={() => speak(round.follow!.speech, round.follow!.lang)}>
            跟我读
          </button>
          <button type="button" className="btn primary wide" data-act="follow-done" onClick={() => finish(round.explain)}>
            我说好了
          </button>
        </>
      ) : null}
    </div>
  );
}

function Emotion({ activity }: { activity: Extract<Activity, { kind: "emotion" }> }) {
  const record = useDone(activity);
  const prompt = activity.prompts[dayIndex(activity.prompts.length)];
  const [picked, setPicked] = useState<(typeof activity.emotions)[number] | null>(null);
  const [done, setDone] = useState(false);
  if (done) return <Done />;
  if (!picked) {
    return (
      <div className="stack">
        <p className="prompt">{prompt}</p>
        <div className="choices">
          {activity.emotions.map((item) => (
            <button
              key={item.id}
              type="button"
              className="choice"
              data-act={`emotion-${item.id}`}
              onClick={() => {
                setPicked(item);
                speak(item.soothe);
              }}
            >
              <span className="emo">{item.emoji}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="stack">
      <p className="prompt">
        {picked.emoji} {picked.label}
      </p>
      <p className="bubble">{picked.soothe}</p>
      <button
        type="button"
        className="btn primary wide"
        data-act="emotion-action"
        onClick={() => {
          record();
          setDone(true);
          speak("做完啦");
        }}
      >
        {picked.action}
      </button>
    </div>
  );
}

function Habits({ activity }: { activity: Extract<Activity, { kind: "habits" }> }) {
  const { habits, toggleHabit } = useApp();
  const record = useDone(activity);
  const tip = activity.tips[dayIndex(activity.tips.length)];
  const [done, setDone] = useState(false);
  const [note, setNote] = useState(tip);
  const any = activity.items.some((item) => habits[item.id]);
  if (done) return <Done explain={tip} />;
  return (
    <div className="stack">
      <p className="bubble">{note}</p>
      {activity.items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`btn wide${habits[item.id] ? " primary" : ""}`}
          aria-pressed={Boolean(habits[item.id])}
          data-act={`habit-${item.id}`}
          onClick={() => {
            const checking = !habits[item.id];
            toggleHabit(item.id);
            const line = checking ? "记下了" : tip;
            setNote(line);
            speak(line);
          }}
        >
          <span className="emo">{item.emoji}</span> {item.label}
          {habits[item.id] ? " · 好" : ""}
        </button>
      ))}
      <button
        type="button"
        className="btn primary wide"
        data-act="habits-done"
        disabled={!any}
        onClick={() => {
          record();
          setDone(true);
          speak("做完啦");
        }}
      >
        记好了
      </button>
    </div>
  );
}

function Together({ activity }: { activity: Extract<Activity, { kind: "together" }> }) {
  const { pinSet } = useApp();
  const record = useDone(activity);
  const [sheet, setSheet] = useState(false);
  const [done, setDone] = useState(false);

  async function confirm() {
    await confirmTogetherLocal(activity.id);
    record();
    setSheet(false);
    setDone(true);
    speak("做完啦");
  }

  if (done) return <Done explain={activity.prompt} />;
  return (
    <div className="stack">
      <p className="prompt">{activity.prompt}</p>
      <p className="bubble">{activity.detail}</p>
      <button type="button" className="btn primary wide" data-act="ask-parent" onClick={() => setSheet(true)}>
        请家长来确认
      </button>
      {sheet ? (
        <div className="modal">
          <div className="sheet">
            <h2>家长确认</h2>
            {pinSet ? <EnterPin title="请家长输入口令，确认一起做完了。" onReady={() => void confirm()} /> : <SetPin onReady={() => void confirm()} />}
            <button type="button" className="btn wide" data-act="close-parent" onClick={() => setSheet(false)}>
              先不要
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
