import { apiFetch } from "./client";


// ===== TŘÍDY =====
export function getTeacherClasses() {
  return apiFetch("/classes/me");
}

export function getClassDetail(classId) {
  return apiFetch(`/classes/${classId}`);
}

// ===== TOPICS / KAPITOLY =====
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