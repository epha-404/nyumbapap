export function formatLocationLabel(...parts: Array<string | null | undefined>) {
  const seen = new Set<string>();
  return parts.flatMap(part => {
    if (!part?.trim()) return [];
    const value = part.trim().replace(/\s+/g, " ");
    const key = value.toLocaleLowerCase("en-KE");
    if (seen.has(key)) return [];
    seen.add(key);
    return [value];
  }).join(", ");
}
