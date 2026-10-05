import { useState, type FormEvent } from "react";
import { useApp } from "../state/AppState";
import { Mascot, Shell } from "../ui/bits";

export function Setup() {
  const { setup, join } = useApp();
  const [mode, setMode] = useState<"new" | "join">("new");
  const [family, setFamily] = useState("");
  const [pass, setPass] = useState("");
  const [again, setAgain] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (mode === "new" && pass !== again) {
      setMsg("两次不一样，再试一次");
      return;
    }
    setBusy(true);
    const err = mode === "join" ? await join(family, pass) : await setup(pass);
    setBusy(false);
    if (err) setMsg(err);
  }

  return (
    <Shell testId="setup-screen">
      <div className="hero">
        <Mascot />
        <h1>年年学</h1>
        <p>请爸爸妈妈先设一个口令。孩子不用记。</p>
      </div>
      <form className="card stack" onSubmit={onSubmit}>
        <p>学习记录会先用这个口令加密，再存到家里的服务器。没有网络时先记在这台设备，连上后再送过去。建议每天玩 20 到 30 分钟。现在默认每天 25 分钟，每次 15 分钟，然后休息 5 分钟。之后可以改。</p>
        <div className="row" role="group" aria-label="家庭">
          <button type="button" className={mode === "new" ? "tap" : "tap ghost"} data-testid="setup-new" onClick={() => setMode("new")}>
            这台是新的
          </button>
          <button type="button" className={mode === "join" ? "tap" : "tap ghost"} data-testid="setup-join" onClick={() => setMode("join")}>
            加入已有家庭
          </button>
        </div>
        {mode === "join" ? (
          <label>
            家庭码
            <input
              data-testid="setup-family"
              autoComplete="off"
              value={family}
              onChange={(e) => setFamily(e.target.value)}
            />
          </label>
        ) : null}
        <label>
          家长口令
          <input
            data-testid="setup-pass"
            type="password"
            autoComplete="new-password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
        </label>
        {mode === "new" ? (
          <label>
            再输入一次
            <input
              data-testid="setup-pass2"
              type="password"
              autoComplete="new-password"
              value={again}
              onChange={(e) => setAgain(e.target.value)}
            />
          </label>
        ) : null}
        {msg ? <p className="msg" role="alert">{msg}</p> : null}
        <button className="tap" type="submit" data-testid="setup-submit" disabled={busy}>
          {busy ? "请稍等" : mode === "join" ? "加入" : "设好了"}
        </button>
      </form>
    </Shell>
  );
}

export function Unlock() {
  const { unlock } = useApp();
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const err = await unlock(pass);
    setBusy(false);
    if (err) setMsg(err);
  }

  return (
    <Shell testId="unlock-screen">
      <div className="hero">
        <Mascot />
        <h1>请爸爸妈妈来</h1>
        <p>这台设备需要再输入一次口令，才能打开学习记录。</p>
      </div>
      <form className="card stack" onSubmit={onSubmit}>
        <label>
          家长口令
          <input
            data-testid="unlock-pass"
            type="password"
            autoComplete="current-password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
        </label>
        {msg ? <p className="msg" role="alert">{msg}</p> : null}
        <button className="tap" type="submit" data-testid="unlock-submit" disabled={busy}>
          {busy ? "请稍等" : "打开"}
        </button>
      </form>
    </Shell>
  );
}
