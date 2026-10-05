let enabled = true;

export function setVoiceEnabled(on: boolean): void {
  enabled = on;
  if (!on) silence();
}

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function silence(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}

export function speak(text: string, lang: "zh-CN" | "en-US" = "zh-CN"): void {
  if (!enabled || !text || !speechSupported()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = lang === "en-US" ? 0.84 : 0.92;
  synth.speak(utter);
}
