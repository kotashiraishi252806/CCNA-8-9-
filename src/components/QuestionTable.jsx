// Renders a fill-in-the-blank table in one of three modes:
// "input"   - blank cells are editable text inputs (quiz / practice, before submitting)
// "answers" - blank cells show the correct answer, read-only (after submitting)
// "preview" - blank cells show a placeholder, read-only (admin question list)
export default function QuestionTable({ table, mode = "preview", values = {}, onChange }) {
  return (
    <table className="fill-table">
      <tbody>
        {table.cells.map((row, r) => (
          <tr key={r}>
            {row.map((cell, c) => {
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
