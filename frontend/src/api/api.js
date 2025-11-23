// src/api/api.js
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function getTeacherClasses(teacherId = 1) {
  const res = await fetch(`${API_URL}/classes/teacher/${teacherId}`);
  if (!res.ok) throw new Error("Nepodařilo se načíst třídy");
  return await res.json();
}

export async function ping() {
  const r = await fetch(`${API_URL}/health`);
  if (!r.ok) throw new Error("API health failed");
  return r.text();
}
