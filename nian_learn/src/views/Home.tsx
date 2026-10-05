import { enabledAgeBands, playableSubjects } from "../lib/registry";
import { speak } from "../lib/speech";
import { remainingSeconds } from "../lib/time";
import { useApp } from "../state/AppState";
import type { Screen } from "../types";
import { Mascot, Shell } from "../ui/bits";

export function Home({ onOpen }: { onOpen: (screen: Screen) => void }) {
  const { data, setAgeBand, setVoice } = useApp();
  if (!data) return null;
  const left = remainingSeconds(data);
  const mins = Math.max(1, Math.ceil(left / 60));
  const timeText = left <= 0 ? "马上要休息啦" : `大约还剩 ${mins} 分钟`;
  const modules = playableSubjects().filter((item) => item.moduleId && data.rules.modulesEnabled[item.moduleId]);

  return (
    <Shell>
      <div className="hero">
        <Mascot />
        <div>
          <h1>年年学</h1>
          <p>选一个想玩的。</p>
        </div>
      </div>
      <p className="time-left" data-testid="time-left">{timeText}</p>
      <div className="timebar" aria-hidden="true">
        <div
          className="timebar-fill"
          style={{ width: `${Math.min(100, (data.usage.secondsToday / (data.rules.dailyLimitMinutes * 60)) * 100)}%` }}
        />
      </div>
      <div className="row" role="group" aria-label="年龄段">
        {enabledAgeBands().map((band) => (
          <button
            key={band.id}
            type="button"
            className={data.ageBand === band.id ? "tap" : "tap ghost"}
            data-testid={`age-${band.id}`}
            onClick={() => setAgeBand(band.id)}
          >
            {band.label}
          </button>
        ))}
      </div>
      <div className="module-grid">
        {modules.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`tap card tint-${item.id}`}
            data-testid={`mod-${item.id}`}
            onClick={() => item.screen && onOpen(item.screen)}
          >
            <span className="card-emoji" aria-hidden="true">{item.emoji}</span>
            <span className="card-title">{item.title}</span>
            <span className="card-short">{item.short}</span>
          </button>
        ))}
      </div>
      <div className="row">
        <button
          type="button"
          className="tap ghost"
          data-testid="home-listen"
          onClick={() => speak("小猫是英语。数字是数学。汉字是语文。笑脸是心情。星星是习惯。握手是一起玩。")}
        >
          听首页
        </button>
        <button
          type="button"
          className="tap ghost"
          data-testid="voice-toggle"
          aria-pressed={data.voiceOn}
          onClick={() => setVoice(!data.voiceOn)}
        >
          {data.voiceOn ? "语音开" : "语音关"}
        </button>
      </div>
      <p className="note">
        每天建议玩 20 到 30 分钟。现在每天 {data.rules.dailyLimitMinutes} 分钟，每次 {data.rules.sessionLimitMinutes} 分钟。爸爸妈妈可以改。
      </p>
      <button type="button" className="tap ghost wide" data-testid="parent-link" onClick={() => onOpen("parent")}>
        家长入口
      </button>
    </Shell>
  );
}
