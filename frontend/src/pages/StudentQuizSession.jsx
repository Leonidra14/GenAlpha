import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppTopbar from "../components/layout/AppTopbar";
import AppBackgroundDecor from "../components/layout/AppBackgroundDecor";
import { useLogout } from "../hooks/useLogout";
import { useStudentQuizSession } from "../hooks/useStudentQuizSession";
import { getStudentTopicDetail } from "../api/api";
import { postTutorMessageStream } from "../api/tutorStream";

import "./TeacherClassDetail.css";
import "./StudentQuizSession.css";

import clouds from "../assets/clouds.png";
import labs from "../assets/lab_books.png";
import star from "../assets/star.png";
import flight from "../assets/flight2.png";
import robotWorking from "../assets/working.png";
import robotNormal from "../assets/normal.png";
import { useRandomDecorations } from "../hooks/useRandomDecorations";
import { backgroundDecorPresets } from "../constants/backgroundDecorPresets";
import { pickBonusQuizStartingMessage } from "../constants/bonusQuizStartingMessages";

function sortedOptionKeys(options) {
  if (!options || typeof options !== "object") return [];
  return Object.keys(options).sort();
}

function sqsOptionToneClass(key, index) {
  const u = String(key).trim().toUpperCase();
  if (u.length === 1 && u >= "A" && u <= "D") {
    return `sqsOption--${u.toLowerCase()}`;
  }
  return `sqsOption--slot${index % 4}`;
}

function newTutorMessageId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `t-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function StudentQuizSession({ quizVariant = "main" }) {
  const { classId, topicId } = useParams();
  const nav = useNavigate();
  const logout = useLogout();
  const isBonus = quizVariant === "bonus";

  const onQuizFinished = useCallback(
    (out) => {
      if (out?.results_preview) {
        nav(`/student/classes/${classId}/topics/${topicId}/quiz/results/local`, {
          state: { quizResultsDetail: out.results_preview },
        });
        return;
      }
      const id = out?.attempt_id;
      if (id == null || id === "") return;
      nav(`/student/classes/${classId}/topics/${topicId}/quiz/results/${id}`);
    },
    [classId, topicId, nav]
  );

  const {
    starting,
    loadError,
    hasBegun,
    beginQuiz,
    attemptId,
    currentQuestion,
    isLastQuestion,
    index,
    total,
    progressLabel,
    awaitingNext,
    lastResult,
    submitError,
    submitting,
    finishing,
    finishError,
    submitCurrentAnswer,
    goToNextQuestion,
  } = useStudentQuizSession(classId, topicId, { onQuizFinished, variant: quizVariant });

  const [choice, setChoice] = useState("");
  const [openText, setOpenText] = useState("");
  const [topicTitle, setTopicTitle] = useState("");

  const [tutorPopupOpen, setTutorPopupOpen] = useState(false);
  const [tutorDraft, setTutorDraft] = useState("");
  const [tutorMessages, setTutorMessages] = useState([]);
  const [tutorPhase, setTutorPhase] = useState("idle");
  const [tutorBusy, setTutorBusy] = useState(false);
  const tutorAbortRef = useRef(null);
  const tutorEndRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await getStudentTopicDetail(classId, topicId);
        if (!cancelled && d?.title != null) {
          setTopicTitle(String(d.title).trim());
        }
      } catch {
        if (!cancelled) setTopicTitle("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classId, topicId]);

  const randomDecos = useRandomDecorations({
    ...backgroundDecorPresets.classTopicDetail,
    starSrc: star,
    flightSrc: flight,
  });

  const optionKeys = useMemo(
    () => sortedOptionKeys(currentQuestion?.options),
    [currentQuestion]
  );

  const progressFilledCount = index + (awaitingNext ? 1 : 0);
  const remainingCount = Math.max(0, total - progressFilledCount);
  const planePct =
    total > 0 ? Math.min(100, Math.max(0, (progressFilledCount / total) * 100)) : 0;

  const segmentMeta = useMemo(() => {
    if (total <= 0) return [];
    return Array.from({ length: total }, (_, i) => {
      const done = i < progressFilledCount;
      const current = !awaitingNext && i === progressFilledCount;
      return { key: i, done, current };
    });
  }, [total, progressFilledCount, awaitingNext]);

  const bonusStartingLine = useMemo(() => {
    if (!starting || !isBonus) return "";
    return pickBonusQuizStartingMessage();
  }, [starting, isBonus]);

  // Reset local answer state when moving to another question
  useEffect(() => {
    if (!awaitingNext && currentQuestion && hasBegun) {
      setChoice("");
      setOpenText("");
    }
  }, [currentQuestion, awaitingNext, hasBegun]);

  useEffect(() => {
    tutorAbortRef.current?.abort();
    tutorAbortRef.current = null;
    setTutorMessages([]);
    setTutorDraft("");
    setTutorPhase("idle");
    setTutorBusy(false);
  }, [attemptId, currentQuestion?.id]);

  useEffect(() => {
    return () => tutorAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!tutorPopupOpen || !tutorMessages.length) return;
    tutorEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [tutorMessages, tutorPopupOpen, tutorPhase]);

  useEffect(() => {
    if (!tutorPopupOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setTutorPopupOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tutorPopupOpen]);

  const sendTutorMessage = useCallback(async () => {
    const text = tutorDraft.trim();
    if (
      !text ||
      !attemptId ||
      !currentQuestion?.id ||
      awaitingNext ||
      !hasBegun ||
      tutorBusy
    ) {
      return;
    }
    const qid = currentQuestion.id;
    const userId = newTutorMessageId();
    const asstId = newTutorMessageId();
    setTutorDraft("");
    setTutorMessages((prev) => [
      ...prev,
      { id: userId, role: "user", text, streaming: false },
      { id: asstId, role: "assistant", text: "", streaming: true },
    ]);
    setTutorPhase("checking");
    setTutorBusy(true);
    tutorAbortRef.current?.abort();
    const ac = new AbortController();
    tutorAbortRef.current = ac;

    const applyAssistantUpdate = (fn) => {
      setTutorMessages((prev) => {
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].role === "assistant" && next[i].streaming) {
            next[i] = fn(next[i]);
            break;
          }
        }
        return next;
      });
    };

    try {
      await postTutorMessageStream({
        classId,
        topicId,
        attemptId,
        questionId: qid,
        message: text,
        signal: ac.signal,
        onEvent: (evt) => {
          if (!evt || typeof evt !== "object") return;
          switch (evt.type) {
            case "status":
              if (evt.phase === "checking" || evt.phase === "answering") {
                setTutorPhase(evt.phase);
              }
              break;
            case "token":
              applyAssistantUpdate((row) => ({
                ...row,
                text: (row.text || "") + (evt.text || ""),
              }));
              break;
            case "reject":
              applyAssistantUpdate((row) => ({
                ...row,
                text: evt.text || "",
                streaming: false,
              }));
              break;
            case "replace":
              applyAssistantUpdate((row) => ({
                ...row,
                text: evt.text || "",
              }));
              break;
            case "error":
              applyAssistantUpdate((row) => ({
                ...row,
                text: evt.message || "Asistent dočasně selhal.",
                streaming: false,
              }));
              break;
            case "done":
              setTutorMessages((prev) => {
                const next = [...prev];
                for (let i = next.length - 1; i >= 0; i--) {
                  if (next[i].role === "assistant" && next[i].streaming) {
                    next[i] = { ...next[i], streaming: false };
                    break;
                  }
                }
                return next;
              });
              break;
            default:
              break;
          }
        },
      });
    } catch (e) {
      if (e?.name === "AbortError") return;
      applyAssistantUpdate((row) => ({
        ...row,
        text: e?.message || "Nepodařilo se spojit s asistentem.",
        streaming: false,
      }));
    } finally {
      tutorAbortRef.current = null;
      setTutorBusy(false);
      setTutorPhase("idle");
    }
  }, [
    tutorDraft,
    attemptId,
    currentQuestion?.id,
    awaitingNext,
    hasBegun,
    tutorBusy,
    classId,
    topicId,
  ]);

  const tutorPhaseLabel =
    tutorPhase === "checking"
      ? "Kontroluji dotaz…"
      : tutorPhase === "answering"
        ? "Píšu odpověď…"
        : "";

  const showTutorPanel = hasBegun && !awaitingNext && Boolean(currentQuestion);
  const tutorSendDisabled =
    tutorBusy || !tutorDraft.trim() || submitting || !showTutorPanel;

  function handleSubmit(e) {
    e.preventDefault();
    if (!currentQuestion || awaitingNext || !hasBegun) return;
    if (currentQuestion.type === "final_open") {
      submitCurrentAnswer(openText);
    } else {
      submitCurrentAnswer(choice);
    }
  }

  const submitDisabled =
    submitting ||
    awaitingNext ||
    !hasBegun ||
    (currentQuestion?.type !== "final_open" && !choice);

  const backToTopic = () => nav(`/student/classes/${classId}/topics/${topicId}`);

  if (starting) {
    return (
      <div className="tcdPage sqsPage">
        <img className="tcdDec tcdClouds" src={clouds} alt="" aria-hidden="true" />
        <div className="tcdWrap">
          {isBonus ? (
            <div className="tcdCard sqsBonusStarting" role="status" aria-live="polite">
              <div className="sqsBonusStartingInner">
                <img
                  className="sqsBonusStartingMascot"
                  src={robotWorking}
                  alt="Robot připravuje kvíz"
                />
                <p className="sqsBonusStartingText">{bonusStartingLine}</p>
              </div>
            </div>
          ) : (
            <div className="tcdLoading">Spouštím kvíz…</div>
          )}
        </div>
      </div>
    );
  }

  if (loadError && !hasBegun) {
    return (
      <div className="tcdPage sqsPage">
        <img className="tcdDec tcdClouds" src={clouds} alt="" aria-hidden="true" />
        <div className="tcdWrap">
          <div className="tcdError">{loadError}</div>
          <div className="sqsActions">
            <button type="button" className="tcdBtn primary" onClick={() => beginQuiz()}>
              Zkusit znovu
            </button>
            <button type="button" className="tcdBtn ghost" onClick={backToTopic}>
              ← Zpět na kapitolu
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!hasBegun) {
    return (
      <div className="tcdPage sqsPage">
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
          <AppTopbar
            onLogout={logout}
            topbarClassName="tcdTopbar"
            logoClassName="tcdLogo"
            actionsClassName="tcdTopActions"
            logoutButtonClassName="tcdBtn pillDanger"
            actions={
              <button type="button" className="tcdBtn ghost" onClick={backToTopic}>
                ← Zpět
              </button>
            }
          />
          <div className="tcdHeader">
            <h1 className="tcdTitle">
              {topicTitle
                ? `${isBonus ? "Bonusový kvíz" : "Kvíz"}: ${topicTitle}`
                : isBonus
                  ? "Bonusový kvíz"
                  : "Kvíz"}
            </h1>
          </div>
          <div className="tcdCard">
            <div className="tcdCardHeader">
              <div className="tcdCardTitle">Připraven?</div>
            </div>
            <p className="sqsIntroHint">
              {isBonus
                ? "Bonusový kvíz slouží pro tvé procvičování a je vytvořen přímo pro tebe na základě výsledků hlavního kvízu."
                : "Po zahájení se začne měřit čas. Odpovídej na otázky jak nejlépe dovedeš, k dispozici ti je pomocník, kterého se můžeš ptát. Hodně štěstí!"}
            </p>
            <div className="sqsActions">
              <button type="button" className="tcdBtn primary" onClick={() => beginQuiz()}>
                {isBonus ? "Zahájit bonusový kvíz" : "Zahájit kvíz"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tcdPage sqsPage">
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
        <AppTopbar
          onLogout={logout}
          topbarClassName="tcdTopbar"
          logoClassName="tcdLogo"
          actionsClassName="tcdTopActions"
          logoutButtonClassName="tcdBtn pillDanger"
          actions={
            <button type="button" className="tcdBtn ghost" onClick={backToTopic}>
              ← Zpět
            </button>
          }
        />

        <div className="tcdHeader">
          <h1 className="tcdTitle">
            {topicTitle
              ? `${isBonus ? "Bonusový kvíz" : "Kvíz"}: ${topicTitle}`
              : isBonus
                ? "Bonusový kvíz"
                : "Kvíz"}
          </h1>
        </div>

        <div className="tcdCard">
            {progressLabel && total > 0 ? (
              <div
                className="sqsProgress"
                role="group"
                aria-label={`Postup kvízu: otázka ${index + 1} z ${total}, zbývá ${remainingCount}`}
              >
                <div className="sqsProgressTop">
                  <span className="sqsProgressCaption" aria-hidden="true">
                    Otázka {index + 1} z {total}
                  </span>
                  <span className="sqsProgressRemain" aria-hidden="true">
                    {remainingCount === 0
                      ? "Poslední úsek"
                      : `Zbývá ${remainingCount} ${remainingCount === 1 ? "otázka" : remainingCount < 5 ? "otázky" : "otázek"}`}
                  </span>
                </div>
                <div className="sqsProgressTrack">
                  <div className="sqsProgressRunway" aria-hidden="true">
                    <div className="sqsProgressLane">
                      <div className="sqsProgressSegments">
                        {segmentMeta.map(({ key, done, current }) => (
                          <div
                            key={key}
                            className={[
                              "sqsProgressSeg",
                              done ? "sqsProgressSeg--done" : "",
                              current ? "sqsProgressSeg--current" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          />
                        ))}
                      </div>
                      <div
                        className="sqsProgressPlaneWrap"
                        style={{ left: `${planePct}%` }}
                      >
                        <img
                          src={flight}
                          alt=""
                          className="sqsProgressPlane"
                          width={500}
                          height={500}
                          decoding="async"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {currentQuestion ? (
              <>
                {!awaitingNext ? (
                  <form className="sqsQuestionBody" onSubmit={handleSubmit}>
                    <p className="sqsPrompt">{currentQuestion.prompt}</p>

                    {currentQuestion.type === "final_open" ? (
                      <textarea
                        className="sqsOpenInput"
                        value={openText}
                        onChange={(ev) => setOpenText(ev.target.value)}
                        placeholder="Tvoje odpověď…"
                        disabled={submitting}
                        maxLength={20000}
                      />
                    ) : (
                      <div className="sqsOptions" role="radiogroup" aria-label="Možnosti odpovědi">
                        {optionKeys.map((key, idx) => (
                          <label
                            key={key}
                            className={`sqsOption ${sqsOptionToneClass(key, idx)}`}
                          >
                            <input
                              type="radio"
                              name="quizChoice"
                              value={key}
                              checked={choice === key}
                              onChange={() => setChoice(key)}
                              disabled={submitting}
                            />
                            <span className="sqsOptionBody">
                              <span className="sqsOptionMark" aria-hidden="true">
                                {key}
                              </span>
                              <span className="sqsOptionText">
                                {currentQuestion.options[key]}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    )}

                    {submitError ? <div className="tcdError">{submitError}</div> : null}

                    <div className="sqsActions">
                      <button type="submit" className="tcdBtn primary" disabled={submitDisabled}>
                        {submitting ? "Odesílám…" : "Odeslat odpověď"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="sqsQuestionBody">
                    <p className="sqsPrompt">{currentQuestion.prompt}</p>
                    {lastResult ? (
                      <div
                        className={`sqsFeedback ${lastResult.is_correct ? "ok" : "bad"}`}
                        role="status"
                      >
                        <div className="sqsFeedbackTitle">
                          {lastResult.is_correct ? "Správně" : "Špatně"}
                          {typeof lastResult.score_delta === "number" ? (
                            <span>
                              {" "}
                              · +
                              {Number(lastResult.score_delta).toFixed(
                                Number.isInteger(lastResult.score_delta) ? 0 : 1
                              )}{" "}
                              b.
                            </span>
                          ) : null}
                        </div>
                        {lastResult.explanation ? (
                          <p className="sqsFeedbackBody">{lastResult.explanation}</p>
                        ) : null}
                        {lastResult.feedback ? (
                          <p className="sqsFeedbackBody">{lastResult.feedback}</p>
                        ) : null}
                        {!lastResult.explanation && !lastResult.feedback ? (
                          <p className="sqsFeedbackBody">Zpětná vazba není k dispozici.</p>
                        ) : null}
                      </div>
                    ) : null}

                    {finishError ? <div className="tcdError">{finishError}</div> : null}

                    <div className="sqsActions">
                      <button
                        type="button"
                        className="tcdBtn primary"
                        onClick={() => goToNextQuestion()}
                        disabled={finishing}
                      >
                        {finishing
                          ? "Ukládám…"
                          : isLastQuestion
                            ? "Zobrazit výsledky"
                            : "Další otázka"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="tcdEmpty">Kvíz neobsahuje žádné otázky.</div>
            )}
        </div>
      </div>

      {showTutorPanel ? (
        <>
          {tutorPopupOpen ? (
            <>
              <button
                type="button"
                className="sqsTutorPopupBackdrop"
                aria-label="Zavřít pomocníka"
                onClick={() => setTutorPopupOpen(false)}
              />
              <div
                id="sqsTutorPopupRegion"
                className="sqsTutorPopup"
                role="dialog"
                aria-modal="true"
                aria-labelledby="sqsTutorPopupTitle"
              >
                <div className="sqsTutorPopupChrome">
                  <div className="sqsTutorPopupTopBar">
                    <h2 id="sqsTutorPopupTitle" className="tcdCardTitle sqsTutorPopupTitle">
                      Chat
                    </h2>
                    <button
                      type="button"
                      className="sqsTutorPopupClose"
                      onClick={() => setTutorPopupOpen(false)}
                      aria-label="Zavřít"
                    >
                      ×
                    </button>
                  </div>

                  <div className="sqsTutorPanel sqsTutorPanel--popup" role="region">
                    <p className="sqsTutorHint">
                      Pomocník tě navede u látky a postupu — přímou odpověď na kvíz ti nedá.
                    </p>
                    {tutorPhaseLabel ? (
                      <p className="sqsTutorPhase" role="status" aria-live="polite">
                        {tutorPhaseLabel}
                      </p>
                    ) : null}

                    <div className="sqsTutorThread" aria-live="polite">
                      <div className="sqsTutorRow sqsTutorRow--assistant">
                        <div className="sqsTutorBubble">
                          <p className="sqsTutorBubbleText">Můžu ti pomoci? Zeptej se mě.</p>
                        </div>
                      </div>
                      {tutorMessages.map((m) => (
                        <div
                          key={m.id}
                          className={`sqsTutorRow sqsTutorRow--${m.role}`}
                        >
                          <div className="sqsTutorBubble">
                            {m.text ? (
                              <span className="sqsTutorBubbleText">{m.text}</span>
                            ) : m.streaming ? (
                              <span className="sqsTutorTyping" aria-hidden="true">
                                …
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                      <div ref={tutorEndRef} />
                    </div>

                    <div className="sqsTutorComposer">
                      <textarea
                        className="sqsTutorInput"
                        value={tutorDraft}
                        onChange={(ev) => setTutorDraft(ev.target.value)}
                        placeholder="Napiš svůj dotaz..."
                        rows={2}
                        maxLength={2000}
                        disabled={tutorBusy || submitting}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter" && !ev.shiftKey) {
                            ev.preventDefault();
                            sendTutorMessage();
                          }
                        }}
                      />
                      <div className="sqsTutorComposerActions">
                        <span className="sqsTutorCounter" aria-hidden="true">
                          {tutorDraft.length}/2000
                        </span>
                        <button
                          type="button"
                          className="tcdBtn primary sqsTutorSend"
                          disabled={tutorSendDisabled}
                          onClick={() => sendTutorMessage()}
                        >
                          {tutorBusy ? "Odesílám…" : "Odeslat"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          <button
            type="button"
            className={`sqsTutorFab${tutorPopupOpen ? " sqsTutorFab--open" : ""}`}
            onClick={() => setTutorPopupOpen((o) => !o)}
            aria-expanded={tutorPopupOpen}
            aria-controls={tutorPopupOpen ? "sqsTutorPopupRegion" : undefined}
            aria-label={tutorPopupOpen ? "Zavřít pomocníka" : "Otevřít pomocníka"}
          >
            <img src={robotNormal} alt="" className="sqsTutorFabImg" decoding="async" />
          </button>
        </>
      ) : null}
    </div>
  );
}
