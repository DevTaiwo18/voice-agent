import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Dashboard.css";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/");
    setMenuOpen(false);
  };

  const sessionsRemaining = user?.sessionsLimit - user?.sessionsUsed || 0;

  return (
    <div className="dashboard">
      <nav className="dashboard-nav">
        <div className="container nav-container">
          <Link to="/" className="logo">
            <span className="logo-icon">🎛️</span>
            <span className="logo-text">MixCoach AI</span>
          </Link>

          <button
            className={`menu-toggle ${menuOpen ? 'active' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          <div className={`nav-right ${menuOpen ? 'open' : ''}`}>
            <span className="user-name">Hi, {user?.name}</span>
            <button onClick={handleLogout} className="btn btn-secondary btn-sm">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="dashboard-main">
        <div className="container">
          <header className="dashboard-header">
            <h1>Your Dashboard</h1>
            <Link to="/session" className="btn btn-primary">
              New Session
            </Link>
          </header>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">🎤</div>
              <div className="stat-content">
                <div className="stat-value">{user?.sessionsUsed || 0}</div>
                <div className="stat-label">Sessions Used</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <div className="stat-content">
                <div className="stat-value">{sessionsRemaining}</div>
                <div className="stat-label">Sessions Remaining</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">🎚️</div>
              <div className="stat-content">
                <div className="stat-value">{user?.daw || "Not set"}</div>
                <div className="stat-label">Your DAW</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">💎</div>
              <div className="stat-content">
                <div className="stat-value capitalize">{user?.plan || "Free"}</div>
                <div className="stat-label">Current Plan</div>
              </div>
            </div>
          </div>

          <section className="quick-start">
            <h2>Quick Start</h2>
            <div className="quick-start-grid">
              <Link to="/session" className="quick-card">
                <div className="quick-icon">🚀</div>
                <h3>Start New Session</h3>
                <p>Upload stems and get voice-guided mixing advice</p>
              </Link>

              <div className="quick-card disabled">
                <div className="quick-icon">📜</div>
                <h3>Session History</h3>
                <p>Review past sessions and advice (coming soon)</p>
              </div>

              <div className="quick-card disabled">
                <div className="quick-icon">⚙️</div>
                <h3>Settings</h3>
                <p>Update your profile and preferences (coming soon)</p>
              </div>
            </div>
          </section>

          {user?.plan === "free" && (
            <section className="upgrade-banner">
              <div className="upgrade-content">
                <h3>Upgrade to Pro</h3>
                <p>Get unlimited sessions, priority support, and advanced features</p>
              </div>
              <button className="btn btn-primary">Upgrade Now</button>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
