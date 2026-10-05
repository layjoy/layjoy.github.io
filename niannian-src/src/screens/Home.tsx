import { useEffect } from "react";
import { useApp } from "../state";
import { activityAt, moduleEnabled, modules, openingLine } from "../extensions/subjects";
import { Mascot } from "../ui/Mascot";
import { Shell, goParent } from "../ui/Shell";
import { WELCOME, speak } from "../voice/speak";

export function Home() {
  const { rules } = useApp();

  useEffect(() => {
    speak(WELCOME);
  }, []);

  function openModule(id: string) {
    const line = openingLine(activityAt(id, rules.ageBand, 0));
    if (line) speak(line.text, line.lang);
    location.hash = `#/play/${id}`;
  }

  const visible = modules().filter((item) => moduleEnabled(rules, item.id));

  return (
    <Shell>
      <div className="mascot-row">
        <Mascot />
        <div>
          <h1>年年学习乐园</h1>
          <p className="sub">为年年准备</p>
        </div>
      </div>
      <p className="bubble">{WELCOME}</p>
      {visible.length ? (
        <div className="worlds">
          {visible.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`world-card ${item.tone}`}
              data-act={`module-${item.id}`}
              onClick={() => openModule(item.id)}
            >
              <span className="mark" aria-hidden="true">
                {item.emoji}
              </span>
              <b>{item.title}</b>
              <span>{item.blurb}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="bubble">今天先休息。请家长打开一个模块。</p>
      )}
      <button type="button" className="quiet" data-act="parent" onClick={goParent}>
        家长
      </button>
    </Shell>
  );
}
