import { useEffect, useState } from "react";
import { ping } from "./api";

export default function App() {
  const [status, setStatus] = useState("Kontroluju API...");

  useEffect(() => {
    ping().then(
      () => setStatus("API OK ✅"),
      (e) => setStatus("API FAIL sad ❌ " + e.message)
    );
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Diplomka – frontend</h1>
      <p>{status}</p>
    </div>
  );
}
