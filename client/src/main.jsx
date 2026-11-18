import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, NavLink } from 'react-router-dom';
import { AuthProvider, RequireAuth, useAuth } from './auth.jsx';
import Home from './pages/Home.jsx';
import DomainPage from './pages/DomainPage.jsx';
import PathPage from './pages/PathPage.jsx';
import { Login, Register } from './pages/AuthPages.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Admin from './pages/Admin.jsx';
import './styles.css';

function Nav() {
  const { user, logout } = useAuth();
  return (
    <header className="nav">
      <Link to="/" className="brand">🌱 Skillora</Link>
      <nav>
        <NavLink to="/">Explore</NavLink>
        {user && <NavLink to="/dashboard">My learning</NavLink>}
        {user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
        {user ? (
          <button className="link" onClick={logout}>Log out</button>
        ) : (
          <>
            <NavLink to="/login">Log in</NavLink>
            <Link to="/register" className="btn small">Join free</Link>
          </>
        )}
      </nav>
    </header>
  );
}

function App() {
  return (
    <>
      <Nav />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/d/:slug" element={<DomainPage />} />
          <Route path="/p/:id" element={<PathPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth admin><Admin /></RequireAuth>} />
          <Route path="*" element={<p className="center muted">Page not found. <Link to="/">Go home</Link></p>} />
        </Routes>
      </main>
      <footer className="footer muted">Skillora · free learning paths for every skill</footer>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
