export function formatTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("cs-CZ");
  } catch {
    return iso;
  }
}

export function getVersionNumberById(items, id) {
  if (!id) return null;
  const idx = items.findIndex((h) => h.id === id);
  if (idx === -1) return null;
  return items.length - idx;
}
