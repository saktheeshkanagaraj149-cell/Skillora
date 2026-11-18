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
import { Compass, LogOut, Sprout } from 'lucide-react';
import './styles.css';

function Nav() {
  const { user, logout } = useAuth();
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="brand"><span className="brand-mark"><Sprout size={18} /></span> Skillora</Link>
        <nav>
          <NavLink to="/" end>Explore</NavLink>
          {user && <NavLink to="/dashboard">My learning</NavLink>}
          {user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
          {user ? (
            <button className="link with-icon" onClick={logout}><LogOut size={16} /> Log out</button>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <Link to="/register" className="btn small">Join free</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <span className="brand"><span className="brand-mark"><Sprout size={18} /></span> Skillora</span>
          <p>Free, step-by-step learning paths for every skill: engineering, tech, business, arts, languages and life skills.</p>
        </div>
        <div className="small muted">© {new Date().getFullYear()} Skillora · Made in India for learners everywhere</div>
      </div>
    </footer>
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
          <Route path="*" element={<div className="card empty"><Compass className="big-icon" size={44} aria-hidden /><h3>Page not found</h3><Link to="/" className="btn small">Go home</Link></div>} />
        </Routes>
      </main>
      <Footer />
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
