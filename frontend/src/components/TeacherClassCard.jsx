// src/components/TeacherClassCard.jsx
import React from "react";

export default function TeacherClassCard({ classInfo, onOpen, onToggleActive }) {
  const hasCustomName =
    classInfo.custom_name && classInfo.custom_name.trim();

  const defaultTitle =
    classInfo.grade != null
      ? `${classInfo.grade}. třída – ${classInfo.subject}`
      : `Třída – ${classInfo.subject}`;

  return (
    <div
      className="class-card"
      role="button"
      onClick={onOpen}
      style={{
        cursor: "pointer",
        opacity: classInfo.active ? 1 : 0.6,
      }}
    >
      {/* HLAVIČKA */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          {/* Hlavní nadpis */}
          {hasCustomName ? (
            <h2 style={{ margin: 0 }}>{classInfo.custom_name}</h2>
          ) : (
            <h2 style={{ margin: 0 }}>{defaultTitle}</h2>
          )}

          {/* VŽDY zobrazit třídu a předmět */}
          <div style={{ fontSize: 14, opacity: 0.7 }}>
            Třída: {classInfo.grade ?? "—"}
          </div>
          <div style={{ fontSize: 14, opacity: 0.7 }}>
            Předmět: {classInfo.subject}
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation(); // zabrání otevření detailu
            onToggleActive?.(classInfo);
          }}
        >
          {classInfo.active ? "Deaktivovat" : "Aktivovat"}
        </button>
      </div>

      {/* OBSAH */}
      <div style={{ marginTop: 10 }}>
        <div>Studentů: {classInfo.num_students ?? 0}</div>

        {classInfo.note && classInfo.note.trim() && (
          <div style={{ marginTop: 6, opacity: 0.85 }}>
            {classInfo.note}
          </div>
        )}
      </div>
    </div>
  );
}
