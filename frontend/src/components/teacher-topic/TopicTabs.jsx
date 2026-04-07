import React from "react";
import "./TopicTabs.css";

export default function TopicTabs({
  tab,
  setTab,
  hasAnyOutput,
  hasDbTeacher,
  hasDbStudent,
  onBack,
}) {
  return (
    <div className="ttTabsRow">
      <div className="ttTabsLeft">
        <button className={tab === "build" ? "tcdBtn primarySoft" : "tcdBtn ghost"} type="button" onClick={() => setTab("build")}>
          ● Tvorba
        </button>

        <button
          className={tab === "student" ? "tcdBtn primarySoft" : "tcdBtn ghost"}
          type="button"
          onClick={() => setTab("student")}
          disabled={!hasAnyOutput && !hasDbStudent}
          title={!hasAnyOutput && !hasDbStudent ? "Nejdřív vygeneruj výstup." : ""}
        >
          👤 Studentské poznámky
        </button>

        <button
          className={tab === "teacher" ? "tcdBtn primarySoft" : "tcdBtn ghost"}
          type="button"
          onClick={() => setTab("teacher")}
          disabled={!hasAnyOutput && !hasDbTeacher}
          title={!hasAnyOutput && !hasDbTeacher ? "Nejdřív vygeneruj výstup." : ""}
        >
          👨‍🏫 Osnova pro učitele
        </button>

        <button
          className={tab === "quiz" ? "tcdBtn primarySoft" : "tcdBtn ghost"}
          type="button"
          onClick={() => setTab("quiz")}
          disabled={!hasAnyOutput && !hasDbTeacher && !hasDbStudent}
          title={!hasAnyOutput && !hasDbTeacher && !hasDbStudent ? "Nejdřív vygeneruj výstup." : ""}
        >
          ❓ Kvíz
        </button>
      </div>

      <button className="tcdBtn ghost" onClick={onBack}>
        ← Zpět
      </button>
    </div>
  );
}
