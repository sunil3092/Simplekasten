// Pure, I/O-free line diff — no FileSystemAdapter needed, so both apps can
// call it directly (desktop's renderer included) without an IPC round trip.
// Classic LCS-based line diff: more than adequate for note-sized text, and
// it keeps the implementation to a couple dozen lines with no dependency.

export type DiffOp = "equal" | "insert" | "delete";

export interface DiffLine {
  op: DiffOp;
  text: string;
}

export function diffLines(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.length > 0 ? oldText.split("\n") : [];
  const newLines = newText.length > 0 ? newText.split("\n") : [];
  const m = oldLines.length;
  const n = newLines.length;

  // lcs[i][j] = length of the longest common subsequence of oldLines[i:] and newLines[j:].
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      lcs[i][j] = oldLines[i] === newLines[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      result.push({ op: "equal", text: oldLines[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      result.push({ op: "delete", text: oldLines[i] });
      i++;
    } else {
      result.push({ op: "insert", text: newLines[j] });
      j++;
    }
  }
  while (i < m) result.push({ op: "delete", text: oldLines[i++] });
  while (j < n) result.push({ op: "insert", text: newLines[j++] });

  return result;
}
