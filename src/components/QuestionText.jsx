import { parseQuestionText } from "../utils/questionText.js";

export default function QuestionText({ text, className = "" }) {
  const blocks = parseQuestionText(text);
  return (
    <div className={`question-body ${className}`.trim()}>
      {blocks.map((block, i) => {
        if (block.type === "h1") {
          return (
            <h3 className="question-h1" key={i}>
              {block.text}
            </h3>
          );
        }
        if (block.type === "h2") {
          return (
            <h4 className="question-h2" key={i}>
              {block.text}
            </h4>
          );
        }
        if (block.type === "list") {
          return (
            <ul className="question-list" key={i}>
              {block.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          );
        }
        return (
          <p className="question-p" key={i}>
            {block.lines.map((line, j) => (
              <span key={j}>
                {line}
                {j < block.lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
