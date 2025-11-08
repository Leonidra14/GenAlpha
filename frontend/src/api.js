export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function ping() {
  const r = await fetch(`${API_URL}/health`);
  if (!r.ok) throw new Error("API health failed");
  return r.text();
}
