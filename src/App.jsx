import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import "./App.css";
import HomePage from "./pages/HomePage.jsx";
import QuizPage from "./pages/QuizPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import StatsPage from "./pages/StatsPage.jsx";
import LearningRecordPage from "./pages/LearningRecordPage.jsx";
import NetLabPage from "./pages/NetLabPage.jsx";
import NetLabWorkspacePage from "./pages/NetLabWorkspacePage.jsx";

function App() {
  const wide = useLocation().pathname.startsWith("/netlab/");
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
          <NavLink to="/records" className={({ isActive }) => (isActive ? "active" : "")}>
            学習記録
          </NavLink>
          <NavLink to="/netlab" className={({ isActive }) => (isActive ? "active" : "")}>
            ネットワーク演習
          </NavLink>
        </nav>
      </header>

      <main className={wide ? "app-main wide" : "app-main"}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/records" element={<LearningRecordPage />} />
          <Route path="/netlab" element={<NetLabPage />} />
          <Route path="/netlab/:id" element={<NetLabWorkspacePage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
