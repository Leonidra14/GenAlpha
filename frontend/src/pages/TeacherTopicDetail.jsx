// src/pages/TeacherTopicDetail.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  generateNotesWithFiles,
  regenerateNotes,
  saveFinalTeacherNotes,
  saveFinalStudentNotes,
  getFinalNotes,
  getClassDetail,
  getClassTopics,

  generateQuiz,
  getFinalQuiz,
  saveFinalQuiz,
} from "../api/api";
import { apiFetch } from "../api/client"; 

// ✅ markdown render
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// reuse stejného designu
import "./TeacherClassDetail.css";

// decor
import clouds from "../assets/clouds.png";
import labs from "../assets/lab_books.png";
import logo from "../assets/logo.png";
import star from "../assets/star.png";
import flight from "../assets/flight.png";

/* deterministic random */
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 🔧 Fix: LLM někdy vrátí celé poznámky obalené do ``` nebo ```markdown,
 * pak se to na stránce tváří jako "kód" a rozbije layout.
 * Tohle odstripuje "outer" code fence (jen pokud obaluje celý text).
 */
function stripOuterCodeFence(md) {
  const s = (md ?? "").trim();
  if (!s.startsWith("```")) return md ?? "";
  const lines = s.split("\n");
  if (lines.length < 3) return md ?? "";

  const first = lines[0].trim(); // ``` nebo ```markdown
  const last = lines[lines.length - 1].trim();
  if (!first.startsWith("```") || last !== "```") return md ?? "";

  // odstraň první a poslední řádek
  const inner = lines.slice(1, -1).join("\n").trim();
  return inner;
}

function normalizeMd(md) {
  return stripOuterCodeFence(md ?? "").trim();
}

function safeJsonStringify(obj) {
  return JSON.stringify(obj, null, 2);
}
function safeParseJson(text) {
  return JSON.parse((text || "").trim());
}

export default function TeacherTopicDetail() {
  const { classId, topicId } = useParams();
  const navigate = useNavigate();

  // tabs
  const [tab, setTab] = useState("build"); // build | student | teacher | quiz

  // build inputs
  const [duration, setDuration] = useState(45);
  const [rawText, setRawText] = useState("");
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);

  // state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  //header info
  const [classTitle, setClassTitle] = useState("");
  const [topicTitle, setTopicTitle] = useState("");
  const [classDetail, setClassDetail] = useState(null);

  // historie verzí (lokálně) pro NOTES
  const [history, setHistory] = useState([]);

  // aktivní verze NOTES
  const [activeTeacherVersionId, setActiveTeacherVersionId] = useState(null);
  const [activeStudentVersionId, setActiveStudentVersionId] = useState(null);

  // která verze NOTES je uložená v DB
  const [dbTeacherVersionId, setDbTeacherVersionId] = useState(null);
  const [dbStudentVersionId, setDbStudentVersionId] = useState(null);

  // regen NOTES
  const [regenTarget, setRegenTarget] = useState("teacher"); // teacher|student|both
  const [userNote, setUserNote] = useState("");
  const [regenLoading, setRegenLoading] = useState(false);

  // save NOTES loading
  const [saveFinalLoading, setSaveFinalLoading] = useState(false);

  // edit mode NOTES
  const [isEditingTeacher, setIsEditingTeacher] = useState(false);
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [teacherDraft, setTeacherDraft] = useState("");
  const [studentDraft, setStudentDraft] = useState("");

  // metadata collapsible
  const [showMeta, setShowMeta] = useState(false);

  // counters
  const versionCounterRef = useRef(0);
  const autoSavedRef = useRef(false);

  // --- QUIZ STATE ---
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

  const quizVersionCounterRef = useRef(0);

  const allowed = useMemo(
    () =>
      new Set([
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
      ]),
    []
  );

  function _isPdf(f) {
    return (
      (f.type || "").toLowerCase() === "application/pdf" ||
      (f.name || "").toLowerCase().endsWith(".pdf")
    );
  }

  function _isImage(f) {
    const t = (f.type || "").toLowerCase();
    return (
      t.startsWith("image/") ||
      (f.name || "").toLowerCase().endsWith(".png") ||
      (f.name || "").toLowerCase().endsWith(".jpg") ||
      (f.name || "").toLowerCase().endsWith(".jpeg") ||
      (f.name || "").toLowerCase().endsWith(".webp")
    );
  }

  function onFilesChange(e) {
    setError("");
    const selected = Array.from(e.target.files || []);

    if (selected.length > 3) {
      setError("Maximální počet souborů je 3.");
      e.target.value = "";
      setFiles([]);
      return;
    }

    const bad = selected.find(
      (f) =>
        !allowed.has((f.type || "").toLowerCase()) && !_isPdf(f) && !_isImage(f)
    );

    if (bad) {
      setError(
        `Nepodporovaný typ souboru: ${bad.name} (${bad.type || "unknown"}).`
      );
      e.target.value = "";
      setFiles([]);
      return;
    }

    setFiles(selected);
  }

  function removeFileAt(idx) {
    setError("");
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function clearFiles() {
    setError("");
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function formatTime(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString("cs-CZ");
    } catch {
      return iso;
    }
  }

  // --- VERSIONING (NOTES) ---
  function _insertHistorySnapshot({ snapshot, label, createdAt, forceId }) {
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

  function _snapshotResult(res, label) {
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

  function getVersionNumber(id) {
    if (!id) return null;
    const idx = history.findIndex((h) => h.id === id);
    if (idx === -1) return null;
    return history.length - idx; // nejnovější má nejvyšší číslo
  }

  // --- VERSIONING (QUIZ) ---
  function _snapshotQuiz(quizObj, label) {
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

  function getQuizVersionNumber(id) {
    if (!id) return null;
    const idx = quizHistory.findIndex((h) => h.id === id);
    if (idx === -1) return null;
    return quizHistory.length - idx;
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

  // HEADER LOAD
  useEffect(() => {
    let cancelled = false;

    async function loadHeader() {
      try {
        const [cls, topics] = await Promise.all([
          getClassDetail(classId),
          getClassTopics(classId),
        ]);
        if (cancelled) return;

        setClassDetail(cls || null);

        const clsLabel =
          (cls?.custom_name || "").trim() ||
          (cls?.grade != null && cls?.subject
            ? `${cls.grade}. třída – ${cls.subject}`
            : "") ||
          cls?.subject ||
          `Třída ${classId}`;

        const t = (topics || []).find((x) => String(x.id) === String(topicId));
        const topicLabel = (t?.title || "").trim() || `Kapitola ${topicId}`;

        setClassTitle(clsLabel);
        setTopicTitle(topicLabel);
      } catch {
        setClassTitle(`Třída ${classId}`);
        setTopicTitle(`Kapitola ${topicId}`);
        setClassDetail(null);
      }
    }

    loadHeader();
    return () => {
      cancelled = true;
    };
  }, [classId, topicId]);

  // ✅ načti DB NOTES verzi po otevření stránky
  useEffect(() => {
    let cancelled = false;

    async function loadDb() {
      setError("");
      try {
        const db = await getFinalNotes(classId, topicId);
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

        const id = _insertHistorySnapshot({
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
        // potichu
      }
    }

    loadDb();
    return () => {
      cancelled = true;
    };
  }, [classId, topicId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ načti DB QUIZ po otevření stránky
  useEffect(() => {
    let cancelled = false;

    async function loadQuizDb() {
      try {
        const q = await getFinalQuiz(topicId);
        if (cancelled) return;

        const raw = (q?.basic_quiz || "").trim();
        if (!raw) return;

        const parsed = JSON.parse(raw);
        const id = _snapshotQuiz(parsed, "Z DB (finální)");

        setActiveQuizVersionId((prev) => prev || id);
        setDbQuizVersionId(id);
        setQuizDraftJson(safeJsonStringify(parsed));
        setIsEditingQuiz(false);
      } catch {
        // quiz ještě nemusí existovat
      }
    }

    loadQuizDb();
    return () => {
      cancelled = true;
    };
  }, [topicId]); // eslint-disable-line react-hooks/exhaustive-deps

  // keep drafts synced when switching version/tab (NOTES)
  useEffect(() => {
    if (tab === "teacher") {
      setTeacherDraft(normalizeMd(teacherView || ""));
      setIsEditingTeacher(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, activeTeacherVersionId, history.length]);

  useEffect(() => {
    if (tab === "student") {
      setStudentDraft(normalizeMd(studentView || ""));
      setIsEditingStudent(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, activeStudentVersionId, history.length]);

  async function autoSaveFirstGenerationToDb(data, createdVersionId) {
    if (autoSavedRef.current) return;
    autoSavedRef.current = true;

    try {
      await Promise.all([
        saveFinalTeacherNotes(classId, topicId, data?.teacher_notes_md || ""),
        saveFinalStudentNotes(classId, topicId, data?.student_notes_md || ""),
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
      const data = await generateNotesWithFiles(classId, topicId, {
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
        const id = _snapshotResult(normalized, "Vygenerováno");
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

  // ✅ REGEN: posíláme jen to co je aktuálně otevřené v markdownu + user_note + target
  async function onRegenerate() {
    setError("");

    if (!userNote.trim()) {
      setError("Napiš krátkou poznámku pro AI.");
      return;
    }

    const teacher_md = normalizeMd(teacherDraft || "");
    const student_md = normalizeMd(studentDraft || "");

    if ((regenTarget === "teacher" || regenTarget === "both") && !teacher_md) {
      setError("Chybí Teacher Notes (není co upravit).");
      return;
    }
    if ((regenTarget === "student" || regenTarget === "both") && !student_md) {
      setError("Chybí Student Notes (není co upravit).");
      return;
    }

    setRegenLoading(true);
    try {
      const data = await regenerateNotes(classId, topicId, {
        target: regenTarget,
        user_note: userNote,
        teacher_notes_md: teacher_md,
        student_notes_md: student_md,
      });

      const normalized = {
        ...data,
        teacher_notes_md: normalizeMd(data?.teacher_notes_md || ""),
        student_notes_md: normalizeMd(data?.student_notes_md || ""),
      };

      setResult(normalized);

      if (normalized && !normalized.rejected) {
        const id = _snapshotResult(normalized, `Regenerace: ${regenTarget}`);

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

      setUserNote("");
    } catch (e) {
      setError(e?.message || "Nepodařilo se přegenerovat poznámky.");
    } finally {
      setRegenLoading(false);
    }
  }

  // ✅ Uložit změny do historie; pokud jde o DB verzi, zapiš rovnou i do DB
  async function saveDraft(kind) {
    setError("");
    const id =
      kind === "teacher" ? activeTeacherVersionId : activeStudentVersionId;
    if (!id) return;

    const draft =
      kind === "teacher" ? normalizeMd(teacherDraft) : normalizeMd(studentDraft);

    // 1) lokálně propsat do historie
    setHistory((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;

        const snap = { ...(h.resultSnapshot || {}) };
        if (kind === "teacher") snap.teacher_notes_md = draft || "";
        else snap.student_notes_md = draft || "";

        const newLabel = (h.label || "").includes("upraveno")
          ? h.label
          : `${h.label} (upraveno)`;

        return { ...h, label: newLabel, resultSnapshot: snap };
      })
    );

    // 2) pokud je to DB verze, ulož rovnou do DB
    const isDb =
      (kind === "teacher" && id === dbTeacherVersionId) ||
      (kind === "student" && id === dbStudentVersionId);

    try {
      if (isDb) {
        if (kind === "teacher")
          await saveFinalTeacherNotes(classId, topicId, draft || "");
        else await saveFinalStudentNotes(classId, topicId, draft || "");
        setError("✅ Změny uložené (lokálně + do DB).");
      } else {
        setError(
          "✅ Změny uložené (lokálně). Pro DB použij „Uložit jako finální“."
        );
      }
    } catch (e) {
      setError(e?.message || "Nepodařilo se uložit změny do DB.");
    }

    if (kind === "teacher") setIsEditingTeacher(false);
    else setIsEditingStudent(false);
  }

  // ✅ uložit aktuální draft do DB jako finální
  async function saveFinalFromActive(kind) {
    setError("");
    setSaveFinalLoading(true);

    try {
      if (kind === "teacher") {
        if (!activeTeacherVersionId)
          throw new Error("Vyber verzi pro Teacher Notes.");
        await saveFinalTeacherNotes(classId, topicId, normalizeMd(teacherDraft));
        setDbTeacherVersionId(activeTeacherVersionId);
        setError("✅ Teacher finální uloženo do DB.");
      } else {
        if (!activeStudentVersionId)
          throw new Error("Vyber verzi pro Student Notes.");
        await saveFinalStudentNotes(classId, topicId, normalizeMd(studentDraft));
        setDbStudentVersionId(activeStudentVersionId);
        setError("✅ Student finální uloženo do DB.");
      }
    } catch (e) {
      setError(e?.message || "Nepodařilo se uložit finální verzi.");
    } finally {
      setSaveFinalLoading(false);
    }
  }

  // --- QUIZ actions ---
  async function onGenerateQuiz() {
    setError("");

    // ✅ požadavek: jako plain_text použij aktuálně uložené Teacher Notes v DB
    // -> frontend jen spustí generování; backend si vytáhne DB teacher_notes_md + class metadata
    // -> tady posíláme jen počty otázek (a vůbec se nehrabeme v teacherDraft)
    if (!classDetail?.grade || !classDetail?.subject) {
      setError("Chybí informace o třídě/předmětu (zkus reload).");
      return;
    }

    setQuizLoading(true);
    try {
      // ✅ SPRÁVNÉ volání (už žádné destructuring z undefined):
      // generateQuiz(classId, topicId, { mcq, yesno, final_open })
      const quizObj = await generateQuiz(classId, topicId, {
        mcq: Number(quizMcq),
        yesno: Number(quizYesNo),
        final_open: Number(quizFinalOpen),
      });

      const id = _snapshotQuiz(quizObj, "Vygenerováno");
      setActiveQuizVersionId(id);
      setQuizDraftJson(safeJsonStringify(quizObj));
      setIsEditingQuiz(true);
    } catch (e) {
      setError(e?.message || "Nepodařilo se vygenerovat kvíz.");
    } finally {
      setQuizLoading(false);
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
      // uložíme jako TEXT JSON string
      const normalized = JSON.stringify(parsed);
      await saveFinalQuiz(topicId, normalized);

      setDbQuizVersionId(activeQuizVersionId);
      setError("✅ Quiz finální uložen do DB.");
      setIsEditingQuiz(false);
    } catch (e) {
      setError(e?.message || "Nepodařilo se uložit finální kvíz.");
    } finally {
      setQuizSaveLoading(false);
    }
  }

  // --- HISTORIE: v Tvorbě jen mazání ---
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
  const hasDbTeacher = !!dbTeacherVersionId;
  const hasDbStudent = !!dbStudentVersionId;

const logout = async () => {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch (err) {
    console.warn("Serverové odhlášení selhalo, pokračuji lokálně...", err);
  } finally {
    localStorage.removeItem("access_token");
    window.location.href = "/";
  }
};

  // decorace
  const randomDecos = useMemo(() => {
    const rand = mulberry32(123);

    const starsCount = 18 + Math.floor(rand() * 10);
    const flightsCount = 6 + Math.floor(rand() * 4);

    const items = [];
    const add = (count, type) => {
      for (let i = 0; i < count; i++) {
        const left = `${Math.round(rand() * 100)}%`;
        const top = `${Math.round(rand() * 85)}%`;

        const scale =
          type === "star" ? 0.6 + rand() * 0.9 : 0.75 + rand() * 0.7;
        const rotate = (rand() * 30 - 15).toFixed(1);
        const opacity = (0.18 + rand() * 0.32).toFixed(2);

        items.push({
          id: `${type}-${i}`,
          type,
          src: type === "star" ? star : flight,
          style: {
            left,
            top,
            opacity,
            transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotate}deg)`,
          },
        });
      }
    };

    add(starsCount, "star");
    add(flightsCount, "flight");
    return items;
  }, []);

  // layout 2 sloupců
  const twoCol = {
    display: "grid",
    gridTemplateColumns: "1fr 360px",
    gap: 14,
    alignItems: "start",
  };

  const sticky = {
    position: "sticky",
    top: 14,
    alignSelf: "start",
    display: "grid",
    gap: 12,
  };

  const tabsRow = {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  };

  const tabLeft = {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  };

  // “paper” plocha pro output (markdown)
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

  const dbTeacherLabel = useMemo(() => {
    if (!dbTeacherVersionId) return "—";
    const it = getById(dbTeacherVersionId);
    if (!it) return "—";
    const n = getVersionNumber(dbTeacherVersionId);
    return `Verze ${n ?? "—"} — ${it.label} — ${formatTime(it.createdAt)}`;
  }, [dbTeacherVersionId, history]); // eslint-disable-line react-hooks/exhaustive-deps

  const dbStudentLabel = useMemo(() => {
    if (!dbStudentVersionId) return "—";
    const it = getById(dbStudentVersionId);
    if (!it) return "—";
    const n = getVersionNumber(dbStudentVersionId);
    return `Verze ${n ?? "—"} — ${it.label} — ${formatTime(it.createdAt)}`;
  }, [dbStudentVersionId, history]); // eslint-disable-line react-hooks/exhaustive-deps

  const noNotesYet =
    (tab === "teacher" && !hasDbTeacher && !activeTeacherVersionId) ||
    (tab === "student" && !hasDbStudent && !activeStudentVersionId);

  return (
    <div className="tcdPage">
      {/* decor */}
      <img className="tcdDec tcdClouds" src={clouds} alt="" aria-hidden="true" />
      {randomDecos.map((d) => (
        <img
          key={d.id}
          className={`tcdDec tcdRand ${
            d.type === "flight" ? "tcdRandFlight" : "tcdRandStar"
          }`}
          src={d.src}
          alt=""
          aria-hidden="true"
          style={d.style}
        />
      ))}
      <img className="tcdDec tcdLabs" src={labs} alt="" aria-hidden="true" />

      <div className="tcdWrap">
        {/* TOPBAR */}
        <div className="tcdTopbar">
          <img className="tcdLogo" src={logo} alt="GenAlpha" />
          <div className="tcdTopActions">
            <button className="tcdBtn pillDanger" onClick={logout}>
              ⟶ Odhlásit se
            </button>
          </div>
        </div>

        {/* HEADER */}
        <div className="tcdHeader">
          <div className="tcdHeaderLeft">
            <h1 className="tcdTitle">
              {classTitle || `Třída ${classId}`} –{" "}
              {topicTitle || `Kapitola ${topicId}`}
            </h1>

            <div style={tabsRow}>
              <div style={tabLeft}>
                <button
                  className={tab === "build" ? "tcdBtn primarySoft" : "tcdBtn ghost"}
                  type="button"
                  onClick={() => setTab("build")}
                >
                  ● Tvorba
                </button>

                <button
                  className={tab === "student" ? "tcdBtn primarySoft" : "tcdBtn ghost"}
                  type="button"
                  onClick={() => setTab("student")}
                  disabled={!hasAnyOutput && !hasDbStudent}
                  title={!hasAnyOutput && !hasDbStudent ? "Nejdřív vygeneruj výstup." : ""}
                >
                  👤 Student Notes
                </button>

                <button
                  className={tab === "teacher" ? "tcdBtn primarySoft" : "tcdBtn ghost"}
                  type="button"
                  onClick={() => setTab("teacher")}
                  disabled={!hasAnyOutput && !hasDbTeacher}
                  title={!hasAnyOutput && !hasDbTeacher ? "Nejdřív vygeneruj výstup." : ""}
                >
                  👨‍🏫 Teacher Notes
                </button>

                <button
                  className={tab === "quiz" ? "tcdBtn primarySoft" : "tcdBtn ghost"}
                  type="button"
                  onClick={() => setTab("quiz")}
                  disabled={!hasAnyOutput && !hasDbTeacher && !hasDbStudent}
                  title={
                    !hasAnyOutput && !hasDbTeacher && !hasDbStudent
                      ? "Nejdřív vygeneruj výstup."
                      : ""
                  }
                >
                  ❓ Quiz
                </button>
              </div>

              <button
                className="tcdBtn ghost"
                onClick={() => navigate(`/teacher/classes/${classId}`)}
              >
                ← Zpět
              </button>
            </div>
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
            {tab === "build" && history.length > 0 && (
              <div className="tcdCard">
                <div className="tcdCardHeader" style={{ alignItems: "center" }}>
                  <div className="tcdCardTitle">Historie verzí</div>
                  <button
                    className="tcdBtn pillDanger"
                    type="button"
                    onClick={clearHistory}
                  >
                    Smazat historii
                  </button>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  {history.map((h, idx) => (
                    <div
                      key={h.id}
                      className="tcdTopic"
                      style={{ cursor: "default" }}
                      onClick={(e) => e.preventDefault()}
                    >
                      <div className="tcdTopicLeft" style={{ alignItems: "flex-start" }}>
                        <div className="tcdBulb" aria-hidden="true">
                          🧾
                        </div>
                        <div>
                          <div className="tcdTopicTitle">
                            Verze {history.length - idx} — {h.label}
                          </div>
                          <div style={{ opacity: 0.7, fontSize: 13 }}>
                            {formatTime(h.createdAt)}
                          </div>
                        </div>
                      </div>

                      <div
                        className="tcdTopicActions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="tcdBtn pillDanger"
                          type="button"
                          onClick={() => deleteVersion(h.id)}
                        >
                          Smazat
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ opacity: 0.65, fontSize: 13, marginTop: 10 }}>
                  Pozn.: historie je jen v paměti stránky. Po refreshi se smaže.
                </div>
              </div>
            )}

            {/* TVORBA */}
            {tab === "build" && (
              <div className="tcdCard">
                <div className="tcdCardTitle" style={{ marginBottom: 6 }}>
                  Tvorba
                </div>
                <div className="tcdSubtitle" style={{ marginBottom: 16 }}>
                  Zde jen zadáš vstupy a spustíš generování.
                </div>

                <div style={{ fontWeight: 800, marginBottom: 6, color: "#1f2330" }}>
                  Délka hodiny (min):
                </div>
                <div className="tcdField" style={{ marginBottom: 14 }}>
                  <input
                    className="tcdInput"
                    type="number"
                    min={5}
                    max={240}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value || 45))}
                    style={{ maxWidth: 320 }}
                  />
                </div>

                <div style={{ fontWeight: 800, marginBottom: 6, color: "#1f2330" }}>
                  Text od učitele:
                </div>
                <div className="tcdField">
                  <textarea
                    className="tcdInput"
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="Vlož sem text (poznámky, osnovu, výtah z učebnice...)"
                    style={{
                      minHeight: 240,
                      resize: "vertical",
                      lineHeight: 1.45,
                      color: "#1f2330",
                    }}
                  />
                </div>
              </div>
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
                  <div className="tcdCardTitle">Teacher Notes</div>

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

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                  <button
                    className="tcdBtn primary"
                    type="button"
                    onClick={onSaveFinalQuiz}
                    disabled={quizSaveLoading || !activeQuizVersionId}
                  >
                    {quizSaveLoading ? "Ukládám…" : "⭐ Uložit kvíz jako finální do DB"}
                  </button>

                  {dbQuizVersionId && (
                    <div style={{ opacity: 0.75, fontSize: 13, alignSelf: "center" }}>
                      V DB je uložená verze: <b>{getQuizVersionNumber(dbQuizVersionId) ?? "—"}</b>
                    </div>
                  )}
                </div>
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

          {/* RIGHT */}
          <div style={sticky}>
            {/* BUILD: Akce + Přílohy */}
            {tab === "build" && (
              <>
                <div className="tcdCard">
                  <div className="tcdCardTitle" style={{ marginBottom: 10 }}>
                    Akce
                  </div>

                  <button
                    className="tcdBtn primary"
                    style={{ width: "100%" }}
                    onClick={onRun}
                    disabled={loading}
                  >
                    {loading ? "Generuji…" : "→ Spustit workflow"}
                  </button>

                  <div
                    style={{
                      opacity: 0.75,
                      fontSize: 13,
                      marginTop: 10,
                      lineHeight: 1.35,
                      color: "#1f2330",
                    }}
                  >
                    Po prvním úspěšném výstupu se učitelské i studentské poznámky
                    automaticky uloží do DB.
                  </div>
                </div>

                <div className="tcdCard">
                  <div className="tcdCardTitle" style={{ fontSize: 16, marginBottom: 10 }}>
                    Přílohy (max 3) — PDF / obrázky
                  </div>

                  <div
                    style={{
                      border: "2px dashed rgba(120, 120, 255, 0.35)",
                      borderRadius: 18,
                      padding: 14,
                      background: "rgba(255,255,255,0.55)",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        placeItems: "center",
                        height: 92,
                        borderRadius: 16,
                        background: "rgba(255,255,255,0.70)",
                        border: "1px solid rgba(0,0,0,0.06)",
                        marginBottom: 12,
                      }}
                      aria-hidden="true"
                    >
                      <div style={{ fontSize: 32 }}>🗂️</div>
                    </div>

                    <button
                      type="button"
                      className="tcdBtn primary"
                      style={{ width: "100%" }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      ＋ Přidat přílohu
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="application/pdf,image/*"
                      onChange={onFilesChange}
                      style={{ display: "none" }}
                    />

                    <div style={{ opacity: 0.7, fontSize: 13, marginTop: 8, color: "#1f2330" }}>
                      Podporované: PDF, PNG/JPG/WEBP.
                    </div>

                    {files.length > 0 && (
                      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                        {files.map((f, idx) => {
                          const icon = _isPdf(f) ? "📄" : _isImage(f) ? "🖼️" : "📎";
                          return (
                            <div
                              key={`${f.name}-${f.size}-${idx}`}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 10,
                                padding: "10px 12px",
                                borderRadius: 14,
                                background: "rgba(255,255,255,0.75)",
                                border: "1px solid rgba(0,0,0,0.08)",
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div
                                  style={{
                                    fontWeight: 800,
                                    color: "#1f2330",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    maxWidth: 230,
                                  }}
                                  title={f.name}
                                >
                                  {icon} {f.name}
                                </div>
                                <div style={{ opacity: 0.7, fontSize: 12 }}>
                                  {Math.round(f.size / 1024)} KB
                                </div>
                              </div>

                              <button
                                type="button"
                                className="tcdBtn pillDanger"
                                style={{ padding: "6px 10px" }}
                                onClick={() => removeFileAt(idx)}
                                title="Odebrat"
                              >
                                ✕
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

            {/* NOTES: finální + regen + info o DB */}
            {(tab === "teacher" || tab === "student") && (
              <>
                <div className="tcdCard">
                  <div className="tcdCardTitle" style={{ fontSize: 16, marginBottom: 10 }}>
                    Aktuálně uložené v DB
                  </div>

                  <div style={{ fontSize: 13, opacity: 0.85, color: "#1f2330", lineHeight: 1.35 }}>
                    <div>
                      <b>Teacher:</b> {dbTeacherLabel}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <b>Student:</b> {dbStudentLabel}
                    </div>
                  </div>
                </div>

                <div className="tcdCard">
                  <div className="tcdCardTitle" style={{ fontSize: 16, marginBottom: 10 }}>
                    Finální verze
                  </div>

                  <div style={{ opacity: 0.75, fontSize: 13, marginBottom: 10, color: "#1f2330" }}>
                    Uloží aktuálně vybranou verzi (a její úpravy) do DB jako finální.
                  </div>

                  <button
                    className="tcdBtn primary"
                    style={{ width: "100%" }}
                    onClick={() => saveFinalFromActive(tab === "teacher" ? "teacher" : "student")}
                    disabled={saveFinalLoading || noNotesYet}
                    title={noNotesYet ? "Nejdřív vygeneruj výstup v Tvorbě." : ""}
                  >
                    {saveFinalLoading ? "Ukládám…" : "⭐ Uložit jako finální do DB"}
                  </button>
                </div>

                <div className="tcdCard">
                  <div className="tcdCardTitle" style={{ fontSize: 16, marginBottom: 10 }}>
                    Upravit výstup poznámkou
                  </div>

                  <select
                    className="tcdInput"
                    value={regenTarget}
                    onChange={(e) => setRegenTarget(e.target.value)}
                    disabled={noNotesYet}
                  >
                    <option value="teacher">Učitel</option>
                    <option value="student">Student</option>
                    <option value="both">Oboje</option>
                  </select>

                  <textarea
                    className="tcdInput"
                    value={userNote}
                    onChange={(e) => setUserNote(e.target.value)}
                    disabled={noNotesYet}
                    placeholder='Např. "zjednoduš", "přidej víc příkladů", "udělej to interaktivní"...'
                    style={{
                      minHeight: 110,
                      resize: "vertical",
                      marginTop: 10,
                      color: "#1f2330",
                    }}
                    maxLength={2000}
                  />

                  <button
                    className="tcdBtn"
                    style={{ width: "100%", marginTop: 10 }}
                    onClick={onRegenerate}
                    disabled={regenLoading || !userNote.trim() || noNotesYet}
                    title={noNotesYet ? "Nejdřív vygeneruj výstup v Tvorbě." : ""}
                  >
                    {regenLoading ? "Regeneruji…" : "♻️ Přegenerovat"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
