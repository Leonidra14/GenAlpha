import { useCallback, useEffect, useMemo, useState } from "react";
import {
  finishStudentQuiz,
  startStudentBonusQuiz,
  startStudentQuiz,
  submitStudentQuizAnswer,
} from "../api/api";

/**
 * Orchestrates student quiz: start (on demand), sequential submit with feedback, finish.
 * @param {{ onQuizFinished?: (summary: object) => void, variant?: "main" | "bonus" }} [options] — e.g. navigate to results
 */
export function useStudentQuizSession(classId, topicId, options = {}) {
  const { onQuizFinished, variant = "main" } = options;

  const [loadError, setLoadError] = useState("");
  const [starting, setStarting] = useState(false);
  const [attemptId, setAttemptId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [awaitingNext, setAwaitingNext] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [finishError, setFinishError] = useState("");

  useEffect(() => {
    setLoadError("");
    setStarting(false);
    setAttemptId(null);
    setQuestions([]);
    setIndex(0);
    setAwaitingNext(false);
    setLastResult(null);
    setSummary(null);
    setFinishError("");
  }, [classId, topicId, variant]);

  const beginQuiz = useCallback(async () => {
    setLoadError("");
    setStarting(true);
    setAttemptId(null);
    setQuestions([]);
    setIndex(0);
    setAwaitingNext(false);
    setLastResult(null);
    setSummary(null);
    setFinishError("");
    try {
      const startFn = variant === "bonus" ? startStudentBonusQuiz : startStudentQuiz;
      const out = await startFn(classId, topicId);
      if (!out) return;
      setAttemptId(out.attempt_id || null);
      setQuestions(Array.isArray(out.questions) ? out.questions : []);
    } catch (e) {
      setLoadError(e?.message || "Nepodařilo se spustit kvíz.");
    } finally {
      setStarting(false);
    }
  }, [classId, topicId, variant]);

  const currentQuestion = useMemo(() => {
    if (!questions.length || index < 0 || index >= questions.length) return null;
    return questions[index];
  }, [questions, index]);

  const isComplete = summary != null;
  const total = questions.length;
  const progressLabel =
    total > 0 && !isComplete ? `Otázka ${index + 1} z ${total}` : "";

  const submitCurrentAnswer = useCallback(
    async (answer) => {
      if (!attemptId || !currentQuestion || awaitingNext || isComplete) return;
      setSubmitError("");
      setSubmitting(true);
      try {
        const out = await submitStudentQuizAnswer(classId, topicId, attemptId, {
          question_id: currentQuestion.id,
          answer: answer ?? "",
        });
        if (!out) return;
        setLastResult({
          is_correct: Boolean(out.is_correct),
          score_delta: typeof out.score_delta === "number" ? out.score_delta : 0,
          explanation: out.explanation ?? null,
          feedback: out.feedback ?? null,
        });
        setAwaitingNext(true);
      } catch (e) {
        setSubmitError(e?.message || "Odeslání odpovědi se nezdařilo.");
      } finally {
        setSubmitting(false);
      }
    },
    [
      attemptId,
      classId,
      topicId,
      currentQuestion,
      awaitingNext,
      isComplete,
    ]
  );

  const goToNextQuestion = useCallback(async () => {
    if (!awaitingNext || !attemptId || isComplete) return;
    setFinishError("");
    if (index + 1 < questions.length) {
      setIndex((i) => i + 1);
      setLastResult(null);
      setAwaitingNext(false);
      return;
    }
    setFinishing(true);
    try {
      const out = await finishStudentQuiz(classId, topicId, attemptId);
      if (!out) return;
      setAwaitingNext(false);
      if (typeof onQuizFinished === "function") {
        onQuizFinished(out);
      } else {
        setSummary(out);
      }
    } catch (e) {
      setFinishError(e?.message || "Ukončení kvízu se nezdařilo.");
    } finally {
      setFinishing(false);
    }
  }, [
    awaitingNext,
    attemptId,
    isComplete,
    index,
    questions.length,
    classId,
    topicId,
    onQuizFinished,
  ]);

  const hasBegun = Boolean(attemptId);

  return {
    starting,
    loadError,
    attemptId,
    hasBegun,
    beginQuiz,
    questions,
    currentQuestion,
    index,
    total,
    isLastQuestion: total > 0 && index === total - 1,
    progressLabel,
    awaitingNext,
    lastResult,
    submitError,
    submitting,
    finishing,
    finishError,
    summary,
    isComplete,
    submitCurrentAnswer,
    goToNextQuestion,
  };
}
