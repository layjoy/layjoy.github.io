import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { MODULE_IDS, MODULE_LABEL } from "../lib/defaults";
import { enabledAgeBands } from "../lib/registry";
import { useApp } from "../state/AppState";
import { formatClock } from "../lib/time";
import { Shell } from "../ui/bits";

export function Parent({ onHome }: { onHome: () => void }) {
  const api = useApp();
  const { data, parentAuthed, enterParent, saveRules, setAgeBand, setVoice, exportRules, importRules, changePass } = api;
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [nextPass, setNextPass] = useState("");
  const fails = useRef(0);
  const [waitUntil, setWaitUntil] = useState(0);

  if (!data) return null;

  async function onEnter(event: FormEvent) {
    event.preventDefault();
    if (Date.now() < waitUntil) {
      setMsg("请等一会儿再试");
      return;
    }
    setBusy(true);
    const err = await enterParent(pass);
    setBusy(false);
    if (err) {
      fails.current += 1;
      if (fails.current >= 5) {
        fails.current = 0;
        setWaitUntil(Date.now() + 30_000);
        setMsg("试太多次了。请等半分钟，让爸爸妈妈来。");
      } else {
        setMsg(err);
      }
      return;
    }
    setPass("");
    setMsg("");
  }

  if (!parentAuthed) {
    return (
      <Shell testId="parent-gate">
        <header className="topbar">
          <button type="button" className="tap ghost" data-testid="parent-back" onClick={onHome}>
            返回
          </button>
          <h1>家长入口</h1>
        </header>
        <form className="card stack" onSubmit={onEnter}>
          <p>请爸爸妈妈输入口令。孩子不能在这里改时间。</p>
          <label>
            家长口令
            <input
              data-testid="parent-pass"
              type="password"
              autoComplete="current-password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
            />
          </label>
          {msg ? <p className="msg" role="alert">{msg}</p> : null}
          <button className="tap" type="submit" data-testid="parent-enter" disabled={busy}>
            {busy ? "请稍等" : "进入"}
          </button>
        </form>
      </Shell>
    );
  }

  const rules = data.rules;
  const today = data.progress.today;

  function bump(field: "dailyLimitMinutes" | "sessionLimitMinutes" | "restMinutes", delta: number) {
    saveRules((current) => ({ ...current, [field]: current[field] + delta }));
    setMsg("已保存");
  }

  async function onExport() {
    const err = await exportRules();
    setMsg(err ?? "规则包已下载。另一台设备用同一个口令导入。");
  }

  async function onImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const json = JSON.parse(await file.text()) as unknown;
      const err = await importRules(json);
      setMsg(err ?? "规则已更新");
    } catch {
      setMsg("这个文件读不了");
    }
  }

  async function onChangePass(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const err = await changePass(nextPass);
    setBusy(false);
    setMsg(err ?? "口令已更新。请记住新口令，旧口令不能再解开规则包。");
    if (!err) setNextPass("");
  }

  return (
    <Shell testId="parent-screen">
      <header className="topbar">
        <button type="button" className="tap ghost" data-testid="parent-exit" onClick={onHome}>
          返回
        </button>
        <h1>家长后台</h1>
      </header>
      <section className="card stack">
        <h2>今天</h2>
        <p data-testid="today-summary">
          今天用时 {formatClock(data.usage.secondsToday)}。完成：英语 {today.english ?? 0}，数学 {today.math ?? 0}，语文 {today.chinese ?? 0}，心情 {today.emotion ?? 0}，习惯 {today.habits ?? 0}，一起玩 {today.together ?? 0}。
        </p>
        <p className="hint">这里只显示次数和用时，不显示题目和回答。</p>
      </section>
      <section className="card stack">
        <h2>时长</h2>
        <p>建议每天 20 到 30 分钟。改完会马上保存。</p>
        <Stepper label="每天分钟" testId="daily" value={rules.dailyLimitMinutes} onDec={() => bump("dailyLimitMinutes", -1)} onInc={() => bump("dailyLimitMinutes", 1)} />
        <Stepper label="每次分钟" testId="session" value={rules.sessionLimitMinutes} onDec={() => bump("sessionLimitMinutes", -1)} onInc={() => bump("sessionLimitMinutes", 1)} />
        <Stepper label="休息分钟" testId="rest" value={rules.restMinutes} onDec={() => bump("restMinutes", -1)} onInc={() => bump("restMinutes", 1)} />
      </section>
      <section className="card stack">
        <h2>开关和难度</h2>
        <div className="row">
          {enabledAgeBands().map((band) => (
            <button key={band.id} type="button" className={data.ageBand === band.id ? "tap" : "tap ghost"} onClick={() => setAgeBand(band.id)}>
              {band.label}
            </button>
          ))}
          <button type="button" className="tap ghost" onClick={() => setVoice(!data.voiceOn)}>
            {data.voiceOn ? "语音开" : "语音关"}
          </button>
        </div>
        {MODULE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={rules.modulesEnabled[id] ? "tap" : "tap ghost"}
            data-testid={`module-toggle-${id}`}
            onClick={() =>
            saveRules((current) => ({
              ...current,
              modulesEnabled: { ...current.modulesEnabled, [id]: !current.modulesEnabled[id] },
            }))
          }
          >
            {MODULE_LABEL[id]}{rules.modulesEnabled[id] ? "：开" : "：关"}
          </button>
        ))}
      </section>
      <section className="card stack">
        <h2>规则包</h2>
        <p>规则包只用家长口令加密。里面有时长和开关，没有孩子的学习记录。可以拷到另一台设备导入。</p>
        <button type="button" className="tap" data-testid="rules-export" onClick={() => void onExport()}>
          导出规则包
        </button>
        <label className="tap ghost file-btn">
          导入规则包
          <input data-testid="rules-import" type="file" accept="application/json,.json" onChange={(e) => void onImport(e)} />
        </label>
      </section>
      <form className="card stack" onSubmit={onChangePass}>
        <h2>修改口令</h2>
        <label>
          新口令
          <input data-testid="pass-new" type="password" autoComplete="new-password" value={nextPass} onChange={(e) => setNextPass(e.target.value)} />
        </label>
        <button className="tap ghost" type="submit" data-testid="pass-change" disabled={busy}>
          改口令
        </button>
      </form>
      <p className="note">忘记口令后，不能找回，也没有后门。清除网站数据会丢掉这台设备上的学习记录。</p>
      {msg ? <p className="msg" role="status">{msg}</p> : null}
    </Shell>
  );
}

function Stepper({
  label,
  value,
  testId,
  onDec,
  onInc,
}: {
  label: string;
  value: number;
  testId: string;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <div className="stepper">
      <span>{label}</span>
      <button type="button" className="tap ghost" data-testid={`${testId}-dec`} onClick={onDec}>
        减
      </button>
      <strong data-testid={`${testId}-value`}>{value}</strong>
      <button type="button" className="tap ghost" data-testid={`${testId}-inc`} onClick={onInc}>
        加
      </button>
    </div>
  );
}
