import React, { useEffect, useId, useRef } from "react";

export default function Modal({ open, onClose, children, title, panelClassName }) {
  const panelRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="gaModalOverlay" onClick={onClose}>
      <div
        ref={panelRef}
        className={panelClassName ? `gaModal ${panelClassName}` : "gaModal"}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? `${titleId}-title` : undefined}
        tabIndex={-1}
      >
        <div className="gaModalHeader">
          <h2 id={title ? `${titleId}-title` : undefined} className="gaModalTitle">
            {title}
          </h2>

          <button
            type="button"
            className="tcdBtn gaModalCloseBtn"
            onClick={onClose}
            aria-label="Zavřít"
            title="Zavřít"
          >
            <span className="gaModalCloseIcon">✕</span>
          </button>
        </div>

        <div className="gaScroll">{children}</div>
      </div>
    </div>
  );
}
