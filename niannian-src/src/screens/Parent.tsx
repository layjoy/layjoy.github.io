import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { AgeBand, Rules } from "../types";
import { contentPack } from "../content/meta";
import { listSyncAdapters } from "../extensions/sync";
import { modules } from "../extensions/subjects";
import { useApp } from "../state";
import { wipeAll } from "../storage/db";
import { Mascot } from "../ui/Mascot";
import { EnterPin, SetPin } from "../ui/PinPad";
import { Shell, goHome } from "../ui/Shell";

const BANDS: { id: AgeBand; label: string }[] = [
  { id: "5-6", label: "5–6 岁（约 6 岁，默认）" },
  { id: "7-8", label: "7–8 岁" },
  { id: "9-12", label: "9–12 岁" },
];

export function Parent() {
  const { pinSet, encrypted } = useApp();
  const [pin, setPin] = useState<string | null>(null);
  const [wipeAsk, setWipeAsk] = useState(false);

  return (
    <Shell adult>
      <div className="topbar">
        <button type="button" className="btn" data-act="home" onClick={goHome}>
          回乐园
        </button>
        <h2>家长</h2>
      </div>
      <div className="mascot-row">
        <Mascot />
        <p className="sub">规则只留在这台设备里，带出去时是加密包。</p>
      </div>
      {!encrypted ? <p className="hint">这台浏览器没把加密记录存下来。关掉页面后，新的规则会丢掉。</p> : null}
      {!pinSet || !pin ? (
        <div className="card stack">
          {pinSet ? <EnterPin title="请输入家长口令。" onReady={setPin} /> : <SetPin onReady={setPin} />}
          <button type="button" className="quiet" data-act="wipe-ask" onClick={() => setWipeAsk(true)}>
            忘了口令，清除这台设备上的记录
          </button>
        </div>
      ) : (
        <Dashboard pin={pin} />
      )}
      {wipeAsk ? <WipeSheet onClose={() => setWipeAsk(false)} /> : null}
    </Shell>
  );
}

function WipeSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal">
      <div className="sheet">
        <h2>清除这台设备</h2>
        <p>会清掉这台设备上的口令、规则和学习记录。已经导出的加密规则包文件还在。</p>
        <button
          type="button"
          className="btn wide"
          data-act="wipe-yes"
          onClick={() => {
            void wipeAll().then(() => location.reload());
          }}
        >
          清除
        </button>
        <button type="button" className="btn primary wide" data-act="wipe-no" onClick={onClose}>
          留下
        </button>
      </div>
    </div>
  );
}

function Dashboard({ pin }: { pin: string }) {
  const { rules, saveRules, exportPack, importPack } = useApp();
  const [draft, setDraft] = useState<Rules>(rules);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [payload, setPayload] = useState("");
  const [json, setJson] = useState("");
  const [qr, setQr] = useState("");
  const [importText, setImportText] = useState("");
  const [packPin, setPackPin] = useState(pin);
  const sync = listSyncAdapters();

  useEffect(() => {
    setDraft(rules);
  }, [rules]);

  useEffect(() => {
    if (!payload) {
      setQr("");
      return;
    }
    let cancel = false;
    void QRCode.toDataURL(payload, { margin: 1, width: 280, errorCorrectionLevel: "L" })
      .then((url) => {
        if (!cancel) setQr(url);
      })
      .catch(() => {
        if (!cancel) setQr("");
      });
    return () => {
      cancel = true;
    };
  }, [payload]);

  function patch(partial: Partial<Rules>) {
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  async function persist(next: Rules) {
    const slot = next.windows[0];
    if (!slot || slot.start === slot.end) {
      setMessage("开始和结束不要写成同一个时间。");
      return false;
    }
    await saveRules(next);
    setMessage("已经记下。");
    return true;
  }

  async function onExport() {
    if (packPin.trim().length < 4) {
      setMessage("封包口令至少 4 位。");
      return;
    }
    setBusy("正在封好…");
    setMessage("");
    await new Promise((resolve) => window.setTimeout(resolve, 20));
    const saved = await persist(draft);
    if (!saved) {
      setBusy("");
      return;
    }
    const packed = await exportPack(packPin.trim(), draft);
    setJson(packed.json);
    setPayload(packed.payload);
    setBusy("");
    setMessage("规则包已封好。可以保存文件，或让另一台设备扫码、粘贴。");
  }

  async function onImport() {
    if (!importText.trim()) {
      setMessage("先粘贴载荷，或选择文件。");
      return;
    }
    setBusy("正在打开…");
    setMessage("");
    await new Promise((resolve) => window.setTimeout(resolve, 20));
    try {
      await importPack(importText, packPin.trim());
      setMessage("规则已装上。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "这个包打不开。");
    } finally {
      setBusy("");
    }
  }

  const slot = draft.windows[0] ?? { start: "00:00", end: "23:59" };

  return (
    <div className="stack">
      {message ? <p className="hint" data-act="parent-message">{message}</p> : null}
      {busy ? <p className="bubble">{busy}</p> : null}

      <section className="card stack">
        <h2>今天可以玩多久</h2>
        <label className="field">
          每天分钟
          <input
            data-act="daily-minutes"
            inputMode="numeric"
            min={5}
            max={180}
            type="number"
            value={draft.dailyMinutes}
            onChange={(event) => patch({ dailyMinutes: Number(event.target.value) })}
          />
        </label>
        <label className="field">
          开始
          <input
            data-act="window-start"
            type="time"
            value={slot.start}
            onChange={(event) => patch({ windows: [{ ...slot, start: event.target.value }] })}
          />
        </label>
        <label className="field">
          结束
          <input
            data-act="window-end"
            type="time"
            value={slot.end}
            onChange={(event) => patch({ windows: [{ ...slot, end: event.target.value }] })}
          />
        </label>
        <p className="sub">结束早于开始，表示跨过午夜。儿童界面不显示这些数字。</p>
        <button type="button" className="btn primary wide" data-act="save-rules" onClick={() => void persist(draft)}>
          保存规则
        </button>
      </section>

      <section className="card stack">
        <h2>年龄</h2>
        <label className="field">
          按这个年龄出题
          <select
            data-act="age-band"
            value={draft.ageBand}
            onChange={(event) => patch({ ageBand: event.target.value as AgeBand })}
          >
            {BANDS.map((band) => (
              <option key={band.id} value={band.id}>
                {band.label}
              </option>
            ))}
          </select>
        </label>
        <p className="sub">默认是约 6 岁。内容包 {contentPack.title} {contentPack.version}（{contentPack.season}）。</p>
      </section>

      <section className="card stack">
        <h2>打开哪些模块</h2>
        {modules().map((item) => (
          <label key={item.id} className="switch">
            <span>{item.title}</span>
            <input
              type="checkbox"
              data-act={`toggle-${item.id}`}
              checked={draft.modules[item.id] !== false}
              onChange={(event) => patch({ modules: { ...draft.modules, [item.id]: event.target.checked } })}
            />
          </label>
        ))}
      </section>

      <section className="card stack">
        <h2>带出规则</h2>
        <p>用口令封好。另一台设备装入时要输入同一个口令。这里不上传明文。</p>
        <label className="field">
          封包口令
          <input data-act="pack-pin" type="password" value={packPin} autoComplete="off" onChange={(event) => setPackPin(event.target.value)} />
        </label>
        <button type="button" className="btn primary wide" data-act="export" onClick={() => void onExport()}>
          封好并带出
        </button>
        {payload ? (
          <>
            {qr ? <img className="qr" alt="规则包二维码" src={qr} /> : null}
            <textarea data-act="payload" readOnly value={payload} />
            <button type="button" className="btn wide" data-act="download" onClick={() => download(json)}>
              保存文件
            </button>
          </>
        ) : null}
        <p className="sub">端到端同步：{sync.length ? sync.join("、") : "还没连接。现在只用加密规则包。"}</p>
      </section>

      <section className="card stack">
        <h2>装进规则</h2>
        <textarea
          data-act="import-text"
          placeholder="粘贴载荷，或在下面选择文件"
          value={importText}
          onChange={(event) => setImportText(event.target.value)}
        />
        <input
          data-act="import-file"
          type="file"
          accept="application/json,.json,.txt"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void file.text().then(setImportText);
          }}
        />
        <ScanButton onText={setImportText} />
        <button type="button" className="btn primary wide" data-act="import" onClick={() => void onImport()}>
          装进这台设备
        </button>
      </section>

      <section className="card stack">
        <h2>关于情绪</h2>
        <p>情绪部分只帮助孩子给感受起名字，并做一个简单的安抚动作。不是心理诊疗，也不能代替照看。</p>
        <p className="sub">不收集姓名、照片、账号。成长记录只留在本机，没有完整档案页，也没有开放聊天。</p>
      </section>
    </div>
  );
}

function download(json: string) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "年年规则包.json";
  link.click();
  URL.revokeObjectURL(url);
}

function ScanButton({ onText }: { onText: (value: string) => void }) {
  const [on, setOn] = useState(false);
  const [error, setError] = useState("");
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!on || !video) return;
    let stream: MediaStream | null = null;
    let stop = false;
    let timer = 0;
    const Detector = (window as unknown as {
      BarcodeDetector?: new (opts: { formats: string[] }) => { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> };
    }).BarcodeDetector;
    void (async () => {
      try {
        if (!Detector || !navigator.mediaDevices?.getUserMedia) {
          setError("这台浏览器不能扫码，请粘贴载荷或选择文件。");
          setOn(false);
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = stream;
        await video.play();
        const detector = new Detector({ formats: ["qr_code"] });
        const tick = async () => {
          if (stop) return;
          try {
            const codes = await detector.detect(video);
            if (codes[0]?.rawValue) {
              onText(codes[0].rawValue);
              setOn(false);
              return;
            }
          } catch {
            /* 下一帧再看 */
          }
          timer = window.setTimeout(() => void tick(), 500);
        };
        void tick();
      } catch {
        setError("相机没有打开。可以粘贴载荷或选择文件。");
        setOn(false);
      }
    })();
    return () => {
      stop = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [on, onText, video]);

  return (
    <div className="stack">
      <button type="button" className="btn wide" data-act="scan" onClick={() => setOn((value) => !value)}>
        {on ? "关闭相机" : "用相机扫一扫"}
      </button>
      {on ? <video ref={setVideo} className="scan" muted playsInline /> : null}
      {error ? <p className="hint">{error}</p> : null}
    </div>
  );
}
