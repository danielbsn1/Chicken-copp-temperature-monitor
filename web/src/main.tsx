import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { ConfigErrorPage } from "./app/pages/ConfigErrorPage";
import { checkEnv } from "./config/env";
import { initTheme } from "./shared/theme";
import "./shared/ui/tokens.css";

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root não encontrado");

initTheme();
const issues = checkEnv();

createRoot(root).render(
  <StrictMode>{issues ? <ConfigErrorPage issues={issues} /> : <App />}</StrictMode>,
);
