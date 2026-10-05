import { useEffect, useState } from "react";
import { AppStateProvider, useApp } from "./state/AppState";
import type { ModuleId, Screen } from "./types";
import { Chinese } from "./views/Chinese";
import { Emotion } from "./views/Emotion";
import { English } from "./views/English";
import { Habits } from "./views/Habits";
import { Home } from "./views/Home";
import { Lock } from "./views/Lock";
import { MathActivity } from "./views/MathActivity";
import { Parent } from "./views/Parent";
import { Setup, Unlock } from "./views/Setup";
import { Together } from "./views/Together";

const SCREENS: Screen[] = ["home", "english", "math", "chinese", "emotion", "habits", "together", "parent", "lock"];

function go(screen: Screen, replace = false) {
  const next = `#/${screen}`;
  if (location.hash === next) return;
  if (replace) location.replace(next);
  else location.hash = next;
}

function readScreen(): Screen {
  const name = location.hash.replace(/^#\//, "") as Screen;
  return SCREENS.includes(name) ? name : "home";
}

export function App() {
  return (
    <AppStateProvider>
      <Frame />
    </AppStateProvider>
  );
}

function Frame() {
  const api = useApp();
  const [screen, setScreen] = useState<Screen>("home");
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const onHash = () => setScreen(readScreen());
    window.addEventListener("hashchange", onHash);
    if (!location.hash) location.replace("#/home");
    else onHash();
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (screen !== "parent") api.leaveParent();
  }, [screen, api.leaveParent]);

  useEffect(() => {
    const learning = screen === "home" || screen === "english" || screen === "math" || screen === "chinese" || screen === "emotion" || screen === "habits" || screen === "together";
    api.setCounting(learning && !api.lock);
  }, [screen, api.lock, api.setCounting]);

  useEffect(() => {
    if (!api.data) return;
    const map: Partial<Record<Screen, ModuleId>> = {
      english: "english",
      math: "math",
      chinese: "chinese",
      emotion: "emotion",
      habits: "habits",
      together: "together",
    };
    const id = map[screen];
    if (id && api.data.rules.modulesEnabled[id] === false) go("home", true);
  }, [screen, api.data]);

  useEffect(() => {
    if (!api.data || api.needsSetup || api.needsUnlock) return;
    if (api.lock && screen !== "parent" && screen !== "lock") go("lock", true);
  }, [api.lock, screen, api.data, api.needsSetup, api.needsUnlock]);

  if (!api.ready) return <p className="loading">正在准备…</p>;
  if (api.needsSetup) return <Setup />;
  if (api.needsUnlock) return <Unlock />;
  if (!api.pack || !api.data) return <p className="loading">{api.packError ?? "正在准备内容…"}</p>;

  let body = <Home onOpen={(next) => go(next)} />;
  if ((api.lock && screen !== "parent") || screen === "lock") {
    body = <Lock onHome={() => go("home")} onParent={() => go("parent")} />;
  } else if (screen === "english") body = <English onHome={() => go("home")} />;
  else if (screen === "math") body = <MathActivity onHome={() => go("home")} />;
  else if (screen === "chinese") body = <Chinese onHome={() => go("home")} />;
  else if (screen === "emotion") body = <Emotion onHome={() => go("home")} />;
  else if (screen === "habits") body = <Habits onHome={() => go("home")} />;
  else if (screen === "together") body = <Together onHome={() => go("home")} />;
  else if (screen === "parent") body = <Parent onHome={() => go("home")} />;

  return (
    <>
      {!online ? <p className="offline">现在没有网络，学习还可以继续</p> : null}
      {api.banner ? <p className="offline">{api.banner}</p> : null}
      {body}
    </>
  );
}
