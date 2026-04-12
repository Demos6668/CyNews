/**
 * Split a string into alternating plain / matched segments for search-term highlighting.
 * Returns an array of {text, highlight} pairs. Safe for React rendering via .map().
 *
 * Example:
 *   highlightMatch("CVE-2024-1234 is critical", "critical")
 *   → [{text:"CVE-2024-1234 is ", highlight:false}, {text:"critical", highlight:true}]
 */
export interface MatchSegment {
  text: string;
  highlight: boolean;
}

export function highlightMatch(text: string, query: string): MatchSegment[] {
  if (!text || !query.trim()) {
    return [{ text: text ?? "", highlight: false }];
  }

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);

  return parts
    .filter((p) => p.length > 0)
    .map((part) => {
      regex.lastIndex = 0;
      return { text: part, highlight: regex.test(part) };
    });
}
