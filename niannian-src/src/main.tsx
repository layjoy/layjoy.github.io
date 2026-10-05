import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AppState } from "./state";
import "./styles.css";

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <AppState>
      <App />
    </AppState>
  </StrictMode>,
);
