import { Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home.jsx";
import NewForm from "./pages/NewForm.jsx";
import Builder from "./pages/Builder.jsx";
import FillForm from "./pages/FillForm.jsx";
import Responses from "./pages/Responses.jsx";

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          📋 Form Builder
        </Link>
        <Link to="/new" className="btn primary">
          + New form
        </Link>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/new" element={<NewForm />} />
          <Route path="/build" element={<Builder />} />
          <Route path="/build/:id" element={<Builder />} />
          <Route path="/f/:id" element={<FillForm />} />
          <Route path="/forms/:id/responses" element={<Responses />} />
          <Route path="*" element={<p className="muted">Page not found.</p>} />
        </Routes>
      </main>
    </div>
  );
}
