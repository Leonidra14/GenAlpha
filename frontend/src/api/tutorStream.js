const API_URL = import.meta.env.VITE_API_URL;

function handleLogout() {
  localStorage.removeItem("access_token");
  if (!window.location.pathname.includes("/login")) {
    window.location.href = "/";
  }
}

function buildHeaders(extra) {
  const headers = new Headers(extra || {});
  const token = localStorage.getItem("access_token");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

/**
 * POST tutor SSE; parses `data: {json}` lines and calls onEvent for each payload.
 * Mirrors apiFetch 401 refresh once, then retries the request.
 */
export async function postTutorMessageStream({
  classId,
  topicId,
  attemptId,
  questionId,
  message,
  signal,
  onEvent,
}) {
  const path = `/quiz/${classId}/${topicId}/attempts/${encodeURIComponent(attemptId)}/tutor`;
  const body = JSON.stringify({ question_id: questionId, message });

  async function doFetch(headers) {
    return fetch(`${API_URL}${path}`, {
      method: "POST",
      headers,
      body,
      credentials: "include",
      signal,
    });
  }

  let headers = buildHeaders();
  let res = await doFetch(headers);

  if (
    res.status === 401 &&
    !path.includes("/auth/refresh") &&
    !path.includes("/auth/login")
  ) {
    try {
      const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        const newToken = refreshData.access_token;
        localStorage.setItem("access_token", newToken);
        headers = buildHeaders();
        res = await doFetch(headers);
      } else {
        handleLogout();
        throw new Error("Přihlášení vypršelo. Přihlas se prosím znovu.");
      }
    } catch (e) {
      if (e?.message?.includes("Přihlášení")) throw e;
      handleLogout();
      throw new Error("Přihlášení vypršelo. Přihlas se prosím znovu.");
    }
  }

  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const j = text ? JSON.parse(text) : null;
      detail = j?.detail ?? j?.message ?? text;
    } catch {
      /* keep text */
    }
    if (typeof detail === "object" && detail != null) {
      detail = detail.msg || detail.message || JSON.stringify(detail);
    }
    throw new Error(
      typeof detail === "string" && detail.trim()
        ? detail.trim()
        : `HTTP ${res.status}`
    );
  }

  if (!res.body?.getReader) {
    throw new Error("Prohlížeč nepodporuje streamování odpovědi.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (let raw of parts) {
        const line = raw.replace(/\r$/, "");
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (!json) continue;
        try {
          const evt = JSON.parse(json);
          if (typeof onEvent === "function") onEvent(evt);
        } catch {
          /* ignore malformed sse json */
        }
      }
    }
    if (buffer.trim()) {
      const line = buffer.replace(/\r$/, "");
      if (line.startsWith("data: ")) {
        const json = line.slice(6).trim();
        if (json) {
          try {
            const evt = JSON.parse(json);
            if (typeof onEvent === "function") onEvent(evt);
          } catch {
            /* ignore */
          }
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* already released */
    }
  }
}
