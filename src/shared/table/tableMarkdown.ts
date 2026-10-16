//ymjr -- Recognize Markdown tables without consuming ordinary clipboard text.
/** Parses escaped pipes and code spans; returns null unless the header delimiter is valid. */
export function parseMarkdownTable(source: string): string[][] | null {
  const lines = source
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim());
  if (lines.length < 2) return null;
  const split = (line: string): string[] => {
    const cells: string[] = [];
    let value = "",
      ticks = 0;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === "\\" && line[i + 1] === "|") {
        value += "|";
        i++;
        continue;
      }
      if (char === "`") {
        let n = 1;
        while (line[i + n] === "`") n++;
        if (ticks === 0) ticks = n;
        else if (ticks === n) ticks = 0;
        value += "`".repeat(n);
        i += n - 1;
        continue;
      }
      if (char === "|" && ticks === 0) {
        cells.push(value.trim());
        value = "";
      } else value += char;
    }
    cells.push(value.trim());
    if (line.startsWith("|")) cells.shift();
    if (line.endsWith("|") && !line.endsWith("\\|")) cells.pop();
    return cells;
  };
  const header = split(lines[0]),
    separator = split(lines[1]);
  if (
    header.length < 2 ||
    separator.length !== header.length ||
    !separator.every((cell) => /^:?-{3,}:?$/.test(cell))
  )
    return null;
  const rows = [header, ...lines.slice(2).filter(Boolean).map(split)];
  if (rows.some((row) => row.length !== header.length)) return null;
  return rows;
}
