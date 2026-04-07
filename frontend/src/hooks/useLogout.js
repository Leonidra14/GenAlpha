import { useCallback } from "react";
import { apiFetch } from "../api/client";

export function useLogout() {
  return useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch (err) {
      console.warn("Serverové odhlášení selhalo, pokračuji lokálně.", err);
    } finally {
      localStorage.removeItem("access_token");
      window.location.href = "/";
    }
  }, []);
}
