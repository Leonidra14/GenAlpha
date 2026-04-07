export function stripOuterCodeFence(md) {
  const s = (md ?? "").trim();
  if (!s.startsWith("```")) return md ?? "";
  const lines = s.split("\n");
  if (lines.length < 3) return md ?? "";

  const first = lines[0].trim();
  const last = lines[lines.length - 1].trim();
  if (!first.startsWith("```") || last !== "```") return md ?? "";

  return lines.slice(1, -1).join("\n").trim();
}

export function normalizeMd(md) {
  return stripOuterCodeFence(md ?? "").trim();
}
