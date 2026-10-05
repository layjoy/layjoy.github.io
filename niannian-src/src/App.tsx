import { useEffect, useState } from "react";
import "./content/pack";
import { useApp } from "./state";
import { blockReason } from "./rules/time";
import { Home } from "./screens/Home";
import { Parent } from "./screens/Parent";
import { Play } from "./screens/Play";
import { Rest } from "./screens/Rest";
import { Mascot } from "./ui/Mascot";
import { Shell } from "./ui/Shell";

function routeOf(hash: string): string {
  const route = (hash || "#/").replace(/^#/, "");
  return route.startsWith("/") ? route : `/${route}`;
}

export function App() {
  const { ready, rules, usageMs, addUsage } = useApp();
  const [hash, setHash] = useState(() => location.hash || "#/");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const onHash = () => setHash(location.hash || "#/");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 5000);
    return () => window.clearInterval(id);
  }, []);

  const route = routeOf(hash);
  const reason = blockReason(now, rules, usageMs);
  const playing = ready && route.startsWith("/play/") && !reason;

  useEffect(() => {
    if (!playing) return;
    let last = Date.now();
    const id = window.setInterval(() => {
      const tick = Date.now();
      addUsage(tick - last);
      last = tick;
    }, 4000);
    return () => {
      addUsage(Date.now() - last);
      window.clearInterval(id);
    };
  }, [playing, addUsage]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route, reason]);

  if (!ready) {
    return (
      <Shell>
        <div className="mascot-row">
          <Mascot />
          <h1>年年学习乐园</h1>
        </div>
        <p className="bubble">小星在准备。</p>
      </Shell>
    );
  }

  if (route === "/parent") return <Parent />;
  if (reason) return <Rest reason={reason} />;
  if (route.startsWith("/play/")) return <Play moduleId={decodeURIComponent(route.slice("/play/".length))} />;
  return <Home />;
}
