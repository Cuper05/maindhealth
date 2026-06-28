export function parseDetailList(value: string): string[] {
  const items = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return items.length > 0 ? items : [""];
}

export function joinDetailList(items: string[]): string {
  return items.map((item) => item.trim()).filter(Boolean).join("\n");
}

export function formatDetailListForDisplay(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  const items = parseDetailList(value).filter(Boolean);
  return items.length > 0 ? items.join(" · ") : "—";
}
