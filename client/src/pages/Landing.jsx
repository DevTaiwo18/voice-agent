import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Landing.css";

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="landing">
      <nav className="landing-nav">
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

          <div className={`nav-links ${menuOpen ? 'open' : ''}`}>
            {isAuthenticated ? (
              <Link to="/dashboard" className="btn btn-primary" onClick={() => setMenuOpen(false)}>
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="nav-link" onClick={() => setMenuOpen(false)}>
                  Login
                </Link>
                <Link to="/signup" className="btn btn-primary" onClick={() => setMenuOpen(false)}>
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="container hero-container">
          <div className="hero-content">
            <h1 className="hero-title">
              Your AI-Powered
              <span className="gradient-text"> Mixing Coach</span>
            </h1>
            <p className="hero-subtitle">
              Get real-time, voice-guided mixing advice. Upload your stems,
              describe what you want, and let AI translate your vision into
              professional mixing techniques.
            </p>
            <div className="hero-buttons">
              <Link
                to={isAuthenticated ? "/session" : "/signup"}
                className="btn btn-primary btn-large"
              >
                Start Mixing
              </Link>
              <a href="#features" className="btn btn-secondary btn-large">
                Learn More
              </a>
            </div>
          </div>

          <div className="hero-visual">
            <div className="orb-wrapper">
              <div className="orb animated"></div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="features">
        <div className="container">
          <h2 className="section-title">
            Why <span className="gradient-text">MixCoach AI</span>?
          </h2>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🎤</div>
              <h3>Voice-Guided</h3>
              <p>
                Talk naturally about your mix. Say "make it warmer" or "the
                vocals feel buried" and get instant, actionable advice.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Audio Analysis</h3>
              <p>
                Upload your stems and get detailed frequency, dynamics, and
                loudness analysis to identify issues instantly.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🎚️</div>
              <h3>DAW Instructions</h3>
              <p>
                Get step-by-step instructions tailored to your DAW. Works with
                Logic, Ableton, FL Studio, Pro Tools, and more.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">📝</div>
              <h3>Session History</h3>
              <p>
                Every coaching session is saved. Review past advice, track your
                progress, and build your mixing skills over time.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🎓</div>
              <h3>Beginner Friendly</h3>
              <p>
                Guided mode walks you through gain staging, EQ, compression, and
                more. Learn while you mix.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Real-Time</h3>
              <p>
                Instant voice responses powered by advanced AI. No waiting, no
                typing, just natural conversation.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="container">
          <div className="cta-content">
            <h2>Ready to level up your mixes?</h2>
            <p>
              Join thousands of producers getting professional mixing guidance.
            </p>
            <Link
              to={isAuthenticated ? "/session" : "/signup"}
              className="btn btn-primary btn-large"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer-container">
          <div className="footer-brand">
            <span className="logo-icon">🎛️</span>
            <span>MixCoach AI</span>
          </div>
          <p className="footer-copy">
            &copy; 2024 MixCoach AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
