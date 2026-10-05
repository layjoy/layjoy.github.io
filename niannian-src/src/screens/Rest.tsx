import { useEffect } from "react";
import type { BlockReason } from "../rules/time";
import { REST_COPY } from "../rules/time";
import { Mascot } from "../ui/Mascot";
import { Shell, goParent } from "../ui/Shell";
import { speak } from "../voice/speak";

export function Rest({ reason }: { reason: BlockReason }) {
  const line = REST_COPY[reason];
  useEffect(() => {
    speak(line);
  }, [line]);

  return (
    <Shell>
      <div className="mascot-row">
        <Mascot />
        <div>
          <h1>年年学习乐园</h1>
          <p className="sub">为年年准备</p>
        </div>
      </div>
      <p className="banner ok" data-act="rest" data-reason={reason}>
        {line}
      </p>
      <p className="bubble">小星还在。我们明天再玩，或者等家长说可以玩的时候再来。</p>
      <button type="button" className="quiet" data-act="parent" onClick={goParent}>
        家长
      </button>
    </Shell>
  );
}
