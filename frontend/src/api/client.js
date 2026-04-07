const API_URL = import.meta.env.VITE_API_URL;

export async function apiFetch(path, options = {}) {
  let token = localStorage.getItem("access_token");

  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const isFormData = options.body instanceof FormData;

  if (isFormData) {
    headers.delete("Content-Type");
  } else if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

if (res.status === 401 && !path.includes("/auth/refresh") && !path.includes("/auth/login")) {
      console.warn("Access Token vypršel, zkouším Silent Refresh...");
    
    try {
      const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        const newToken = refreshData.access_token;

        localStorage.setItem("access_token", newToken);
        console.log("Token byl úspěšně obnoven.");

        headers.set("Authorization", `Bearer ${newToken}`);
        res = await fetch(`${API_URL}${path}`, {
          ...options,
          headers,
          credentials: "include",
        });
      } else {
        handleLogout();
        return null;
      }
    } catch (error) {
      console.error("Silent Refresh selhal:", error);
      handleLogout();
      return null;
    }
  }

  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    console.error("API ERROR", res.status, path, data);

    let detail = data?.detail ?? data?.message ?? `HTTP ${res.status}`;

    if (typeof detail === "object" && detail?.message) {
      const err = new Error(detail.message);
      err.code = detail.code;
      throw err;
    }

    throw new Error(detail);
  }

  return data;
}

function handleLogout() {
  localStorage.removeItem("access_token");
  if (!window.location.pathname.includes("/login")) {
    window.location.href = "/";
  }
}