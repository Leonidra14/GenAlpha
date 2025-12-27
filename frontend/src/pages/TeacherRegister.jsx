import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../api/client";

export default function TeacherRegister() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
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
      // apiFetch vrací rovnou JSON data nebo hodí Error
      const data = await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          password,
        }),
      });

      // úspěch → uložíme token a jdeme na dashboard
      localStorage.setItem("access_token", data.access_token);
      nav("/teacher");
    } catch (err) {
      console.error(err);

      // apiFetch už error zprávu obsahuje (detail z FastAPI)
      setError(err?.message || "Registrace se nepovedla.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Registrace učitele</h1>

      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 12 }}>
          <input
            placeholder="Jméno"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            disabled={loading}
          />
          <input
            placeholder="Příjmení"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={loading}
          />
        </div>

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
            placeholder="Heslo (8–72 znaků)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Registruji..." : "Registrovat"}
        </button>
      </form>

      <p style={{ marginTop: 12 }}>
        Už máš účet? <Link to="/teacher/login">Přihlásit se</Link>
      </p>

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
