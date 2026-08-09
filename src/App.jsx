import { NavLink, Route, Routes } from "react-router-dom";
import "./App.css";
import HomePage from "./pages/HomePage.jsx";
import QuizPage from "./pages/QuizPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import StatsPage from "./pages/StatsPage.jsx";

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">CCNA 学習アプリ</div>
        <nav className="app-nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            ホーム
          </NavLink>
          <NavLink to="/quiz" className={({ isActive }) => (isActive ? "active" : "")}>
            出題
          </NavLink>
          <NavLink to="/admin" className={({ isActive }) => (isActive ? "active" : "")}>
            問題管理
          </NavLink>
          <NavLink to="/stats" className={({ isActive }) => (isActive ? "active" : "")}>
            成績
          </NavLink>
        </nav>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/stats" element={<StatsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
