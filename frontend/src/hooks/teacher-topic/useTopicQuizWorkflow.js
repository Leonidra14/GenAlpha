import { useEffect, useMemo, useRef, useState } from "react";
import { topicQuizApi } from "../../api/api";
import { safeJsonStringify, safeParseJson } from "../../utils/json";
import { formatTime, getVersionNumberById } from "../../utils/versioning";

export function useTopicQuizWorkflow({ classId, topicId, classDetail, setError }) {
  const [quizHistory, setQuizHistory] = useState([]);
  const [activeQuizVersionId, setActiveQuizVersionId] = useState(null);
  const [dbQuizVersionId, setDbQuizVersionId] = useState(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizSaveLoading, setQuizSaveLoading] = useState(false);
  const [quizMcq, setQuizMcq] = useState(8);
  const [quizYesNo, setQuizYesNo] = useState(4);
  const [quizFinalOpen, setQuizFinalOpen] = useState(1);
  const [quizDraftJson, setQuizDraftJson] = useState("");
  const [isEditingQuiz, setIsEditingQuiz] = useState(false);
  const [quizRegenLoading, setQuizRegenLoading] = useState(false);

  const quizVersionCounterRef = useRef(0);

  function snapshotQuiz(quizObj, label) {
    quizVersionCounterRef.current += 1;
    const id = `${Date.now()}_quiz_${quizVersionCounterRef.current}`;
    const item = {
      id,
      createdAt: new Date().toISOString(),
      label,
      quizSnapshot: JSON.parse(JSON.stringify(quizObj)),
    };
    setQuizHistory((prev) => [item, ...prev]);
    return id;
  }

  function getQuizById(id) {
    return quizHistory.find((h) => h.id === id) || null;
  }

  useEffect(() => {
    let cancelled = false;
    async function loadQuizDb() {
      try {
        const q = await topicQuizApi.getFinalQuiz(topicId);
        if (cancelled) return;
        const raw = (q?.basic_quiz || "").trim();
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const id = snapshotQuiz(parsed, "Z DB (finální)");
        setActiveQuizVersionId((prev) => prev || id);
        setDbQuizVersionId(id);
        setQuizDraftJson(safeJsonStringify(parsed));
        setIsEditingQuiz(false);
      } catch {
        // quiz jeste nemusi existovat
      }
    }
    loadQuizDb();
    return () => {
      cancelled = true;
    };
  }, [topicId]);

  async function onGenerateQuiz() {
    setError("");
    if (!classDetail?.grade || !classDetail?.subject) {
      setError("Chybí informace o třídě/předmětu (zkus reload).");
      return;
    }
    setQuizLoading(true);
    try {
      const quizObj = await topicQuizApi.generateQuiz(classId, topicId, {
        mcq: Number(quizMcq),
        yesno: Number(quizYesNo),
        final_open: Number(quizFinalOpen),
      });
      const id = snapshotQuiz(quizObj, "Vygenerováno");
      setActiveQuizVersionId(id);
      setQuizDraftJson(safeJsonStringify(quizObj));
      setIsEditingQuiz(true);
    } catch (e) {
      setError(e?.message || "Nepodařilo se vygenerovat kvíz.");
    } finally {
      setQuizLoading(false);
    }
  }

  async function onRegenerateQuiz(userNote, onDone) {
    setError("");
    if (!userNote.trim()) {
      setError("Napiš krátkou poznámku pro AI.");
      return;
    }
    if (!activeQuizVersionId) {
      setError("Není vybrána žádná verze kvízu k úpravě.");
      return;
    }
    setQuizRegenLoading(true);
    try {
      alert("Tlačítko funguje! Aby se kvíz reálně upravil, je potřeba dopsat funkci regenerateQuiz do api.js a backendu.");
      if (onDone) onDone();
    } catch (e) {
      setError(e?.message || "Nepodařilo se přegenerovat kvíz.");
    } finally {
      setQuizRegenLoading(false);
    }
  }

  async function onSaveFinalQuiz() {
    setError("");
    if (!activeQuizVersionId) {
      setError("Vyber verzi kvízu.");
      return;
    }
    let parsed;
    try {
      parsed = safeParseJson(quizDraftJson);
    } catch {
      setError("Neplatný JSON v editoru kvízu.");
      return;
    }
    setQuizSaveLoading(true);
    try {
      const normalized = JSON.stringify(parsed);
      await topicQuizApi.saveFinalQuiz(topicId, normalized);
      setDbQuizVersionId(activeQuizVersionId);
      setError("✅ Quiz finální uložen do DB.");
      setIsEditingQuiz(false);
    } catch (e) {
      setError(e?.message || "Nepodařilo se uložit finální kvíz.");
    } finally {
      setQuizSaveLoading(false);
    }
  }

  const dbQuizLabel = useMemo(() => {
    if (!dbQuizVersionId) return "—";
    const it = getQuizById(dbQuizVersionId);
    if (!it) return "—";
    const n = getVersionNumberById(quizHistory, dbQuizVersionId);
    return `Verze ${n ?? "—"} — ${it.label} — ${formatTime(it.createdAt)}`;
  }, [dbQuizVersionId, quizHistory]);

  return {
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
  };
}
