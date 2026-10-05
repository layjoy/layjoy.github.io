export const WELCOME = "你好！我是小星。点大按钮就行。";

type Listener = (text: string) => void;

let caption = "";
const listeners = new Set<Listener>();
let audio: HTMLAudioElement | null = null;
let clips: Record<string, string> | null = null;
let clipsTask: Promise<Record<string, string>> | null = null;

export function currentCaption(): string {
  return caption;
}

export function subscribeCaption(listener: Listener): () => void {
  listeners.add(listener);
  listener(caption);
  return () => listeners.delete(listener);
}

function notify(text: string): void {
  caption = text;
  listeners.forEach((listener) => listener(text));
}

function loadClips(): Promise<Record<string, string>> {
  if (clips) return Promise.resolve(clips);
  if (!clipsTask) {
    const url = new URL("./tts/manifest.json", document.baseURI).href;
    clipsTask = fetch(url)
      .then((response) => (response.ok ? response.json() : { files: {} }))
      .then((data: { files?: Record<string, string> }) => {
        clips = data.files ?? {};
        return clips;
      })
      .catch(() => {
        clips = {};
        return clips;
      });
  }
  return clipsTask;
}

async function playLine(text: string, lang: string): Promise<void> {
  try {
    const map = await loadClips();
    const key = `${lang.startsWith("en") ? "en" : "zh"}:${text}`;
    const file = map[key];
    if (file) {
      if (!audio) audio = new Audio();
      window.speechSynthesis?.cancel();
      audio.pause();
      audio.src = new URL(`./tts/${file}`, document.baseURI).href;
      await audio.play();
      return;
    }
  } catch {
    /* 没有离线录音就改用语音引擎，文字已经在屏幕上。 */
  }
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = 0.92;
    window.speechSynthesis.speak(utter);
  } catch {
    /* 读不出来也不卡住，短句已经显示。 */
  }
}

export function speak(text: string, lang: "zh-CN" | "en-US" = "zh-CN"): void {
  const line = text.trim();
  if (!line) return;
  notify(line);
  void playLine(line, lang);
}
