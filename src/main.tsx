import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthGate } from "@/components/auth-gate";
import { WorkspaceGate } from "@/components/workspace-gate";
import "@/app/globals.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => undefined));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthGate>{(user) => <WorkspaceGate user={user} />}</AuthGate>
  </StrictMode>,
);
