export function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function range(n) {
  return Array.from({ length: n }, (_, i) => i);
}

// Display order of a fill-in table's rows and columns, randomized per showing.
// 1×n shuffles the columns and n×1 the rows. For n×m, a first row / first column
// with no blank cells is a header and stays in place; the rest are shuffled.
// Moving whole rows and columns keeps every cell with its row and column labels,
// and cells keep their original "row-col" keys, so grading is unaffected.
export function tableOrder(cells) {
  const rows = cells.length;
  const cols = cells[0]?.length ?? 0;
  if (rows === 1) return { rowOrder: [0], colOrder: shuffle(range(cols)) };
  if (cols === 1) return { rowOrder: shuffle(range(rows)), colOrder: [0] };
  const headerRow = cells[0].every((cell) => !cell.blank);
  const headerCol = cells.every((row) => !row[0].blank);
  return {
    rowOrder: headerRow ? [0, ...shuffle(range(rows).slice(1))] : shuffle(range(rows)),
    colOrder: headerCol ? [0, ...shuffle(range(cols).slice(1))] : shuffle(range(cols)),
  };
}
