import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const API = 'http://localhost:5000/api';

async function apiRequest(path, options = {}, token = '') {
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Something went wrong.');
  return data;
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('resumeBuddyToken') || '');
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('home');
  const [authMode, setAuthMode] = useState('login');
  const [analyses, setAnalyses] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [currentResume, setCurrentResume] = useState(null);
  const [builderPrompt, setBuilderPrompt] = useState('');
  const [builderTitle, setBuilderTitle] = useState('My resume draft');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadAccount(activeToken = token) {
    const [me, history, savedResumes] = await Promise.all([
      apiRequest('/me', {}, activeToken),
      apiRequest('/analyses', {}, activeToken),
      apiRequest('/resumes', {}, activeToken)
    ]);
    setUser(me.user);
    setAnalyses(history.analyses);
    setResumes(savedResumes.resumes || []);
  }

  useEffect(() => {
    if (!token) return;
    loadAccount(token).catch(() => {
      localStorage.removeItem('resumeBuddyToken');
      setToken('');
      setUser(null);
    });
  }, []);

  function clearMessages() { setError(''); setMessage(''); }

  async function handleAuth(event) {
    event.preventDefault(); clearMessages(); setLoading(true);
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      const endpoint = authMode === 'register' ? '/auth/register' : '/auth/login';
      const data = await apiRequest(endpoint, { method: 'POST', body: JSON.stringify(body) });
      localStorage.setItem('resumeBuddyToken', data.token);
      setToken(data.token); setUser(data.user); setPage('dashboard');
      setMessage(authMode === 'register' ? 'Your account has been created.' : 'Welcome back!');
      await loadAccount(data.token);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleAnalyze(event) {
    event.preventDefault(); clearMessages(); setLoading(true); setSelected(null);
    const form = new FormData(event.currentTarget);
    try {
      const data = await apiRequest('/analyze', { method: 'POST', body: form }, token);
      setSelected(data.analysis); setPage('result');
      const history = await apiRequest('/analyses', {}, token);
      setAnalyses(history.analyses);
      setMessage('Analysis saved to your account.');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function openAnalysis(id) {
    clearMessages(); setLoading(true);
    try {
      const data = await apiRequest(`/analyses/${id}`, {}, token);
      setSelected(data.analysis); setPage('result');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  function logout() {
    localStorage.removeItem('resumeBuddyToken'); setToken(''); setUser(null); setAnalyses([]); setSelected(null); setPage('home'); clearMessages();
  }

  function go(nextPage) { clearMessages(); setPage(nextPage); setSelected(null); }

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => go(user ? 'dashboard' : 'home')} aria-label="Resume Buddy home"><span className="brand-icon">R</span><span>resume<span className="brand-light">buddy</span></span></button>
      <nav>
        {user ? <>
          <button className={page === 'dashboard' ? 'nav-active' : ''} onClick={() => go('dashboard')}>Dashboard</button>
          <button className={page === 'analyze' ? 'nav-active' : ''} onClick={() => go('analyze')}>Analyze</button>
          <button className={page === 'resume-builder' ? 'nav-active' : ''} onClick={() => { setCurrentResume(null); go('resume-builder'); }}>Build resume</button>
          <button className={page === 'history' || page === 'my-resumes' ? 'nav-active' : ''} onClick={() => go('history')}>History</button>
          <button className="profile-chip" onClick={() => go('profile')}>{user.name?.slice(0, 1).toUpperCase()}</button>
          <button className="signout" onClick={logout}>Sign out</button>
        </> : <>
          <button onClick={() => { setAuthMode('login'); go('auth'); }}>Sign in</button>
          <button className="button button-small" onClick={() => { setAuthMode('register'); go('auth'); }}>Create account</button>
        </>}
      </nav>
    </header>

    <main className="main-content">
      {error && <div className="notice notice-error" role="status">{error}<button onClick={() => setError('')} aria-label="Dismiss">×</button></div>}
      {message && <div className="notice notice-success" role="status">{message}<button onClick={() => setMessage('')} aria-label="Dismiss">×</button></div>}

      {page === 'home' && <section className="hero">
        <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot"></span> A simple tool for your next step</div><h1>Make your resume<br /><span>work harder for you.</span></h1><p>Compare your resume with a job description, spot important keywords, and keep your results saved in one place.</p><div className="hero-actions"><button className="button" onClick={() => { setAuthMode('register'); go('auth'); }}>Get started — it’s free <span>→</span></button><button className="text-button" onClick={() => { setAuthMode('login'); go('auth'); }}>I already have an account</button></div><div className="trust-line"><span>✓</span> No payment details · Your own saved history</div></div>
        <div className="preview-card"><div className="preview-top"><div><span className="preview-kicker">RESUME CHECK</span><h3>Frontend Developer</h3></div><span className="preview-badge">Sample</span></div><div className="score-row"><div className="score-circle"><strong>76</strong><small>/100</small></div><div><strong>Good starting point</strong><p>Some useful keywords are already present.</p></div></div><div className="preview-divider"></div><p className="mini-label">KEYWORDS FOUND</p><div className="tag-list"><span>JavaScript</span><span>React</span><span>CSS</span><span>Git</span></div><p className="mini-label missing-label">KEYWORDS TO CHECK</p><div className="tag-list muted-tags"><span>Testing</span><span>Accessibility</span></div><div className="preview-foot">Example only · Results depend on the job description</div></div>
        <div className="hero-orb orb-one"></div><div className="hero-orb orb-two"></div>
      </section>}

      {page === 'auth' && <section className="auth-layout"><div className="auth-side"><span className="auth-mark">✦</span><h2>A clearer next step starts here.</h2><p>Create an account to save resume checks and come back to them whenever you need.</p><ul><li>✓ Your personal analysis history</li><li>✓ Simple keyword comparison</li><li>✓ No payment or subscription</li></ul></div><form className="form-card auth-card" onSubmit={handleAuth}><span className="section-kicker">YOUR ACCOUNT</span><h1>{authMode === 'register' ? 'Create your account' : 'Welcome back'}</h1><p className="subtext">{authMode === 'register' ? 'It only takes a minute.' : 'Sign in to see your saved analyses.'}</p>{authMode === 'register' && <label>Full name<input name="name" autoComplete="name" placeholder="e.g. Aditi Sharma" required minLength="2" /></label>}<label>Email address<input type="email" name="email" autoComplete="email" placeholder="you@example.com" required /></label><label>Password<input type="password" name="password" autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} placeholder={authMode === 'register' ? 'At least 8 characters' : 'Your password'} required minLength={authMode === 'register' ? 8 : undefined} /></label><button className="button full-button" disabled={loading}>{loading ? 'Please wait…' : authMode === 'register' ? 'Create account' : 'Sign in'} <span>→</span></button><p className="switch-auth">{authMode === 'register' ? 'Already have an account?' : 'New to Resume Buddy?'} <button type="button" onClick={() => { setAuthMode(authMode === 'register' ? 'login' : 'register'); clearMessages(); }}>{authMode === 'register' ? 'Sign in' : 'Create an account'}</button></p><p className="form-note">Your password is stored as a secure hash, not plain text.</p></form></section>}

      {page === 'dashboard' && user && <section className="page-wrap"><div className="page-heading"><div><span className="section-kicker">YOUR WORKSPACE</span><h1>Good to see you, {user.name.split(' ')[0]}.</h1><p>One small improvement can make your next application stronger.</p></div><div className="dashboard-actions"><button className="button button-outline" onClick={() => { setCurrentResume(null); go('resume-builder'); }}>✦ Build a resume</button><button className="button" onClick={() => go('analyze')}>＋ Analyze a resume</button></div></div><div className="stats-grid"><div className="stat-card"><span className="stat-icon lavender">▤</span><span className="stat-label">Saved analyses</span><strong>{analyses.length}</strong><small>All your past checks</small></div><div className="stat-card"><span className="stat-icon mint">✎</span><span className="stat-label">Saved resumes</span><strong>{resumes.length}</strong><small>Your editable resume drafts</small></div><div className="stat-card"><span className="stat-icon mint">↗</span><span className="stat-label">Average match</span><strong>{analyses.length ? Math.round(analyses.reduce((sum, item) => sum + item.score, 0) / analyses.length) + '%' : '—'}</strong><small>{analyses.length ? 'Across your saved checks' : 'Appears after your first check'}</small></div><div className="stat-card"><span className="stat-icon peach">✓</span><span className="stat-label">Account status</span><strong className="status-word">Ready</strong><small>Your history is saved locally</small></div></div><div className="section-row"><div><h2>Recent analyses</h2><p>Your latest resume checks, all in one place.</p></div>{analyses.length > 0 && <button className="text-button" onClick={() => go('history')}>View all →</button>}</div>{analyses.length ? <AnalysisList items={analyses.slice(0, 4)} onOpen={openAnalysis} /> : <div className="empty-state"><div className="empty-icon">▤</div><h3>Your first analysis starts here</h3><p>Upload a text-based PDF resume and compare it with the role you want.</p><button className="button" onClick={() => go('analyze')}>Analyze my resume <span>→</span></button></div>}</section>}

      {page === 'analyze' && user && <section className="page-wrap narrow-wrap"><button className="back-link" onClick={() => go('dashboard')}>← Back to dashboard</button><div className="page-heading single-heading"><div><span className="section-kicker">RESUME REVIEW</span><h1>Let’s check your resume.</h1><p>We compare words in your resume with the role details you provide.</p></div></div><form className="form-card analyze-card" onSubmit={handleAnalyze}><div className="step-heading"><span>01</span><div><h3>Add your resume</h3><p>Use a text-based PDF, up to 5 MB.</p></div></div><label className="upload-box"><span className="upload-icon">↑</span><strong>Choose your resume PDF</strong><span className="upload-hint">Click here to select a file from your computer</span><input type="file" name="resume" accept="application/pdf,.pdf" required /></label><div className="step-heading second-step"><span>02</span><div><h3>Tell us about the job</h3><p>A job description gives you a more useful comparison.</p></div></div><label>Job title<input name="jobRole" placeholder="e.g. Junior Frontend Developer" required /></label><label>Job description <span className="optional-label">Optional, but recommended</span><textarea name="jobDescription" rows="6" placeholder="Paste the job responsibilities and skills from the job listing…"></textarea></label><div className="privacy-note"><span>♧</span><p>Your analysis and extracted resume text are saved to your account so you can revisit the result later.</p></div><button className="button full-button" disabled={loading}>{loading ? 'Reading your resume…' : 'Analyze resume'} <span>→</span></button><p className="disclaimer">This is a basic keyword comparison tool, not an ATS score or a hiring decision.</p></form></section>}

      {page === 'resume-builder' && user && <section className="page-wrap narrow-wrap"><button className="back-link" onClick={() => go('dashboard')}>← Back to dashboard</button><div className="page-heading single-heading"><div><span className="section-kicker">PROMPT-BASED BUILDER</span><h1>Build your resume, simply.</h1><p>Describe your real background and target job. We'll turn it into an editable resume template.</p></div></div><div className="builder-grid"><form className="form-card builder-form" onSubmit={async event => { event.preventDefault(); clearMessages(); setLoading(true); try { const data = await apiRequest('/resumes/generate', { method: 'POST', body: JSON.stringify({ title: builderTitle, prompt: builderPrompt }) }, token); setCurrentResume(data.resume); setResumes(old => [data.resume, ...old.filter(item => item.id !== data.resume.id)]); setMessage(data.note || 'Draft created and saved.'); } catch (err) { setError(err.message); } finally { setLoading(false); } }}><label>Draft name<input value={builderTitle} onChange={event => setBuilderTitle(event.target.value)} maxLength="100" required /></label><label>Describe yourself and the job you want<textarea rows="9" value={builderPrompt} onChange={event => setBuilderPrompt(event.target.value)} placeholder="Example: I am a second-year Computer Science student applying for software development internships. I know C++, basic DSA, HTML, CSS and JavaScript. My project is a resume analyzer built with React and Node.js. I want to highlight problem-solving and teamwork." required minLength="20" /></label><div className="privacy-note"><span>✦</span><p>This beginner version uses a simple template and recognized skill words, not a paid AI service. It will not invent experience. Check every placeholder before using your resume.</p></div><button className="button full-button" disabled={loading || builderPrompt.trim().length < 20}>{loading ? 'Creating draft…' : 'Generate resume draft'} <span>→</span></button></form><div className="builder-help"><span className="section-kicker">PROMPT TIPS</span><h3>What to include</h3><ul><li>Your degree, college, and graduation year</li><li>Skills you actually know</li><li>Projects you have built</li><li>Internships or experience, if any</li><li>The job or internship you're applying for</li></ul><p>Do not include passwords, ID numbers, or other private information in your prompt.</p></div></div>{currentResume && <div className="form-card resume-editor"><div className="editor-heading"><div><span className="section-kicker">YOUR DRAFT</span><h2>Edit your resume</h2><p>Click inside the text and replace every placeholder with accurate information.</p></div><div className="editor-actions"><button type="button" className="button button-outline" onClick={() => window.print()}>Print / Save PDF</button><button type="button" className="button button-outline" onClick={() => { const blob = new Blob([currentResume.content], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${(currentResume.title || 'resume').replace(/[^a-z0-9-_]/gi, '_')}.txt`; a.click(); URL.revokeObjectURL(url); }}>Download .txt</button><button className="button" disabled={loading} onClick={async () => { clearMessages(); setLoading(true); try { const data = await apiRequest(`/resumes/${currentResume.id}`, { method: 'PUT', body: JSON.stringify(currentResume) }, token); setCurrentResume(data.resume); setResumes(old => [data.resume, ...old.filter(item => item.id !== data.resume.id)]); setMessage('Your resume draft has been saved.'); } catch (err) { setError(err.message); } finally { setLoading(false); } }}>Save changes</button></div></div><label>Resume content<textarea className="resume-content" rows="24" value={currentResume.content} onChange={event => setCurrentResume({ ...currentResume, content: event.target.value })} /></label></div>}<div className="section-row builder-saved-heading"><div><h2>Your saved resume drafts</h2><p>Reopen a draft and continue editing whenever you want.</p></div></div>{resumes.length ? <div className="analysis-list">{resumes.map(item => <div className="analysis-item saved-resume-item" key={item.id}><span className="file-icon">CV</span><span className="analysis-main"><strong>{item.title}</strong><small>Last saved {new Date(item.updatedAt).toLocaleDateString()}</small></span><button className="text-button" onClick={() => { setCurrentResume(item); setBuilderTitle(item.title); setBuilderPrompt(item.prompt); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Open / edit →</button><button className="delete-draft" aria-label={`Delete ${item.title}`} onClick={async () => { try { await apiRequest(`/resumes/${item.id}`, { method: 'DELETE' }, token); setResumes(old => old.filter(resume => resume.id !== item.id)); if (currentResume?.id === item.id) setCurrentResume(null); setMessage('Resume draft deleted.'); } catch (err) { setError(err.message); } }}>×</button></div>)}</div> : <div className="empty-state"><div className="empty-icon">✎</div><h3>No resume drafts yet</h3><p>Write a prompt above to create your first draft. It will be saved to your account.</p></div>}</section>}

      {page === 'result' && selected && user && <section className="page-wrap narrow-wrap"><button className="back-link" onClick={() => go('history')}>← Back to history</button><div className="result-heading"><div><span className="section-kicker">ANALYSIS RESULT</span><h1>{selected.jobRole}</h1><p>{selected.fileName} · {new Date(selected.createdAt).toLocaleString()}</p></div><button className="button button-outline" onClick={() => go('analyze')}>＋ New analysis</button></div><div className="result-score-card"><div className="big-score"><strong>{selected.score}</strong><span>/100</span></div><div><h2>{selected.score >= 75 ? 'A strong keyword overlap' : selected.score >= 45 ? 'A useful start' : 'Room to improve the match'}</h2><p>{selected.summary}</p></div></div><div className="keyword-grid"><KeywordCard title="Keywords found in your resume" items={selected.matchedKeywords} good /><KeywordCard title="Keywords to review" items={selected.missingKeywords} /></div><div className="tip-card"><span className="tip-icon">✦</span><div><h3>How to use this result</h3><p>Review the missing words and add them only if they genuinely match your skills or experience. A higher keyword score does not guarantee an interview.</p></div></div><button className="text-button result-back" onClick={() => go('history')}>View all saved analyses →</button></section>}

      {page === 'history' && user && <section className="page-wrap"><div className="page-heading"><div><span className="section-kicker">YOUR RECORDS</span><h1>My analysis history</h1><p>Pick any saved result to revisit it.</p></div><button className="button" onClick={() => go('analyze')}>＋ New analysis</button></div>{analyses.length ? <AnalysisList items={analyses} onOpen={openAnalysis} /> : <div className="empty-state"><div className="empty-icon">◷</div><h3>No saved analyses yet</h3><p>Your results will appear here after your first check.</p><button className="button" onClick={() => go('analyze')}>Start your first analysis</button></div>}</section>}

      {page === 'profile' && user && <section className="page-wrap narrow-wrap"><button className="back-link" onClick={() => go('dashboard')}>← Back to dashboard</button><div className="profile-card"><div className="profile-avatar">{user.name.slice(0, 1).toUpperCase()}</div><span className="section-kicker">YOUR PROFILE</span><h1>{user.name}</h1><p className="profile-email">{user.email}</p><div className="profile-details"><div><span>Member since</span><strong>{new Date(user.createdAt).toLocaleDateString()}</strong></div><div><span>Saved analyses</span><strong>{analyses.length}</strong></div></div><button className="button button-outline full-button" onClick={logout}>Sign out of this account</button><p className="form-note">Sign in with the same email and password on this device to see your saved analysis history. The database is stored on the computer running the backend.</p></div></section>}
    </main>
    <footer className="footer"><span>resume<span className="brand-light">buddy</span></span><span>Made to make job applications a little simpler.</span><span>Simple · Private · No payment</span></footer>
  </div>;
}

function AnalysisList({ items, onOpen }) {
  return <div className="analysis-list">{items.map(item => <button className="analysis-item" key={item.id} onClick={() => onOpen(item.id)}><span className="file-icon">PDF</span><span className="analysis-main"><strong>{item.jobRole}</strong><small>{item.fileName}</small><small>{new Date(item.createdAt).toLocaleDateString()}</small></span><span className="match-pill">{item.score}% match</span><span className="item-arrow">→</span></button>)}</div>;
}

function KeywordCard({ title, items, good = false }) {
  return <div className="keyword-card"><h3><span className={good ? 'keyword-dot good-dot' : 'keyword-dot'}></span>{title}</h3>{items?.length ? <div className="keyword-tags">{items.map(item => <span key={item} className={good ? 'keyword-good' : ''}>{item}</span>)}</div> : <p className="no-keywords">No keywords to show here.</p>}</div>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
