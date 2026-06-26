import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'requester' ? '/requests' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)',
      backgroundImage: 'radial-gradient(ellipse at 30% 20%, rgba(255,107,53,0.06) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(59,130,246,0.05) 0%, transparent 60%)',
    }}>
      <div style={{ width: '100%', maxWidth: 420, padding: '0 1rem' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'linear-gradient(135deg, var(--accent), #ff9f7a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
            boxShadow: '0 8px 32px rgba(255,107,53,0.3)',
          }}>
            <svg width="26" height="26" fill="white" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', marginBottom: '0.25rem' }}>
            3D Print Manager
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem' }}>Avocarbon — Tunisia Plant</p>
        </div>

        {/* Form */}
        <div className="card" style={{ border: '1px solid var(--border-light)' }}>
          <h2 style={{ marginBottom: '1.5rem', fontSize: '1rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
            Sign in to your account
          </h2>

          {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Email address</label>
              <input
                type="email" className="form-input"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@avocarbon.com" required autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password" className="form-input"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ marginTop: '0.5rem' }}>
              {loading ? <><span className="spinner" style={{ width: 16, height: 16 }}/> Signing in…</> : 'Sign In'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Default password: <code style={{ color: 'var(--accent)' }}>Admin123!</code>
        </p>
      </div>
    </div>
  );
}
