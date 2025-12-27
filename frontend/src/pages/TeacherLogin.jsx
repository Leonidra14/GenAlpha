import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../api/client";

export default function TeacherLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const nav = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // apiFetch teď vrací rovnou JSON data nebo vyhodí Error
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      // očekáváme { access_token, token_type }
      localStorage.setItem("access_token", data.access_token);
      nav("/teacher");
    } catch (err) {
      console.error(err);
      setError(err?.message || "Přihlášení se nepovedlo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Přihlášení učitele</h1>

      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 12 }}>
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <input
            type="password"
            placeholder="Heslo"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Přihlašuji..." : "Přihlásit"}
        </button>
      </form>

      <p style={{ marginTop: 12 }}>
        Nemáš účet? <Link to="/teacher/register">Zaregistrovat se</Link>
      </p>

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
