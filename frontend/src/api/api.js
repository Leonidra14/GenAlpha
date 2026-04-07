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

export async function getFinalQuiz(topicId) {
  return apiFetch(`/quiz/${topicId}`);
}

export async function saveFinalQuiz(topicId, quizJsonString) {
  return apiFetch(`/quiz/${topicId}/final`, {
    method: "PUT",
    body: JSON.stringify({ quiz_json: quizJsonString }),
  });
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
};

