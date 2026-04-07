export const ALLOWED_UPLOAD_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export function isPdfFile(file) {
  return (
    (file?.type || "").toLowerCase() === "application/pdf" ||
    (file?.name || "").toLowerCase().endsWith(".pdf")
  );
}

export function isImageFile(file) {
  const t = (file?.type || "").toLowerCase();
  return (
    t.startsWith("image/") ||
    (file?.name || "").toLowerCase().endsWith(".png") ||
    (file?.name || "").toLowerCase().endsWith(".jpg") ||
    (file?.name || "").toLowerCase().endsWith(".jpeg") ||
    (file?.name || "").toLowerCase().endsWith(".webp")
  );
}
