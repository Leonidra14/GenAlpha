/** Low-level fetch to VITE_API_URL: Bearer token, JSON body, 401 refresh + retry once. */
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

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch (error) {
    throw new Error(mapNetworkErrorMessage(error));
  }

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
        try {
          res = await fetch(`${API_URL}${path}`, {
            ...options,
            headers,
            credentials: "include",
          });
        } catch (error) {
          throw new Error(mapNetworkErrorMessage(error));
        }
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
    detail = normalizeApiErrorDetail(detail, res.status);
    detail = mapApiErrorMessage(detail, res.status);

    if (typeof detail === "object" && detail?.message) {
      const err = new Error(detail.message);
      err.code = detail.code;
      throw err;
    }

    throw new Error(detail);
  }

  return data;
}

/**
 * FastAPI 422 returns detail as an array of { loc, msg, type, ... } — must not pass that to new Error().
 */
function normalizeApiErrorDetail(detail, status) {
  if (detail == null || typeof detail === "string") return detail ?? `HTTP ${status}`;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => formatValidationErrorItem(item))
      .filter((s) => typeof s === "string" && s.trim().length > 0);
    if (parts.length > 0) return parts.join(" ");
    if (status === 422) {
      return "Zkontroluj vyplněné údaje. E-mail a heslo musí být ve správném tvaru.";
    }
    return "Požadavek se nepovedlo zpracovat.";
  }
  if (typeof detail === "object") {
    if (typeof detail.msg === "string") return stripValueErrorPrefix(detail.msg);
    if (typeof detail.message === "string") return detail.message;
  }
  return String(detail);
}

function stripValueErrorPrefix(msg) {
  const prefix = "Value error, ";
  if (typeof msg !== "string") return "";
  return msg.startsWith(prefix) ? msg.slice(prefix.length).trim() : msg;
}

function formatValidationErrorItem(item) {
  if (item == null) return "";
  if (typeof item === "string") return item;
  if (typeof item !== "object") return "";
  const raw = typeof item.msg === "string" ? item.msg : "";
  const msg = stripValueErrorPrefix(raw);
  const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : "";

  const lower = msg.toLowerCase();
  if (
    lower.includes("not a valid email") ||
    lower.includes("value is not a valid email") ||
    lower.includes("email address")
  ) {
    return "Zadej platný e-mail.";
  }
  if (
    (field === "password" || lower.includes("password")) &&
    (lower.includes("at least 1 character") || lower.includes("too short"))
  ) {
    return "Zadej heslo.";
  }
  if (
    lower.includes("string too long") ||
    lower.includes("ensure this value has at most") ||
    lower.includes("at most 72")
  ) {
    return "Heslo je příliš dlouhé.";
  }

  if (msg && /[áčďéěíňóřšťúůýž]/i.test(msg)) return msg;
  if (msg && msg.length > 0) return msg;
  return "";
}

function mapApiErrorMessage(detail, status) {
  if (typeof detail !== "string") {
    if (status === 422) return "Zkontroluj vyplněné údaje. E-mail a heslo musí být ve správném tvaru.";
    return "Došlo k chybě. Zkus to prosím znovu.";
  }

  const normalized = detail.trim();

  const exactMap = {
    "Method Not Allowed": "Akce není na serveru povolená. Obnov stránku a zkus to znovu.",
    "Class not found": "Třída nebyla nalezena nebo k ní nemáš přístup.",
    "Teacher not found": "Učitel nebyl nalezen.",
    "Student not found": "Student nebyl nalezen.",
    "Enrollment not found": "Zápis studenta do třídy nebyl nalezen.",
    "First name and last name are required": "Jméno i příjmení jsou povinné.",
    "Password must be 8–72 characters": "Heslo musí mít 8–72 znaků.",
    "Subject cannot be empty": "Předmět nesmí být prázdný.",
    "Neplatné údaje": "Chybně zadaný e-mail nebo heslo.",
  };

  if (exactMap[normalized]) return exactMap[normalized];

  if (status === 401) return "Přihlášení vypršelo. Přihlas se prosím znovu.";
  if (status === 403) return "Na tuto akci nemáš oprávnění.";
  if (status === 404) return "Požadovaný záznam nebyl nalezen.";
  if (status >= 500) return "Server je dočasně nedostupný. Zkus to prosím za chvíli.";

  return normalized;
}

function mapNetworkErrorMessage(error) {
  const msg = error?.message || "";
  if (msg.toLowerCase().includes("failed to fetch")) {
    return "Server je nedostupný.";
  }
  return "Nepodařilo se spojit se serverem. Zkus to prosím za chvíli.";
}

function handleLogout() {
  localStorage.removeItem("access_token");
  if (!window.location.pathname.includes("/login")) {
    window.location.href = "/";
  }
}