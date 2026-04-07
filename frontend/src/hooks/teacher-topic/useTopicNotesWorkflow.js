import { useEffect, useMemo, useRef, useState } from "react";
import { topicNotesApi } from "../../api/api";
import { normalizeMd } from "../../utils/markdown";
import { formatTime, getVersionNumberById } from "../../utils/versioning";

export function useTopicNotesWorkflow({ classId, topicId, tab, rawText, duration, files, setError }) {
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTeacherVersionId, setActiveTeacherVersionId] = useState(null);
  const [activeStudentVersionId, setActiveStudentVersionId] = useState(null);
  const [dbTeacherVersionId, setDbTeacherVersionId] = useState(null);
  const [dbStudentVersionId, setDbStudentVersionId] = useState(null);
  const [regenTarget, setRegenTarget] = useState("teacher");
  const [regenLoading, setRegenLoading] = useState(false);
  const [saveFinalLoading, setSaveFinalLoading] = useState(false);
  const [isEditingTeacher, setIsEditingTeacher] = useState(false);
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [teacherDraft, setTeacherDraft] = useState("");
  const [studentDraft, setStudentDraft] = useState("");
  const [loading, setLoading] = useState(false);

  const versionCounterRef = useRef(0);
  const autoSavedRef = useRef(false);

  function insertHistorySnapshot({ snapshot, label, createdAt, forceId }) {
    const id = forceId || `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const item = {
      id,
      createdAt: createdAt || new Date().toISOString(),
      label,
      resultSnapshot: JSON.parse(JSON.stringify(snapshot)),
    };
    setHistory((prev) => {
      const exists = prev.some((h) => h.id === id);
      if (exists) return prev.map((h) => (h.id === id ? item : h));
      return [item, ...prev];
    });
    return id;
  }

  function snapshotResult(res, label) {
    versionCounterRef.current += 1;
    const id = `${Date.now()}_${versionCounterRef.current}`;
    const item = {
      id,
      createdAt: new Date().toISOString(),
      label,
      resultSnapshot: JSON.parse(JSON.stringify(res)),
    };
    setHistory((prev) => [item, ...prev]);
    return id;
  }

  function getById(id) {
    return history.find((h) => h.id === id) || null;
  }

  const teacherView = useMemo(() => {
    const item = getById(activeTeacherVersionId);
    return item?.resultSnapshot?.teacher_notes_md || "";
  }, [history, activeTeacherVersionId]);

  const studentView = useMemo(() => {
    const item = getById(activeStudentVersionId);
    return item?.resultSnapshot?.student_notes_md || "";
  }, [history, activeStudentVersionId]);

  const extractedView = useMemo(() => {
    if (result?.extracted) return result.extracted;
    const item = getById(activeTeacherVersionId);
    return item?.resultSnapshot?.extracted || null;
  }, [result, history, activeTeacherVersionId]);

  useEffect(() => {
    let cancelled = false;
    async function loadDb() {
      setError("");
      try {
        const db = await topicNotesApi.getFinalNotes(classId, topicId);
        if (cancelled) return;
        const hasTeacher = !!(db?.teacher_notes_md || "").trim();
        const hasStudent = !!(db?.student_notes_md || "").trim();
        if (!hasTeacher && !hasStudent) return;
        const snapshot = {
          rejected: false,
          extracted: db?.extracted || null,
          teacher_notes_md: normalizeMd(db?.teacher_notes_md || ""),
          student_notes_md: normalizeMd(db?.student_notes_md || ""),
        };
        const id = insertHistorySnapshot({
          snapshot,
          label: "Z DB (finální)",
          createdAt: db?.updated_at || new Date().toISOString(),
          forceId: "db_final",
        });
        if (hasTeacher) {
          setActiveTeacherVersionId((prev) => prev || id);
          setTeacherDraft(normalizeMd(db.teacher_notes_md || ""));
          setDbTeacherVersionId(id);
        }
        if (hasStudent) {
          setActiveStudentVersionId((prev) => prev || id);
          setStudentDraft(normalizeMd(db.student_notes_md || ""));
          setDbStudentVersionId(id);
        }
      } catch {
        // silent
      }
    }
    loadDb();
    return () => {
      cancelled = true;
    };
  }, [classId, topicId, setError]);

  useEffect(() => {
    if (tab === "teacher") {
      setTeacherDraft(normalizeMd(teacherView || ""));
      setIsEditingTeacher(false);
    }
  }, [tab, activeTeacherVersionId, history.length, teacherView]);

  useEffect(() => {
    if (tab === "student") {
      setStudentDraft(normalizeMd(studentView || ""));
      setIsEditingStudent(false);
    }
  }, [tab, activeStudentVersionId, history.length, studentView]);

  async function autoSaveFirstGenerationToDb(data, createdVersionId) {
    if (autoSavedRef.current) return;
    autoSavedRef.current = true;
    try {
      await Promise.all([
        topicNotesApi.saveFinalTeacherNotes(classId, topicId, data?.teacher_notes_md || ""),
        topicNotesApi.saveFinalStudentNotes(classId, topicId, data?.student_notes_md || ""),
      ]);
      setDbTeacherVersionId(createdVersionId);
      setDbStudentVersionId(createdVersionId);
    } catch (e) {
      autoSavedRef.current = false;
      throw e;
    }
  }

  async function onRun() {
    setError("");
    setResult(null);
    if (!rawText.trim() && files.length === 0) {
      setError("Zadej text nebo nahraj soubor.");
      return;
    }
    setLoading(true);
    try {
      const data = await topicNotesApi.generateNotesWithFiles(classId, topicId, {
        duration_minutes: duration,
        raw_text: rawText,
        files,
      });
      const normalized = {
        ...data,
        teacher_notes_md: normalizeMd(data?.teacher_notes_md || ""),
        student_notes_md: normalizeMd(data?.student_notes_md || ""),
      };
      setResult(normalized);
      if (normalized && !normalized.rejected) {
        const id = snapshotResult(normalized, "Vygenerováno");
        setActiveTeacherVersionId(id);
        setActiveStudentVersionId(id);
        setTeacherDraft(normalized.teacher_notes_md || "");
        setStudentDraft(normalized.student_notes_md || "");
        await autoSaveFirstGenerationToDb(normalized, id);
      }
    } catch (e) {
      const code = e?.code;
      if (code === "file_error") setError(`Chyba souboru: ${e.message}`);
      else setError(e?.message || "Nepodařilo se spustit workflow.");
    } finally {
      setLoading(false);
    }
  }

  async function onRegenerate(userNote) {
    setError("");
    if (!userNote.trim()) {
      setError("Napiš krátkou poznámku pro AI.");
      return false;
    }
    const teacherMd = normalizeMd(teacherDraft || "");
    const studentMd = normalizeMd(studentDraft || "");
    if ((regenTarget === "teacher" || regenTarget === "both") && !teacherMd) {
      setError("Chybí Osnova pro učitele (není co upravit).");
      return false;
    }
    if ((regenTarget === "student" || regenTarget === "both") && !studentMd) {
      setError("Chybí Student Notes (není co upravit).");
      return false;
    }
    setRegenLoading(true);
    try {
      const data = await topicNotesApi.regenerateNotes(classId, topicId, {
        target: regenTarget,
        user_note: userNote,
        teacher_notes_md: teacherMd,
        student_notes_md: studentMd,
      });
      const normalized = {
        ...data,
        teacher_notes_md: normalizeMd(data?.teacher_notes_md || ""),
        student_notes_md: normalizeMd(data?.student_notes_md || ""),
      };
      setResult(normalized);
      if (normalized && !normalized.rejected) {
        const id = snapshotResult(normalized, `Regenerace: ${regenTarget}`);
        if (regenTarget === "teacher") {
          setActiveTeacherVersionId(id);
          setTeacherDraft(normalized.teacher_notes_md || "");
        } else if (regenTarget === "student") {
          setActiveStudentVersionId(id);
          setStudentDraft(normalized.student_notes_md || "");
        } else {
          setActiveTeacherVersionId(id);
          setActiveStudentVersionId(id);
          setTeacherDraft(normalized.teacher_notes_md || "");
          setStudentDraft(normalized.student_notes_md || "");
        }
      }
      return true;
    } catch (e) {
      setError(e?.message || "Nepodařilo se přegenerovat poznámky.");
      return false;
    } finally {
      setRegenLoading(false);
    }
  }

  async function saveDraft(kind) {
    setError("");
    const id = kind === "teacher" ? activeTeacherVersionId : activeStudentVersionId;
    if (!id) return;
    const draft = kind === "teacher" ? normalizeMd(teacherDraft) : normalizeMd(studentDraft);
    setHistory((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const snap = { ...(h.resultSnapshot || {}) };
        if (kind === "teacher") snap.teacher_notes_md = draft || "";
        else snap.student_notes_md = draft || "";
        const newLabel = (h.label || "").includes("upraveno") ? h.label : `${h.label} (upraveno)`;
        return { ...h, label: newLabel, resultSnapshot: snap };
      })
    );
    const isDb =
      (kind === "teacher" && id === dbTeacherVersionId) ||
      (kind === "student" && id === dbStudentVersionId);
    try {
      if (isDb) {
        if (kind === "teacher") await topicNotesApi.saveFinalTeacherNotes(classId, topicId, draft || "");
        else await topicNotesApi.saveFinalStudentNotes(classId, topicId, draft || "");
        setError("✅ Změny uložené (dočasně lokálně + trvale do DB).");
      } else {  
        setError("✅ Změny uložené (dočasně lokálně). Pro trvalé uložení použij „Trvale uložit“.");
      }
    } catch (e) {
      setError(e?.message || "Nepodařilo se trvale uložit změny do DB.");
    }
    if (kind === "teacher") setIsEditingTeacher(false);
    else setIsEditingStudent(false);
  }

  async function saveFinalFromActive(kind) {
    setError("");
    setSaveFinalLoading(true);
    try {
      if (kind === "teacher") {
        if (!activeTeacherVersionId) throw new Error("Vyber verzi pro osnovu pro učitele.");
        await topicNotesApi.saveFinalTeacherNotes(classId, topicId, normalizeMd(teacherDraft));
        setDbTeacherVersionId(activeTeacherVersionId);
        setError("✅ Osnova pro učitele trvale uložena do DB.");
      } else {
        if (!activeStudentVersionId) throw new Error("Vyber verzi pro Student Notes.");
        await topicNotesApi.saveFinalStudentNotes(classId, topicId, normalizeMd(studentDraft));
        setDbStudentVersionId(activeStudentVersionId);
        setError("✅ Studentské poznámky trvale uloženy do DB.");
      }
    } catch (e) {
      setError(e?.message || "Nepodařilo se uložit finální verzi.");
    } finally {
      setSaveFinalLoading(false);
    }
  }

  function deleteVersion(id) {
    setHistory((prev) => prev.filter((h) => h.id !== id));
    if (activeTeacherVersionId === id) setActiveTeacherVersionId(null);
    if (activeStudentVersionId === id) setActiveStudentVersionId(null);
    if (dbTeacherVersionId === id) setDbTeacherVersionId(null);
    if (dbStudentVersionId === id) setDbStudentVersionId(null);
  }

  function clearHistory() {
    setHistory([]);
    setActiveTeacherVersionId(null);
    setActiveStudentVersionId(null);
    setDbTeacherVersionId(null);
    setDbStudentVersionId(null);
  }

  const hasAnyOutput = history.length > 0 || (!!result && !result.rejected);

  const dbTeacherLabel = useMemo(() => {
    if (!dbTeacherVersionId) return "—";
    const it = getById(dbTeacherVersionId);
    if (!it) return "—";
    const n = getVersionNumberById(history, dbTeacherVersionId);
    return `Verze ${n ?? "—"} — ${it.label} — ${formatTime(it.createdAt)}`;
  }, [dbTeacherVersionId, history]);

  const dbStudentLabel = useMemo(() => {
    if (!dbStudentVersionId) return "—";
    const it = getById(dbStudentVersionId);
    if (!it) return "—";
    const n = getVersionNumberById(history, dbStudentVersionId);
    return `Verze ${n ?? "—"} — ${it.label} — ${formatTime(it.createdAt)}`;
  }, [dbStudentVersionId, history]);

  return {
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
  };
}
