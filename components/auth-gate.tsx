import { useEffect, useState, type ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  type User,
} from "firebase/auth";
import { ChartNoAxesCombined, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { auth, firebaseReady, googleProvider } from "@/lib/firebase";
import { Button } from "@/components/ui/button";

function message(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code.includes("invalid-credential")) return "Correo o contraseña incorrectos.";
  if (code.includes("email-already-in-use")) return "Ese correo ya tiene una cuenta.";
  if (code.includes("weak-password")) return "La contraseña debe tener al menos 6 caracteres.";
  if (code.includes("popup-closed")) return "La ventana de acceso se cerró antes de completar el ingreso.";
  return error instanceof Error ? error.message : "No fue posible iniciar sesión.";
}

export function AuthGate({ children }: { children: (user: User) => ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [create, setCreate] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!auth) {
      setChecking(false);
      return;
    }
    return onAuthStateChanged(auth, (current) => {
      setUser(current);
      setChecking(false);
    });
  }, []);

  if (checking) return <div className="auth-loading">Abriendo Tesorería…</div>;
  if (user) return <>{children(user)}</>;

  if (!firebaseReady || !auth) {
    return (
      <main className="auth-page">
        <section className="auth-card config-card">
          <span className="auth-logo"><ChartNoAxesCombined /></span>
          <h1>Falta configurar Firebase</h1>
          <p>Copia <strong>.env.example</strong> como <strong>.env.local</strong> y completa los seis datos de tu aplicación web Firebase.</p>
          <p>En GitHub Pages, agrega esos mismos valores en <strong>Settings → Secrets and variables → Actions → Variables</strong>.</p>
        </section>
      </main>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (create) await createUserWithEmailAndPassword(auth!, email.trim(), password);
      else await signInWithEmailAndPassword(auth!, email.trim(), password);
    } catch (problem) {
      setError(message(problem));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand"><span className="auth-logo"><ChartNoAxesCombined /></span><div><strong>Tesorería</strong><small>CONTROL FINANCIERO</small></div></div>
        <div className="auth-copy"><h1>{create ? "Crear acceso" : "Ingresar"}</h1><p>Usa la misma cuenta en el computador y el teléfono para ver los mismos datos.</p></div>
        <form onSubmit={submit} className="auth-form">
          <label><span><Mail size={16}/>Correo electrónico</span><input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label><span><KeyRound size={16}/>Contraseña</span><input type="password" minLength={6} required autoComplete={create ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {error && <div className="auth-error">{error}</div>}
          {notice && <div className="auth-notice">{notice}</div>}
          <Button disabled={busy} type="submit">{busy ? "Procesando…" : create ? "Crear cuenta" : "Ingresar"}</Button>
        </form>
        <div className="auth-separator"><span>o</span></div>
        <Button variant="outline" disabled={busy} onClick={() => signInWithPopup(auth!, googleProvider).catch((problem) => setError(message(problem)))}>Continuar con Google</Button>
        <div className="auth-links">
          <button onClick={() => { setCreate(!create); setError(""); }}>{create ? "Ya tengo una cuenta" : "Crear una cuenta"}</button>
          {!create && <button onClick={async () => { try { if (!email.trim()) throw new Error("Escribe primero tu correo."); await sendPasswordResetEmail(auth!, email.trim()); setNotice("Te enviamos un enlace para cambiar la contraseña."); } catch (problem) { setError(message(problem)); } }}>Olvidé mi contraseña</button>}
        </div>
        <div className="auth-security"><ShieldCheck size={18}/><span>Los registros quedan asociados a tu usuario y protegidos por las reglas de Firestore.</span></div>
      </section>
    </main>
  );
}
