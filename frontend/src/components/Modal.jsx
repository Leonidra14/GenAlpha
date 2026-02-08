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
        background: "rgba(20, 24, 60, 0.35)", // jemnější overlay
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
  className="gaModal"
  onClick={(e) => e.stopPropagation()}
  style={{
    width: "min(640px, 92vw)",
    maxHeight: "80vh",
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(90,120,255,0.18)",
    borderRadius: 22,
    padding: 18,
    color: "rgba(35,36,58,0.92)",
    boxShadow:
      "0 18px 40px rgba(26,52,160,0.14), inset 0 1px 0 rgba(255,255,255,0.65)",
    backdropFilter: "blur(10px)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
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
          <h2
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </h2>

          <button
            onClick={onClose}
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              border: "1px solid rgba(130,140,190,0.30)",
              background: "rgba(255,255,255,0.65)",
              cursor: "pointer",
              color: "rgba(35,36,58,0.8)",
              boxShadow: "0 10px 18px rgba(60,80,190,0.10)",

              display: "flex",          // ✅
              alignItems: "center",     // ✅
              justifyContent: "center", // ✅
              padding: 0,               // ✅
              lineHeight: 1,            // ✅
            }}
            aria-label="Zavřít"
            title="Zavřít"
          >
            <span style={{ fontSize: 18, fontWeight: 900, transform: "translateY(-0.5px)" }}>
              ✕
            </span>
          </button>
        </div>

        {/* CONTENT */}
        <div
          className="gaScroll"
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
