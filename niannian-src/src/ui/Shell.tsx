import { useEffect, useState, type ReactNode } from "react";
import { currentCaption, subscribeCaption } from "../voice/speak";

export function Shell({ children, adult = false }: { children: ReactNode; adult?: boolean }) {
  const [line, setLine] = useState(currentCaption);
  useEffect(() => subscribeCaption(setLine), []);
  return (
    <div className={adult ? "sky adult" : "sky"}>
      <div className="shell">
        {children}
        <p className="sr-only" role="status">
          {line}
        </p>
      </div>
    </div>
  );
}

export function goHome(): void {
  location.hash = "#/";
}

export function goParent(): void {
  location.hash = "#/parent";
}
