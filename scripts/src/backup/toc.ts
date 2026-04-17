export function countTocEntries(tocListing: string): number {
  return tocListing.split("\n").filter((line) => /^\s*\d+;\s*\d+\s+\d+/.test(line)).length;
}
