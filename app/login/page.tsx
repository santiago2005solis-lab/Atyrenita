"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("desarrollosistema@aty.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        body: JSON.stringify({ email, password }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo iniciar sesion.");
      }

      window.location.href = getNextPath();
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "No se pudo iniciar sesion.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel" aria-label="Inicio de sesion">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            SG
          </div>
          <div>
            <p className="eyebrow">Sistema empresarial</p>
            <h1>Atyrenita SG</h1>
          </div>
        </div>

        <div className="login-heading">
          <p className="eyebrow">Acceso privado</p>
          <h2>Inicio de sesion</h2>
          <span>Ingrese con su usuario autorizado para acceder a los modulos.</span>
        </div>

        {error && <div className="status-banner danger">{error}</div>}

        <form className="movement-form" onSubmit={submitLogin}>
          <label>
            Correo
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="usuario@empresa.com"
              type="email"
              value={email}
            />
          </label>
          <label>
            Contrasena
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Ingrese su contrasena"
              type="password"
              value={password}
            />
          </label>
          <button className="submit-button" disabled={loading} type="submit">
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </section>
    </main>
  );
}

function getNextPath() {
  const nextPath = new URLSearchParams(window.location.search).get("next") ?? "/";
  return nextPath.startsWith("/") ? nextPath : "/";
}
