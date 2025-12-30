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

