import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { signOut } from "firebase/auth";
import { ChartNoAxesCombined, TriangleAlert } from "lucide-react";
import Page from "@/app/page";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";
import { ensureWorkspaceAccess, type WorkspaceAccess } from "@/lib/firestore";

export function WorkspaceGate({ user }: { user: User }) {
  const [access, setAccess] = useState<WorkspaceAccess | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setAccess(await ensureWorkspaceAccess(user));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "No fue posible abrir el espacio de trabajo.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (access) return <Page user={user} access={access} />;
  if (loading) return <div className="auth-loading">Preparando tu espacio de trabajo…</div>;

  return (
    <main className="auth-page">
      <section className="auth-card config-card">
        <span className="auth-logo"><ChartNoAxesCombined /></span>
        <h1>No se pudo abrir Tesorería</h1>
        <div className="auth-error"><TriangleAlert size={18}/><span>{error}</span></div>
        <Button onClick={load}>Reintentar</Button>
        <Button variant="outline" onClick={() => auth && signOut(auth)}>Cerrar sesión</Button>
      </section>
    </main>
  );
}
