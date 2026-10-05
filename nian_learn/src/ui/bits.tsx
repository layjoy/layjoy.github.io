import type { ReactNode } from "react";

export function Mascot() {
  return (
    <svg className="mascot" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="34" r="20" fill="#3d7a6a" />
      <circle cx="25" cy="30" r="2.6" fill="#fffdf8" />
      <circle cx="39" cy="30" r="2.6" fill="#fffdf8" />
      <path d="M24 40c3.4 4.5 12.6 4.5 16 0" fill="none" stroke="#fffdf8" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Shell({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <main className="shell" data-testid={testId ?? "app-ready"}>
      {children}
    </main>
  );
}

export function StepDots({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="dots" aria-label={`第 ${step} 步，共 3 步`}>
      {[1, 2, 3].map((n) => (
        <span key={n} className={n <= step ? "dot on" : "dot"} />
      ))}
    </div>
  );
}

export function TopBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="topbar">
      <button type="button" className="tap ghost" onClick={onBack} data-testid="back-home">
        返回
      </button>
      <h1>{title}</h1>
    </header>
  );
}

export function DonePanel({ text, onHome }: { text: string; onHome: () => void }) {
  return (
    <section className="done">
      <p className="cheer">{text}</p>
      <button type="button" className="tap" data-testid="activity-done" onClick={onHome}>
        回到首页
      </button>
    </section>
  );
}

export function Pic({ emoji, label }: { emoji: string; label: string }) {
  return (
    <span className="pic" role="img" aria-label={label}>
      {emoji}
    </span>
  );
}
