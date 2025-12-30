// src/api/client.js
const API_URL = import.meta.env.VITE_API_URL;

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("access_token");

  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const isFormData = options.body instanceof FormData;

  // Content-Type nastavuj jen pro JSON (u FormData to musí nechat prohlížeč!)
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    // backend může vrátit detail jako string, nebo jako objekt { code, message }
    let detail = data?.detail ?? data?.message ?? `HTTP ${res.status}`;

    if (typeof detail === "object" && detail?.message) {
      const err = new Error(detail.message);
      err.code = detail.code; // aby UI mohlo poznat file_error
      throw err;
    }

    throw new Error(detail);
  }

  return data;
}
