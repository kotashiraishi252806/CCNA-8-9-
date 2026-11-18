// Renders a fill-in-the-blank table in one of three modes:
// "input"   - blank cells are editable text inputs (quiz / practice, before submitting)
// "answers" - blank cells show the correct answer, read-only (after submitting)
// "result"  - blank cells show ⚪︎/× with the user's input and, if wrong, the correct answer
// "preview" - blank cells show a placeholder, read-only (admin question list)
// With `randomize`, rows/columns are shown in a random order (see tableOrder),
// fixed for as long as the component stays mounted. Keys stay the original "row-col".
import { useMemo } from "react";
import { tableOrder } from "../utils/shuffle.js";

export default function QuestionTable({ table, mode = "preview", values = {}, onChange, results, randomize = false }) {
  const { rowOrder, colOrder } = useMemo(
    () =>
      randomize
        ? tableOrder(table.cells)
        : { rowOrder: table.cells.map((_, i) => i), colOrder: (table.cells[0] ?? []).map((_, i) => i) },
    [table, randomize]
  );

  return (
    <table className="fill-table">
      <tbody>
        {rowOrder.map((r) => (
          <tr key={r}>
            {colOrder.map((c) => {
              const cell = table.cells[r][c];
              if (!cell.blank) {
                return (
                  <td className="fill-table-cell" key={c}>
                    {cell.text}
                  </td>
                );
              }

              const key = `${r}-${c}`;

              if (mode === "input") {
                return (
                  <td className="fill-table-cell fill-table-blank" key={c}>
                    <input
                      type="text"
                      className="fill-table-input mono"
                      value={values[key] ?? ""}
                      onChange={(e) => onChange?.(key, e.target.value)}
                    />
                  </td>
                );
              }

              if (mode === "result") {
                const r = results?.[key];
                const ok = r?.correct;
                return (
                  <td
                    className={`fill-table-cell fill-table-blank fill-table-result ${ok ? "correct" : "wrong"}`}
                    key={c}
                  >
                    <span className={`history-mark ${ok ? "correct" : "wrong"}`}>{ok ? "⚪︎" : "×"}</span>
                    {ok ? (
                      <span className="mono">{r.userValue}</span>
                    ) : (
                      <span className="fill-table-result-body">
                        <span className="mono fill-table-user">{r?.userValue || "(未入力)"}</span>
                        <span className="mono fill-table-expected">正解: {cell.answer}</span>
                      </span>
                    )}
                  </td>
                );
              }

              if (mode === "answers") {
                return (
                  <td className="fill-table-cell fill-table-blank fill-table-answer mono" key={c}>
                    {cell.answer}
                  </td>
                );
              }

              return (
                <td className="fill-table-cell fill-table-blank fill-table-placeholder" key={c}>
                  空欄
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
