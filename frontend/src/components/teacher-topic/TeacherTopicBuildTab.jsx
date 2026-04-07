import React from "react";
import "./TeacherTopicBuildTab.css";

export default function TeacherTopicBuildTab({ duration, setDuration, rawText, setRawText }) {
  return (
    <div className="tcdCard">
      <div className="tcdCardTitle ttBuildTitle">
        Tvorba
      </div>
      <div className="tcdSubtitle ttBuildSubtitle">
      </div>

      <div className="ttBuildLabel">Délka hodiny (min):</div>
      <div className="tcdField ttBuildDurationField">
        <input
          className="tcdInput ttBuildDurationInput"
          type="number"
          min={5}
          max={240}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value || 45))}
        />
      </div>

      <div className="ttBuildLabel">Text od učitele:</div>
      <div className="tcdField">
        <textarea
          className="tcdInput ttBuildTextarea"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Vlož zde text (poznámky, osnovu, výtah z učebnice...)"
        />
      </div>
    </div>
  );
}
