import { useState, useEffect, useCallback } from "react";
import { Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { isLoggedIn, setToken, getMe } from "./api.js";
import Home from "./pages/Home.jsx";
import NewForm from "./pages/NewForm.jsx";
import Builder from "./pages/Builder.jsx";
import FillForm from "./pages/FillForm.jsx";
import Responses from "./pages/Responses.jsx";
import Login from "./pages/Login.jsx";

function ProtectedRoute({ user, children }) {
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  const handleLogout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) {
      setChecking(false);
      return;
    }
    getMe()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    window.addEventListener("fb:logout", handleLogout);
    return () => window.removeEventListener("fb:logout", handleLogout);
  }, [handleLogout]);

  if (checking) return null;

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">Form Builder</Link>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {user && (
            <>
              <Link to="/new" className="btn primary">+ New form</Link>
              <span className="muted" style={{ fontSize: "0.85rem" }}>{user.email}</span>
              <button className="btn" onClick={handleLogout}>Sign out</button>
            </>
          )}
          {!user && <Link to="/login" className="btn primary">Sign in</Link>}
        </div>
      </header>

      <main className="content">
        <Routes>
          <Route path="/login" element={
            user ? <Navigate to="/" replace /> : <Login onLogin={setUser} />
          } />
          <Route path="/" element={
            <ProtectedRoute user={user}><Home /></ProtectedRoute>
          } />
          <Route path="/new" element={
            <ProtectedRoute user={user}><NewForm /></ProtectedRoute>
          } />
          <Route path="/build" element={
            <ProtectedRoute user={user}><Builder /></ProtectedRoute>
          } />
          <Route path="/build/:id" element={
            <ProtectedRoute user={user}><Builder /></ProtectedRoute>
          } />
          <Route path="/forms/:id/responses" element={
            <ProtectedRoute user={user}><Responses /></ProtectedRoute>
          } />
          {/* Public: fill a form */}
          <Route path="/f/:id" element={<FillForm />} />
          <Route path="*" element={<p className="muted">Page not found.</p>} />
        </Routes>
      </main>
    </div>
  );
}
