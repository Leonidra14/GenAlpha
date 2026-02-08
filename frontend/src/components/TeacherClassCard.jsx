import React from "react";

export default function TeacherClassCard({ classInfo, onOpen, onToggleActive }) {
  const hasCustomName = classInfo.custom_name && classInfo.custom_name.trim();

  const defaultTitle =
    classInfo.grade != null
      ? `${classInfo.grade}. třída – ${classInfo.subject}`
      : `Třída – ${classInfo.subject}`;

  const title = hasCustomName ? classInfo.custom_name : defaultTitle;

  return (
    <div
      className={`ccard ${classInfo.active ? "" : "ccardInactive"}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen?.();
      }}
    >
      <div className="ccardIcon" aria-hidden="true">
        📚
      </div>

      <div className="ccardBody">
        <div className="ccardTop">
          <div className="ccardText">
            <div className="ccardTitle">{title}</div>
            <div className="ccardMeta">
              <div>Předmět: {classInfo.subject}</div>
              <div>Třída: {classInfo.grade ?? "—"}</div>
            </div>
          </div>

          <button
            className="ccardToggle"
            onClick={(e) => {
              e.stopPropagation();
              onToggleActive?.(classInfo);
            }}
          >
            {classInfo.active ? "Deaktivovat" : "Aktivovat"}
          </button>
        </div>

        <div className="ccardBottom">
          <div className="ccardSmall">Studentů: {classInfo.num_students ?? 0}</div>
          {classInfo.note && classInfo.note.trim() && (
            <div className="ccardNote">{classInfo.note}</div>
          )}
        </div>
      </div>
    </div>
  );
}
