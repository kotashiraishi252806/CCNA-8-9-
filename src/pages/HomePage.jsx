import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { loadQuestions, getCategories } from "../utils/storage.js";

export default function HomePage() {
  const [questionCount, setQuestionCount] = useState(0);
  const [categoryCount, setCategoryCount] = useState(0);

  useEffect(() => {
    setQuestionCount(loadQuestions().length);
    setCategoryCount(getCategories().length);
  }, []);

  return (
    <div>
      <h1>CCNA 学習アプリ</h1>
      <p className="muted">
        自分で作成した問題に記述式で回答し、正誤をその場で確認しながら学習を進めます。
      </p>

      <div className="stat-grid" style={{ marginTop: 24 }}>
        <div className="stat-tile">
          <div className="value">{questionCount}</div>
          <div className="label">登録済み問題数</div>
        </div>
        <div className="stat-tile">
          <div className="value">{categoryCount}</div>
          <div className="label">カテゴリ数</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h3>はじめに</h3>
        <p className="muted">
          「問題管理」からCCNAの問題を追加し、「出題」で学習しましょう。「成績」で正答率や間違えた問題を確認できます。
        </p>
        <div className="question-actions">
          <Link to="/admin" className="btn btn-primary">問題を追加する</Link>
          <Link to="/quiz" className="btn">出題を始める</Link>
        </div>
      </div>
    </div>
  );
}
