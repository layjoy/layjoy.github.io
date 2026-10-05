import { useState } from "react";
import { useApp } from "../state";
import { notePin, pinLocked } from "./pinGuard";

function Pad({ onSubmit, disabled }: { onSubmit: (pin: string) => void; disabled?: boolean }) {
  const [pin, setPin] = useState("");

  function push(digit: string) {
    if (disabled) return;
    const next = (pin + digit).slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      setPin("");
      onSubmit(next);
    }
  }

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  return (
    <div>
      <div className="pin-dots" aria-label={`已输入 ${pin.length} 位`}>
        {[0, 1, 2, 3].map((index) => (
          <i key={index} className={index < pin.length ? "on" : ""} />
        ))}
      </div>
      <div className="pad">
        {digits.map((digit) => (
          <button key={digit} type="button" className="btn" data-digit={digit} onClick={() => push(digit)} disabled={disabled}>
            {digit}
          </button>
        ))}
        <button type="button" className="btn" data-act="pin-del" onClick={() => setPin((value) => value.slice(0, -1))} disabled={disabled}>
          删除
        </button>
      </div>
    </div>
  );
}

export function SetPin({ onReady }: { onReady: (pin: string) => void }) {
  const { setNewPin } = useApp();
  const [first, setFirst] = useState<string | null>(null);
  const [hint, setHint] = useState("请设置 4 位口令");
  const [busy, setBusy] = useState(false);

  async function submit(pin: string) {
    if (!first) {
      setFirst(pin);
      setHint("再输入一次");
      return;
    }
    if (pin !== first) {
      setFirst(null);
      setHint("两次不一样，请重新设置");
      return;
    }
    setBusy(true);
    await setNewPin(pin);
    setBusy(false);
    onReady(pin);
  }

  return (
    <div className="stack">
      <p className="bubble">{hint}</p>
      <Pad key={first ?? "new"} onSubmit={(pin) => void submit(pin)} disabled={busy} />
    </div>
  );
}

export function EnterPin({ title, onReady }: { title: string; onReady: (pin: string) => void }) {
  const { checkPin } = useApp();
  const [hint, setHint] = useState(title);
  const [locked, setLocked] = useState(pinLocked);
  const [busy, setBusy] = useState(false);

  async function submit(pin: string) {
    if (locked || pinLocked()) {
      setHint("先等一等再试");
      return;
    }
    setBusy(true);
    const ok = await checkPin(pin);
    setBusy(false);
    const wait = notePin(ok);
    if (ok) {
      onReady(pin);
      return;
    }
    setHint(wait ? "先等一等再试" : "口令不对，再试一次");
    if (wait) {
      setLocked(true);
      window.setTimeout(() => setLocked(false), wait);
    }
  }

  return (
    <div className="stack">
      <p className="bubble">{hint}</p>
      <Pad onSubmit={(pin) => void submit(pin)} disabled={locked || busy} />
    </div>
  );
}
