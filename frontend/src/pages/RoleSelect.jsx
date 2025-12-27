import { useNavigate } from "react-router-dom";

export default function RoleSelect() {
  const nav = useNavigate();

  return (
    <div style={{ padding: 24 }}>
      <h1>Kdo jsi?</h1>

      <button onClick={() => nav("/teacher/login")} style={{ marginRight: 12 }}>
        Učitel
      </button>

      <button disabled title="Zatím není hotové">
        Žák (coming soon)
      </button>
    </div>
  );
}
