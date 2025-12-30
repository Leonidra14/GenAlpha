import React, { useEffect } from "react";

export default function Modal({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 100%)",
          maxHeight: "90vh",              // ⬅️ modal se nevejde přes obrazovku
          background: "#1f1f1f",
          border: "1px solid #333",
          borderRadius: 16,
          padding: 16,
          color: "white",
          display: "flex",
          flexDirection: "column",        // ⬅️ důležité pro scroll
        }}
      >
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ padding: "6px 10px" }}>
            ✕
          </button>
        </div>

        {/* CONTENT (SCROLLABLE) */}
        <div
          style={{
            overflowY: "auto",             
            paddingRight: 6,               
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
