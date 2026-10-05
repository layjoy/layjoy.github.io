import { useEffect, useState } from "react";
import { speak } from "../lib/speech";
import { useApp } from "../state/AppState";
import { Mascot, Shell } from "../ui/bits";

export function Lock({ onHome, onParent }: { onHome: () => void; onParent: () => void }) {
  const { lock } = useApp();
  const [now, setNow] = useState(() => Date.now());
  const [breath, setBreath] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    if (lock?.reason === "daily") speak("今天玩够啦，明天再来");
    else if (lock?.reason === "session") speak("我们休息一下");
    return () => window.clearInterval(timer);
  }, [lock?.reason]);

  const left = lock?.until ? Math.max(0, Math.ceil((lock.until - now) / 1000)) : 0;
  const mm = Math.floor(left / 60);
  const ss = `${left % 60}`.padStart(2, "0");

  return (
    <Shell testId="lock-screen">
      <div className="hero">
        <Mascot />
        <h1>休息一下</h1>
      </div>
      {lock?.reason === "daily" ? (
        <section className="card stack">
          <p className="cheer" data-testid="lock-reason">今天的时间用完啦。明天再一起玩。</p>
          <p>可以看看远处，喝口水。</p>
        </section>
      ) : null}
      {lock?.reason === "session" ? (
        <section className="card stack">
          <p className="cheer" data-testid="lock-reason">玩得差不多啦，我们歇一会儿。</p>
          <p data-testid="lock-countdown">还要休息 {mm} 分 {ss} 秒</p>
          <div className={breath ? "breath out" : "breath"} aria-hidden="true" />
          <button type="button" className="tap ghost" onClick={() => setBreath((v) => !v)}>
            {breath ? "呼气" : "吸气"}
          </button>
        </section>
      ) : null}
      {!lock ? (
        <section className="card stack">
          <p className="cheer">可以继续了。</p>
          <button type="button" className="tap" data-testid="lock-continue" onClick={onHome}>
            继续玩
          </button>
        </section>
      ) : null}
      <button type="button" className="tap ghost wide" data-testid="parent-link" onClick={onParent}>
        家长入口
      </button>
    </Shell>
  );
}
