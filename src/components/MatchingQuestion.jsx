import { useMemo } from "react";
import { matchingChoices } from "../utils/storage.js";
import { shuffle } from "../utils/shuffle.js";

// Renders a matching question in one of four modes:
// "input"   - each answer cell is a select of that column's (shuffled) choices
// "result"  - each answer cell shows ⚪︎/× with the user's choice and, if wrong, the correct one
// "answers" - each answer cell shows the correct item, read-only
// "preview" - left items and each column's choices, without answers
// `results` maps "row-col" keys to the cell results from checkMatching().
// With `randomize`, the rows are shown in a random order too. Both orders are fixed
// for as long as the component stays mounted; keys stay the original "row-col".
export default function MatchingQuestion({ matching, mode = "preview", values = {}, onChange, results, randomize = false }) {
  const columns = matching.rows[0]?.answers.length ?? 1;
  // Shuffled once per question so the choice order doesn't give away the answers.
  const choices = useMemo(
    () => Array.from({ length: columns }, (_, c) => shuffle(matchingChoices(matching, c))),
    [matching, columns]
  );
  const rowOrder = useMemo(
    () => (randomize ? shuffle(matching.rows.map((_, i) => i)) : matching.rows.map((_, i) => i)),
    [matching, randomize]
  );
  const hasHeaders = matching.headers.some(Boolean);

  function columnLabel(c) {
    return matching.headers[c + 1] || (columns > 1 ? `列${c + 1}` : "");
  }

  function renderAnswerCell(row, r, c) {
    const key = `${r}-${c}`;
    const expected = row.answers[c];

    if (mode === "input") {
      return (
        <td className="fill-table-cell fill-table-blank" key={c}>
          <select value={values[key] ?? ""} onChange={(e) => onChange?.(key, e.target.value)}>
            <option value="">選択してください</option>
            {choices[c].map((choice) => (
              <option key={choice} value={choice}>
                {choice}
              </option>
            ))}
          </select>
        </td>
      );
    }

    if (mode === "result") {
      const res = results?.[key];
      const ok = res?.correct;
      return (
        <td className={`fill-table-cell fill-table-blank fill-table-result ${ok ? "correct" : "wrong"}`} key={c}>
          <span className={`history-mark ${ok ? "correct" : "wrong"}`}>{ok ? "⚪︎" : "×"}</span>
          {ok ? (
            <span>{res.userValue}</span>
          ) : (
            <span className="fill-table-result-body">
              <span className="fill-table-user">{res?.userValue || "(未選択)"}</span>
              <span className="fill-table-expected">正解: {expected}</span>
            </span>
          )}
        </td>
      );
    }

    if (mode === "answers") {
      return (
        <td className="fill-table-cell fill-table-blank fill-table-answer" key={c}>
          {expected}
        </td>
      );
    }

    return (
      <td className="fill-table-cell fill-table-blank fill-table-placeholder" key={c}>
        ?
      </td>
    );
  }

  return (
    <div className="matching">
      {(mode === "input" || mode === "preview") &&
        choices.map((list, c) => (
          <div className="matching-choices" key={c}>
            <span className="muted">選択肢{columnLabel(c) && `（${columnLabel(c)}）`}:</span>
            {list.map((choice) => (
              <span className="matching-choice" key={choice}>
                {choice}
              </span>
            ))}
          </div>
        ))}
      <div style={{ overflowX: "auto" }}>
        <table className="fill-table matching-table">
          {hasHeaders && (
            <thead>
              <tr>
                <th className="fill-table-cell">{matching.headers[0]}</th>
                {Array.from({ length: columns }, (_, c) => (
                  <th className="fill-table-cell" key={c}>
                    {matching.headers[c + 1]}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {rowOrder.map((r) => matching.rows[r]).map((row, i) => (
              <tr key={rowOrder[i]}>
                <td className="fill-table-cell matching-left">{row.left}</td>
                {row.answers.map((_, c) => renderAnswerCell(row, rowOrder[i], c))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
