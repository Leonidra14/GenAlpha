import React from "react";
import "../../styles/topic-common.css";
import "./TeacherTopicRightPanel.css";

export default function TeacherTopicRightPanel(props) {
  const {
    tab,
    onRun,
    loading,
    fileInputRef,
    onFilesChange,
    files,
    removeFileAt,
    clearFiles,
    isPdfFile,
    isImageFile,
    dbTeacherLabel,
    dbStudentLabel,
    dbQuizLabel,
    onSaveFinalQuiz,
    saveFinalFromActive,
    quizSaveLoading,
    activeQuizVersionId,
    saveFinalLoading,
    noNotesYet,
    regenTarget,
    setRegenTarget,
    userNote,
    setUserNote,
    onRegenerateQuiz,
    onRegenerate,
    quizRegenLoading,
    regenLoading,
  } = props;

  return (
    <div className="ttRightPanelSticky">
      {tab === "build" && (
        <>
          <div className="tcdCard">
            <div className="tcdCardTitle ttCardTitleSmall">
              Akce
            </div>
            <div className="ttRightPanelCardBody">
              <button className="tcdBtn primary ttFullWidth" onClick={onRun} disabled={loading}>
                {loading ? "Generuji..." : "Spustit generování"}
              </button>
              <div className="ttDbCardBody">
                Po prvním úspěšném výstupu se učitelské i studentské poznámky automaticky trvale uloží do DB.
              </div>
            </div>
          </div>

          <div className="tcdCard">
            <div className="tcdCardTitle ttCardTitleSmall">
              Prilohy (max 3) - PDF / obrazky
            </div>
            <div className="ttUploadDropZone ttRightPanelCardBody">
              <div className="ttUploadIconBox" aria-hidden="true">
                <div className="ttUploadIcon">🗂️</div>
              </div>

              <button type="button" className="tcdBtn primary ttFullWidth" onClick={() => fileInputRef.current?.click()}>
                + Přidat přílohu
              </button>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="application/pdf,image/*"
                onChange={onFilesChange}
                style={{ display: "none" }}
              />

              <div className="ttUploadHint">Podporované formáty: PDF, PNG/JPG/WEBP.</div>

              {files.length > 0 && (
                <div className="ttFilesList">
                  {files.map((f, idx) => {
                    const icon = isPdfFile(f) ? "📄" : isImageFile(f) ? "🖼️" : "📎";
                    return (
                      <div key={`${f.name}-${f.size}-${idx}`} className="ttFileItem">
                        <div className="ttFileMeta">
                          <div className="ttFileName" title={f.name}>
                            {icon} {f.name}
                          </div>
                          <div className="ttFileSize">{Math.round(f.size / 1024)} KB</div>
                        </div>
                        <button type="button" className="tcdBtn pillDanger ttFileRemoveBtn" onClick={() => removeFileAt(idx)} title="Odebrat">
                          x
                        </button>
                      </div>
                    );
                  })}

                  <button type="button" className="tcdBtn ghost" onClick={clearFiles}>
                    Odebrat všechny soubory
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {(tab === "teacher" || tab === "student" || tab === "quiz") && (
        <>
          <div className="tcdCard">
            <div className="tcdCardTitle ttCardTitleSmall">
              Trvale uložené verze
            </div>
            <div className="ttRightPanelCardBody">
              <div className="ttDbCardBody">
                {tab === "teacher" ? (
                  <div>
                    <b>Osnova pro učitele:</b> {dbTeacherLabel}
                  </div>
                ) : tab === "student" ? (
                  <div>
                    <b>Student:</b> {dbStudentLabel}
                  </div>
                ) : (
                  <div>
                    <b>Quiz:</b> {dbQuizLabel}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="tcdCard">
            <div className="tcdCardTitle ttCardTitleSmall">
              Finální verze
            </div>
            <div className="ttRightPanelCardBody">
              <div className="ttMuted13 ttFinalHint">
                Trvale ulož aktuálně vybranou verzi (a její úpravy).
              </div>
              <button
                className="tcdBtn primary ttFullWidth"
                onClick={() => {
                  if (tab === "quiz") onSaveFinalQuiz();
                  else saveFinalFromActive(tab === "teacher" ? "teacher" : "student");
                }}
                disabled={tab === "quiz" ? quizSaveLoading || !activeQuizVersionId : saveFinalLoading || noNotesYet}
              >
                {tab === "quiz"
                  ? quizSaveLoading
                    ? "Ukladam..."
                    : "Trvale uložit"
                  : saveFinalLoading
                    ? "Ukladam..."
                    : "Trvale uložit"}
              </button>
            </div>
          </div>

          <div className="tcdCard">
            <div className="tcdCardTitle ttCardTitleSmall">
              Upravit výstup
            </div>
            <div className="ttRightPanelCardBody">
              {tab !== "quiz" && (
                <select className="tcdInput" value={regenTarget} onChange={(e) => setRegenTarget(e.target.value)} disabled={noNotesYet}>
                  <option value="teacher">Osnova pro učitele</option>
                  <option value="student">Studentské poznámky</option>
                  <option value="both">Obojí</option>
                </select>
              )}
              <textarea
                className="tcdInput ttRegenTextArea"
                value={userNote}
                onChange={(e) => setUserNote(e.target.value)}
                disabled={tab === "quiz" ? !activeQuizVersionId : noNotesYet}
                placeholder={
                  tab === "quiz"
                    ? "Např.: zjednoduš otázky, přidej lehčí varianty pro slabší žáky..."
                    : "Např.: zjednoduš to, přidej příklady, zkrať text na hlavní body..."
                }
                maxLength={2000}
              />
              <button
                className="tcdBtn ttFullWidth ttRegenBtn"
                onClick={tab === "quiz" ? onRegenerateQuiz : onRegenerate}
                disabled={tab === "quiz" ? quizRegenLoading || !userNote.trim() || !activeQuizVersionId : regenLoading || !userNote.trim() || noNotesYet}
              >
                {tab === "quiz" ? (quizRegenLoading ? "Upravuji kvíz..." : "Upravit kvíz") : regenLoading ? "Regeneruji..." : "Upravit"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
