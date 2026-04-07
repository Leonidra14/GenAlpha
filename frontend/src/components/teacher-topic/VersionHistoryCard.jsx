import React from "react";

export default function VersionHistoryCard({ history, formatTime, onDelete, onClear }) {
  if (!history.length) return null;

  return (
    <div className="tcdCard">
      <div className="tcdCardHeader" style={{ alignItems: "center" }}>
        <div className="tcdCardTitle">Historie verzí</div>
        <button className="tcdBtn pillDanger" type="button" onClick={onClear}>
          Smazat historii
        </button>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {history.map((h, idx) => (
          <div key={h.id} className="tcdTopic" style={{ cursor: "default" }} onClick={(e) => e.preventDefault()}>
            <div className="tcdTopicLeft" style={{ alignItems: "flex-start" }}>
              <div className="tcdBulb" aria-hidden="true">
                🧾
              </div>
              <div>
                <div className="tcdTopicTitle">
                  Verze {history.length - idx} — {h.label}
                </div>
                <div style={{ opacity: 0.7, fontSize: 13 }}>{formatTime(h.createdAt)}</div>
              </div>
            </div>

            <div className="tcdTopicActions" onClick={(e) => e.stopPropagation()}>
              <button className="tcdBtn pillDanger" type="button" onClick={() => onDelete(h.id)}>
                Smazat
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ opacity: 0.65, fontSize: 13, marginTop: 10 }}>
        Pozn.: historie je jen v paměti stránky. Po obnovení stránky se smaže!
      </div>
    </div>
  );
}
