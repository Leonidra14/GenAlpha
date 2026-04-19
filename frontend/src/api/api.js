/**
 * Typed-ish API wrappers: paths mirror backend routers (/classes, /quiz, …).
 */
import { apiFetch } from "./client";


// ===== CLASSES =====
export function getTeacherClasses() {
  return apiFetch("/classes/me");
}

export function updateClass(classId, payload) {
  return apiFetch(`/classes/${classId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function getClassDetail(classId) {
  return apiFetch(`/classes/${classId}`);
}

// ===== CHAPTERS =====
export function getClassTopics(classId) {
  return apiFetch(`/classes/${classId}/topics`);
}

export function createTopic(classId, payload) {
  return apiFetch(`/classes/${classId}/topics`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateTopic(classId, topicId, payload) {
  return apiFetch(`/classes/${classId}/topics/${topicId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteTopic(classId, topicId) {
  return apiFetch(`/classes/${classId}/topics/${topicId}`, {
    method: "DELETE",
  });
}

// ===== STUDENT/ENROLLMENTS =====
export function getClassStudents(classId) {
  return apiFetch(`/classes/${classId}/students`);
}

export function addExistingStudent(classId, studentId) {
  return apiFetch(`/classes/${classId}/students/${studentId}`, { method: "POST" });
}

export function createAndEnrollStudent(classId, payload) {
  return apiFetch(`/classes/${classId}/students`, { method: "POST", body: JSON.stringify(payload) });
}

export function removeStudent(classId, studentId) {
  return apiFetch(`/classes/${classId}/students/${studentId}`, { method: "DELETE" });
}

export function setStudentPassword(classId, studentId, payload) {
  return apiFetch(`/classes/${classId}/students/${studentId}/password`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function getAvailableStudents(classId, q = "") {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return apiFetch(`/classes/${classId}/students/available${qs}`);
}

export function createClass(payload) {
  return apiFetch(`/classes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function generateTopicNotes(classId, topicId, { duration_minutes, raw_text }) {
  return apiFetch(`/classes/${classId}/topics/${topicId}/generate-notes`, {
    method: "POST",
    body: JSON.stringify({ duration_minutes, raw_text }),
  });
}

export function generateNotesWithFiles(classId, topicId, { duration_minutes, raw_text, files }) {
  const fd = new FormData();
  fd.append("duration_minutes", String(duration_minutes ?? 45));
  fd.append("raw_text", raw_text ?? "");
  (files || []).forEach((f) => fd.append("files", f));

  return apiFetch(`/classes/${classId}/topics/${topicId}/generate-notes`, {
    method: "POST",
    body: fd,
  });
}

export function regenerateNotes(classId, topicId, payload) {
  return apiFetch(`/classes/${classId}/topics/${topicId}/regenerate-notes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function saveFinalTeacherNotes(classId, topicId, teacher_notes_md) {
  return apiFetch(`/classes/${classId}/topics/${topicId}/final-notes`, {
    method: "PATCH",
    body: JSON.stringify({ teacher_notes_md }),
  });
}

export function saveFinalStudentNotes(classId, topicId, student_notes_md) {
  return apiFetch(`/classes/${classId}/topics/${topicId}/final-notes`, {
    method: "PATCH",
    body: JSON.stringify({ student_notes_md }),
  });
}


export function importTopic(classId, sourceTopicId) {
  return apiFetch(`/classes/${classId}/topics/import`, {
    method: "POST",
    body: JSON.stringify({ source_topic_id: sourceTopicId }),
  });
}


export function getFinalNotes(classId, topicId) {
  return apiFetch(`/classes/${classId}/topics/${topicId}/final-notes`, {
    method: "GET",
  });
}


// ===== STUDENT VIEW =====
export function getStudentClasses() {
  return apiFetch("/classes/student/classes");
}

export function getStudentClassDetail(classId) {
  return apiFetch(`/classes/student/classes/${classId}`);
}

export function getStudentClassTopics(classId) {
  return apiFetch(`/classes/student/classes/${classId}/topics`);
}

export function getStudentTopicDetail(classId, topicId) {
  return apiFetch(`/classes/student/classes/${classId}/topics/${topicId}`);
}

export function getStudentTopicMainQuizLeaderboard(classId, topicId) {
  return apiFetch(`/classes/student/classes/${classId}/topics/${topicId}/main-quiz-leaderboard`);
}

export function setStudentTopicDone(topicId, done) {
  return apiFetch(`/classes/student/topics/${topicId}/progress`, {
    method: "PUT",
    body: JSON.stringify({ done }),
  });
}

// --- QUIZ API ---
export async function generateQuiz(classId, topicId, { mcq, yesno, final_open }) {
  return apiFetch(`/quiz/generate/${classId}/${topicId}`, {
    method: "POST",
    body: JSON.stringify({ mcq, yesno, final_open }),
  });
}

export async function getFinalQuiz(classId, topicId) {
  return apiFetch(`/quiz/${classId}/${topicId}`);
}

export function getTeacherTopicQuizStats(classId, topicId) {
  return apiFetch(`/quiz/${classId}/${topicId}/teacher-stats`);
}

function buildTeacherClassStatsQuery(params = {}) {
  const q = new URLSearchParams();
  if (params.topicId != null && params.topicId !== "") {
    q.set("topic_id", String(params.topicId));
  }
  if (params.riskThresholdPercent != null && params.riskThresholdPercent !== "") {
    q.set("risk_threshold_percent", String(params.riskThresholdPercent));
  }
  if (params.periodDays != null && params.periodDays !== "") {
    q.set("period_days", String(params.periodDays));
  }
  if (params.thresholdPercent != null && params.thresholdPercent !== "") {
    q.set("threshold_percent", String(params.thresholdPercent));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function getTeacherClassStatsOverview(classId, { topicId, riskThresholdPercent } = {}) {
  return apiFetch(
    `/quiz/${classId}/stats/overview${buildTeacherClassStatsQuery({ topicId, riskThresholdPercent })}`
  );
}

export function getTeacherClassStatsTrend(classId, { topicId, periodDays } = {}) {
  return apiFetch(
    `/quiz/${classId}/stats/trend${buildTeacherClassStatsQuery({ topicId, periodDays })}`
  );
}

export function getTeacherClassTopicStats(classId, { topicId } = {}) {
  return apiFetch(`/quiz/${classId}/stats/topics${buildTeacherClassStatsQuery({ topicId })}`);
}

export function getTeacherClassRiskStudents(classId, { topicId, thresholdPercent } = {}) {
  return apiFetch(
    `/quiz/${classId}/stats/risk-students${buildTeacherClassStatsQuery({ topicId, thresholdPercent })}`
  );
}

export function regenerateTeacherClassRiskStudents(classId, { topicId, thresholdPercent } = {}) {
  return apiFetch(
    `/quiz/${classId}/stats/risk-students/regenerate${buildTeacherClassStatsQuery({
      topicId,
      thresholdPercent,
    })}`,
    { method: "POST" }
  );
}

export function getTeacherClassStudentStatsDetail(classId, studentId, { topicId } = {}) {
  return apiFetch(
    `/quiz/${classId}/stats/students/${studentId}/detail${buildTeacherClassStatsQuery({ topicId })}`
  );
}

export function getTeacherStudentQuizAttemptDetail(classId, topicId, studentId, attemptId) {
  return apiFetch(
    `/quiz/${classId}/${topicId}/teacher-stats/students/${studentId}/attempts/${attemptId}`
  );
}

export async function saveFinalQuiz(classId, topicId, quizJsonString) {
  return apiFetch(`/quiz/${classId}/${topicId}/final`, {
    method: "PUT",
    body: JSON.stringify({ quiz_json: quizJsonString }),
  });
}

export async function regenerateQuiz(classId, topicId, { quiz_json, user_note }) {
  return apiFetch(`/quiz/${classId}/${topicId}/regenerate`, {
    method: "POST",
    body: JSON.stringify({ quiz_json, user_note }),
  });
}

export function startStudentQuiz(classId, topicId) {
  return apiFetch(`/quiz/${classId}/${topicId}/start`, { method: "POST" });
}

export function startStudentBonusQuiz(classId, topicId) {
  return apiFetch(`/quiz/${classId}/${topicId}/bonus/start`, { method: "POST" });
}

export function submitStudentQuizAnswer(classId, topicId, attemptId, { question_id, answer }) {
  return apiFetch(`/quiz/${classId}/${topicId}/attempts/${attemptId}/answer`, {
    method: "POST",
    body: JSON.stringify({ question_id, answer }),
  });
}

export function finishStudentQuiz(classId, topicId, attemptId) {
  return apiFetch(`/quiz/${classId}/${topicId}/attempts/${attemptId}/finish`, {
    method: "POST",
  });
}

export function listStudentQuizAttempts(classId, topicId) {
  return apiFetch(`/quiz/${classId}/${topicId}/my-attempts`);
}

export function getStudentQuizAttemptDetail(classId, topicId, attemptId) {
  return apiFetch(`/quiz/${classId}/${topicId}/my-attempts/${attemptId}`);
}

export async function fetchTopicHeader(classId, topicId) {
  const [cls, topics] = await Promise.all([getClassDetail(classId), getClassTopics(classId)]);
  const clsLabel =
    (cls?.custom_name || "").trim() ||
    (cls?.grade != null && cls?.subject ? `${cls.grade}. třída – ${cls.subject}` : "") ||
    cls?.subject ||
    `Třída ${classId}`;
  const topic = (topics || []).find((x) => String(x.id) === String(topicId));
  const topicLabel = (topic?.title || "").trim() || `Kapitola ${topicId}`;
  return { classDetail: cls || null, classTitle: clsLabel, topicTitle: topicLabel };
}

export const topicNotesApi = {
  generateNotesWithFiles,
  regenerateNotes,
  saveFinalTeacherNotes,
  saveFinalStudentNotes,
  getFinalNotes,
};

export const topicQuizApi = {
  generateQuiz,
  getFinalQuiz,
  saveFinalQuiz,
  regenerateQuiz,
  startStudentQuiz,
  startStudentBonusQuiz,
  submitStudentQuizAnswer,
  finishStudentQuiz,
  listStudentQuizAttempts,
  getStudentQuizAttemptDetail,
  getTeacherTopicQuizStats,
  getTeacherStudentQuizAttemptDetail,
};

