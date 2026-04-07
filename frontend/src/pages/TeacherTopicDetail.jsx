import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import "./TeacherClassDetail.css";

import clouds from "../assets/clouds.png";
import labs from "../assets/lab_books.png";
import star from "../assets/star.png";
import flight from "../assets/flight.png";
import { normalizeMd } from "../utils/markdown";
import { safeJsonStringify, safeParseJson } from "../utils/json";
import { formatTime } from "../utils/versioning";
import { isImageFile, isPdfFile } from "../utils/fileValidation";
import { useTopicHeaderData } from "../hooks/teacher-topic/useTopicHeaderData";
import { useFileAttachments } from "../hooks/teacher-topic/useFileAttachments";
import { useTopicNotesWorkflow } from "../hooks/teacher-topic/useTopicNotesWorkflow";
import { useTopicQuizWorkflow } from "../hooks/teacher-topic/useTopicQuizWorkflow";
import { useRandomDecorations } from "../hooks/useRandomDecorations";
import { useLogout } from "../hooks/useLogout";
import AppTopbar from "../components/layout/AppTopbar";
import AppBackgroundDecor from "../components/layout/AppBackgroundDecor";
import TopicTabs from "../components/teacher-topic/TopicTabs";
import VersionHistoryCard from "../components/teacher-topic/VersionHistoryCard";
import TeacherTopicBuildTab from "../components/teacher-topic/TeacherTopicBuildTab";
import TeacherTopicRightPanel from "../components/teacher-topic/TeacherTopicRightPanel";

export default function TeacherTopicDetail() {
  const { classId, topicId } = useParams();
  const navigate = useNavigate();

  // tabs
  const [tab, setTab] = useState("build"); // build | student | teacher | quiz

  // build inputs
  const [duration, setDuration] = useState(45);
  const [rawText, setRawText] = useState("");

  const [error, setError] = useState("");

  //header info
  const { classTitle, topicTitle, classDetail } = useTopicHeaderData(classId, topicId);

  const [userNote, setUserNote] = useState("");

  // metadata collapsible
  const [showMeta, setShowMeta] = useState(false);

  const { files, fileInputRef, onFilesChange, removeFileAt, clearFiles } = useFileAttachments(setError);
  const notes = useTopicNotesWorkflow({
    classId,
    topicId,
    tab,
    rawText,
    duration,
    files,
    setError,
  });

  const quiz = useTopicQuizWorkflow({
    classId,
    topicId,
    classDetail,
    setError,
  });

  const {
    loading,
    history,
    activeTeacherVersionId,
    setActiveTeacherVersionId,
    activeStudentVersionId,
    setActiveStudentVersionId,
    dbTeacherVersionId,
    dbStudentVersionId,
    regenTarget,
    setRegenTarget,
    regenLoading,
    saveFinalLoading,
    isEditingTeacher,
    setIsEditingTeacher,
    isEditingStudent,
    setIsEditingStudent,
    teacherDraft,
    setTeacherDraft,
    studentDraft,
    setStudentDraft,
    extractedView,
    teacherView,
    studentView,
    hasAnyOutput,
    dbTeacherLabel,
    dbStudentLabel,
    getById,
    onRun,
    onRegenerate,
    saveDraft,
    saveFinalFromActive,
    deleteVersion,
    clearHistory,
  } = notes;

  const {
    quizHistory,
    activeQuizVersionId,
    setActiveQuizVersionId,
    dbQuizVersionId,
    quizLoading,
    quizSaveLoading,
    quizMcq,
    setQuizMcq,
    quizYesNo,
    setQuizYesNo,
    quizFinalOpen,
    setQuizFinalOpen,
    quizDraftJson,
    setQuizDraftJson,
    isEditingQuiz,
    setIsEditingQuiz,
    quizRegenLoading,
    dbQuizLabel,
    getQuizById,
    onGenerateQuiz,
    onRegenerateQuiz,
    onSaveFinalQuiz,
  } = quiz;
  const hasDbTeacher = !!dbTeacherVersionId;
  const hasDbStudent = !!dbStudentVersionId;

  const logout = useLogout();

  // decorace
  const randomDecos = useRandomDecorations({
    seed: 123,
    starSrc: star,
    flightSrc: flight,
  });

  // layout 2 sloupců
  const twoCol = {
    display: "grid",
    gridTemplateColumns: "1fr 360px",
    gap: 14,
    alignItems: "start",
  };

  const paperBox = {
    background: "rgba(255,255,255,0.72)",
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 16,
    padding: 14,
    color: "#1f2330",
    lineHeight: 1.6,
    overflowX: "auto",
  };

  const codeTextareaStyle = {
    minHeight: 460,
    resize: "vertical",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    lineHeight: 1.5,
    color: "#1f2330",
  };

  const noNotesYet =
    (tab === "teacher" && !hasDbTeacher && !activeTeacherVersionId) ||
    (tab === "student" && !hasDbStudent && !activeStudentVersionId);

  async function handleRegenerateNotes() {
    const ok = await onRegenerate(userNote);
    if (ok) setUserNote("");
  }

  async function handleRegenerateQuiz() {
    await onRegenerateQuiz(userNote, () => setUserNote(""));
  }

  useEffect(() => {
    if (!error || !error.startsWith("✅")) return undefined;
    const timer = setTimeout(() => setError(""), 15000);
    return () => clearTimeout(timer);
  }, [error]);

  return (
    <div className="tcdPage">
      <AppBackgroundDecor
        cloudsSrc={clouds}
        labsSrc={labs}
        randomDecos={randomDecos}
        cloudsClassName="tcdDec tcdClouds"
        labsClassName="tcdDec tcdLabs"
        randomBaseClassName="tcdDec tcdRand"
        randomFlightClassName="tcdRandFlight"
        randomStarClassName="tcdRandStar"
      />

      <div className="tcdWrap">
        {/* TOPBAR */}
        <AppTopbar
          onLogout={logout}
          topbarClassName="tcdTopbar"
          logoClassName="tcdLogo"
          actionsClassName="tcdTopActions"
          logoutButtonClassName="tcdBtn pillDanger"
        />

        {/* HEADER */}
        <div className="tcdHeader">
          <div className="tcdHeaderLeft">
            <h1 className="tcdTitle">
              {classTitle || `Třída ${classId}`} –{" "}
              {topicTitle || `Kapitola ${topicId}`}
            </h1>

            <TopicTabs
              tab={tab}
              setTab={setTab}
              hasAnyOutput={hasAnyOutput}
              hasDbTeacher={hasDbTeacher}
              hasDbStudent={hasDbStudent}
              onBack={() => navigate(`/teacher/classes/${classId}`)}
            />
          </div>
        </div>

        {/* status */}
        {error && (
          <div
            className={error.startsWith("✅") ? "tcdSuccess" : "tcdError"}
            style={{ marginBottom: 12 }}
          >
            {error}
          </div>
        )}

        <div style={twoCol}>
          {/* LEFT */}
          <div style={{ display: "grid", gap: 12 }}>
            {/* HISTORY: v Tvorbě jen mazání */}
            {tab === "build" && (
              <VersionHistoryCard
                history={history}
                formatTime={formatTime}
                onDelete={deleteVersion}
                onClear={clearHistory}
              />
            )}

            {tab === "build" && (
              <TeacherTopicBuildTab duration={duration} setDuration={setDuration} rawText={rawText} setRawText={setRawText} />
            )}

            {/* STUDENT NOTES */}
            {tab === "student" && (
              <div className="tcdCard">
                <div className="tcdCardHeader" style={{ alignItems: "baseline" }}>
                  <div className="tcdCardTitle">Student Notes</div>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ opacity: 0.65, fontSize: 13 }}>
                      verze:{" "}
                      {activeStudentVersionId
                        ? formatTime(getById(activeStudentVersionId)?.createdAt)
                        : "—"}
                    </div>

                    {!isEditingStudent ? (
                      <button
                        className="tcdBtn ghost"
                        type="button"
                        onClick={() => setIsEditingStudent(true)}
                        disabled={noNotesYet}
                      >
                        ✏️ Upravit
                      </button>
                    ) : (
                      <button
                        className="tcdBtn ghost"
                        type="button"
                        onClick={() => setIsEditingStudent(false)}
                      >
                        👁️ Náhled
                      </button>
                    )}
                  </div>
                </div>

                {noNotesYet ? (
                  <div style={{ ...paperBox, opacity: 0.9 }}>
                    Nejdřív vygenerujte obsah v záložce <b>Tvorba</b>!
                  </div>
                ) : (
                  <>
                    <select
                      className="tcdInput"
                      value={activeStudentVersionId || ""}
                      onChange={(e) => setActiveStudentVersionId(e.target.value || null)}
                      disabled={history.length === 0}
                      style={{ marginBottom: 12 }}
                    >
                      <option value="">
                        {history.length === 0 ? "— žádné verze —" : "Vyber verzi"}
                      </option>
                      {history.map((h, idx) => (
                        <option key={h.id} value={h.id}>
                          {`Verze ${history.length - idx} — ${h.label} — ${formatTime(
                            h.createdAt
                          )}`}
                        </option>
                      ))}
                    </select>

                    {!isEditingStudent ? (
                      <div style={paperBox} className="mdBody">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {normalizeMd(studentDraft) || "—"}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <textarea
                        className="tcdInput"
                        value={studentDraft}
                        onChange={(e) => setStudentDraft(e.target.value)}
                        style={codeTextareaStyle}
                      />
                    )}

                    {isEditingStudent && (
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          marginTop: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          className="tcdBtn"
                          type="button"
                          onClick={() => saveDraft("student")}
                        >
                          💾 Uložit změny
                        </button>
                        <button
                          className="tcdBtn ghost"
                          type="button"
                          onClick={() => {
                            setStudentDraft(normalizeMd(studentView || ""));
                            setIsEditingStudent(false);
                          }}
                        >
                          Zrušit
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* TEACHER NOTES */}
            {tab === "teacher" && (
              <div className="tcdCard">
                <div className="tcdCardHeader" style={{ alignItems: "baseline" }}>
                  <div className="tcdCardTitle">Osnova pro učitele</div>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ opacity: 0.65, fontSize: 13 }}>
                      verze:{" "}
                      {activeTeacherVersionId
                        ? formatTime(getById(activeTeacherVersionId)?.createdAt)
                        : "—"}
                    </div>

                    {!isEditingTeacher ? (
                      <button
                        className="tcdBtn ghost"
                        type="button"
                        onClick={() => setIsEditingTeacher(true)}
                        disabled={noNotesYet}
                      >
                        ✏️ Upravit
                      </button>
                    ) : (
                      <button
                        className="tcdBtn ghost"
                        type="button"
                        onClick={() => setIsEditingTeacher(false)}
                      >
                        👁️ Náhled
                      </button>
                    )}
                  </div>
                </div>

                {noNotesYet ? (
                  <div style={{ ...paperBox, opacity: 0.9 }}>
                    Nejdřív vygenerujte obsah v záložce <b>Tvorba</b>!
                  </div>
                ) : (
                  <>
                    <select
                      className="tcdInput"
                      value={activeTeacherVersionId || ""}
                      onChange={(e) => setActiveTeacherVersionId(e.target.value || null)}
                      disabled={history.length === 0}
                      style={{ marginBottom: 12 }}
                    >
                      <option value="">
                        {history.length === 0 ? "— žádné verze —" : "Vyber verzi"}
                      </option>
                      {history.map((h, idx) => (
                        <option key={h.id} value={h.id}>
                          {`Verze ${history.length - idx} — ${h.label} — ${formatTime(
                            h.createdAt
                          )}`}
                        </option>
                      ))}
                    </select>

                    {!isEditingTeacher ? (
                      <div style={paperBox} className="mdBody">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {normalizeMd(teacherDraft) || "—"}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <textarea
                        className="tcdInput"
                        value={teacherDraft}
                        onChange={(e) => setTeacherDraft(e.target.value)}
                        style={codeTextareaStyle}
                      />
                    )}

                    {isEditingTeacher && (
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          marginTop: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          className="tcdBtn"
                          type="button"
                          onClick={() => saveDraft("teacher")}
                        >
                          💾 Uložit změny
                        </button>
                        <button
                          className="tcdBtn ghost"
                          type="button"
                          onClick={() => {
                            setTeacherDraft(normalizeMd(teacherView || ""));
                            setIsEditingTeacher(false);
                          }}
                        >
                          Zrušit
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* QUIZ */}
            {tab === "quiz" && (
              <div className="tcdCard">
                <div className="tcdCardHeader" style={{ alignItems: "baseline" }}>
                  <div className="tcdCardTitle">Quiz</div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    {!isEditingQuiz ? (
                      <button
                        className="tcdBtn ghost"
                        type="button"
                        onClick={() => setIsEditingQuiz(true)}
                        disabled={!activeQuizVersionId}
                      >
                        ✏️ Upravit JSON
                      </button>
                    ) : (
                      <button
                        className="tcdBtn ghost"
                        type="button"
                        onClick={() => setIsEditingQuiz(false)}
                      >
                        👁️ Náhled
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <div className="tcdField" style={{ maxWidth: 120 }}>
                      <div style={{ fontWeight: 800, marginBottom: 6, color: "#333" }}>MCQ</div>
                      <input
                        className="tcdInput"
                        type="number"
                        min={0}
                        max={50}
                        value={quizMcq}
                        onChange={(e) => setQuizMcq(Number(e.target.value || 0))}
                      />
                    </div>

                    <div className="tcdField" style={{ maxWidth: 120 }}>
                      <div style={{ fontWeight: 800, marginBottom: 6, color: "#333" }}>ANO/NE</div>
                      <input
                        className="tcdInput"
                        type="number"
                        min={0}
                        max={50}
                        value={quizYesNo}
                        onChange={(e) => setQuizYesNo(Number(e.target.value || 0))}
                      />
                    </div>

                    <div className="tcdField" style={{ maxWidth: 160 }}>
                      <div style={{ fontWeight: 800, marginBottom: 6, color: "#333" }}>FINAL_OPEN</div>
                      <select
                        className="tcdInput"
                        value={quizFinalOpen}
                        onChange={(e) => setQuizFinalOpen(Number(e.target.value))}
                      >
                        <option value={1}>1 (doporučeno)</option>
                        <option value={0}>0</option>
                      </select>
                    </div>
                  </div>

                  <button
                    className="tcdBtn primary"
                    type="button"
                    onClick={onGenerateQuiz}
                    disabled={quizLoading}
                  >
                    {quizLoading ? "Generuji kvíz…" : "✨ Vygenerovat kvíz z poznámek"}
                  </button>
                </div>

                <select
                  className="tcdInput"
                  value={activeQuizVersionId || ""}
                  onChange={(e) => {
                    const id = e.target.value || null;
                    setActiveQuizVersionId(id);
                    const it = getQuizById(id);
                    if (it?.quizSnapshot) setQuizDraftJson(safeJsonStringify(it.quizSnapshot));
                    setIsEditingQuiz(false);
                  }}
                  disabled={quizHistory.length === 0}
                  style={{ marginBottom: 12 }}
                >
                  <option value="">
                    {quizHistory.length === 0 ? "— žádné verze kvízu —" : "Vyber verzi kvízu"}
                  </option>
                  {quizHistory.map((h, idx) => (
                    <option key={h.id} value={h.id}>
                      {`Verze ${quizHistory.length - idx} — ${h.label} — ${formatTime(
                        h.createdAt
                      )}${dbQuizVersionId === h.id ? " ✅(DB)" : ""}`}
                    </option>
                  ))}
                </select>

                {activeQuizVersionId ? (
                  !isEditingQuiz ? (
                    <div style={paperBox}>
                      {(() => {
                        let parsed = null;
                        try {
                          parsed = safeParseJson(quizDraftJson);
                        } catch {
                          return <div style={{ opacity: 0.75 }}>Neplatný JSON.</div>;
                        }
                        const qs = parsed?.questions || [];
                        if (!qs.length) return <div style={{ opacity: 0.75 }}>— žádné otázky —</div>;

                        return (
                          <div style={{ display: "grid", gap: 10 }}>
                            {qs.map((q, i) => (
                              <div
                                key={q.id || i}
                                style={{
                                  background: "rgba(255,255,255,0.7)",
                                  border: "1px solid rgba(0,0,0,0.08)",
                                  borderRadius: 14,
                                  padding: 12,
                                }}
                              >
                                <div style={{ fontWeight: 900, marginBottom: 6 }}>
                                  {i + 1}. ({q.type}, diff {q.difficulty}) {q.prompt}
                                </div>

                                {q.type === "mcq" && q.options && (
                                  <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
                                    {["A", "B", "C", "D"].map((k) => (
                                      <div key={k} style={{ opacity: q.correct_answer === k ? 1 : 0.85 }}>
                                        <b>{k}:</b> {q.options?.[k]}
                                        {q.correct_answer === k ? " ✅" : ""}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {q.type === "yesno" && (
                                  <div style={{ marginTop: 6, opacity: 0.9 }}>
                                    Správně: <b>{q.correct_answer === "A" ? "ANO" : "NE"}</b>
                                  </div>
                                )}

                                {q.explanation && (
                                  <div style={{ marginTop: 8, fontStyle: "italic", opacity: 0.9 }}>
                                    {q.explanation}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <textarea
                      className="tcdInput"
                      value={quizDraftJson}
                      onChange={(e) => setQuizDraftJson(e.target.value)}
                      style={codeTextareaStyle}
                    />
                  )
                ) : (
                  <div style={{ ...paperBox, opacity: 0.9 }}>
                    Zatím nemáš žádný kvíz. Klikni na <b>Vygenerovat kvíz</b>.
                  </div>
                )}

              </div>
            )}

            {/* Metadata collapsible */}
            {(tab === "teacher" || tab === "student") && (
              <div className="tcdCard" style={{ opacity: 0.98 }}>
                <button
                  className="tcdBtn ghost"
                  type="button"
                  onClick={() => setShowMeta((v) => !v)}
                  style={{ width: "fit-content" }}
                >
                  {showMeta ? "▾ Skrýt metadata" : "▸ Zobrazit metadata"}
                </button>

                {showMeta && (
                  <pre
                    style={{
                      marginTop: 10,
                      background: "rgba(255,255,255,0.72)",
                      border: "1px solid rgba(0,0,0,0.08)",
                      borderRadius: 16,
                      padding: 12,
                      whiteSpace: "pre-wrap",
                      marginBottom: 0,
                      color: "#1f2330",
                      fontSize: 12,
                      lineHeight: 1.4,
                      overflowX: "auto",
                    }}
                  >
                    {JSON.stringify(extractedView, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>

          <TeacherTopicRightPanel
            tab={tab}
            onRun={onRun}
            loading={loading}
            fileInputRef={fileInputRef}
            onFilesChange={onFilesChange}
            files={files}
            removeFileAt={removeFileAt}
            clearFiles={clearFiles}
            isPdfFile={isPdfFile}
            isImageFile={isImageFile}
            dbTeacherLabel={dbTeacherLabel}
            dbStudentLabel={dbStudentLabel}
            dbQuizLabel={dbQuizLabel}
            onSaveFinalQuiz={onSaveFinalQuiz}
            saveFinalFromActive={saveFinalFromActive}
            quizSaveLoading={quizSaveLoading}
            activeQuizVersionId={activeQuizVersionId}
            saveFinalLoading={saveFinalLoading}
            noNotesYet={noNotesYet}
            regenTarget={regenTarget}
            setRegenTarget={setRegenTarget}
            userNote={userNote}
            setUserNote={setUserNote}
            onRegenerateQuiz={handleRegenerateQuiz}
            onRegenerate={handleRegenerateNotes}
            quizRegenLoading={quizRegenLoading}
            regenLoading={regenLoading}
          />
        </div>
      </div>
    </div>
  );
}
