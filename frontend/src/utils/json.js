export function safeJsonStringify(obj) {
  return JSON.stringify(obj, null, 2);
}

export function safeParseJson(text) {
  return JSON.parse((text || "").trim());
}
