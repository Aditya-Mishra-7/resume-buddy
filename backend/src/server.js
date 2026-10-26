import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import { run, one, many } from './database.js';
import { analyzeResume } from './analyzer.js';

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'local-development-secret-change-me';

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json({ limit: '1mb' }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, done) => {
  if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) done(null, true);
  else done(new Error('Please upload a PDF file.'));
} });

function createToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

function requireLogin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ message: 'Please sign in to continue.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  }
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, createdAt: user.created_at };
}


function makeResumeDraft(prompt) {
  const source = String(prompt || '').trim();
  const lower = source.toLowerCase();
  const skillBank = [
    'C++', 'C', 'Python', 'Java', 'JavaScript', 'TypeScript', 'HTML', 'CSS', 'React',
    'Node.js', 'Express', 'SQL', 'SQLite', 'MongoDB', 'Git', 'GitHub', 'DSA',
    'Data Structures', 'Algorithms', 'Figma', 'Excel', 'Communication', 'Leadership',
    'Problem Solving', 'Testing', 'REST APIs', 'Tailwind CSS'
  ];
  const skills = skillBank.filter(skill => lower.includes(skill.toLowerCase()));
  const roleMatch = source.match(/(?:for|as|applying for|target role[: ]+)\s+(?:a|an)?\s*([A-Za-z][A-Za-z /-]{2,45})/i);
  const role = roleMatch ? roleMatch[1].replace(/[.!?,].*$/, '').trim() : 'Entry-Level / Internship Role';
  const summary = source.length > 600 ? source.slice(0, 597).trim() + '...' : source;
  return `${source.match(/(?:my name is|name[: ]+)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/i)?.[1] || '[Your Full Name]'}\n${role}\n[Email Address] | [Phone Number] | [City] | [LinkedIn] | [GitHub]\n\nPROFESSIONAL SUMMARY\n${summary}\n\nSKILLS\n${skills.length ? skills.join(' • ') : '[Add only skills you genuinely have]'}\n\nEDUCATION\n[Degree / Course] — [College / University]\n[Graduation year] | [Relevant coursework or academic highlights]\n\nPROJECTS\n[Project Name] — [What you built, technologies used, and the result]\n[Project Name] — [Your contribution and measurable outcome]\n\nEXPERIENCE / INTERNSHIPS\n[Role / Organization] — [Dates]\n[Describe your contribution, tools used, and results. Remove this section if not applicable.]\n\nACHIEVEMENTS & CERTIFICATIONS\n[Relevant certification, award, competition, or achievement]\n\nNOTE TO SELF\nReplace every [placeholder] with accurate information. Do not include skills or experience you do not have.`;
}

function formatResume(row) {
  if (!row) return null;
  return { id: row.id, title: row.title, prompt: row.prompt, content: row.content, createdAt: row.created_at, updatedAt: row.updated_at };
}

function formatAnalysis(row) {
  if (!row) return null;
  const matchedKeywords = JSON.parse(row.matched_keywords || '[]');
  const missingKeywords = JSON.parse(row.missing_keywords || '[]');
  return {
    id: row.id,
    jobRole: row.job_role,
    jobDescription: row.job_description,
    fileName: row.file_name,
    score: row.score,
    matchedKeywords,
    missingKeywords,
    summary: `Your resume matched ${matchedKeywords.length} keywords saved for this analysis.`,
    createdAt: row.created_at
  };
}

app.get('/api/health', (_req, res) => res.json({ ok: true, message: 'Resume Buddy API is running.' }));

app.post('/api/auth/register', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (name.length < 2) return res.status(400).json({ message: 'Please enter your name.' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Please enter a valid email address.' });
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    if (one('SELECT id FROM users WHERE email = ?', [email])) return res.status(409).json({ message: 'An account with this email already exists.' });
    const passwordHash = await bcrypt.hash(password, 10);
    run('INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)', [name, email, passwordHash, new Date().toISOString()]);
    const user = one('SELECT id, name, email, created_at FROM users WHERE email = ?', [email]);
    res.status(201).json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Could not create your account. Please try again.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = one('SELECT * FROM users WHERE email = ?', [email]);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ message: 'Email or password is incorrect.' });
    res.json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Could not sign in. Please try again.' });
  }
});

app.get('/api/me', requireLogin, (req, res) => {
  const user = one('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ message: 'Account not found.' });
  res.json({ user: publicUser(user) });
});

app.get('/api/analyses', requireLogin, (req, res) => {
  const rows = many('SELECT * FROM analyses WHERE user_id = ? ORDER BY id DESC', [req.user.id]);
  res.json({ analyses: rows.map(formatAnalysis).filter(Boolean) });
});

app.get('/api/analyses/:id', requireLogin, (req, res) => {
  const row = one('SELECT * FROM analyses WHERE id = ? AND user_id = ?', [Number(req.params.id), req.user.id]);
  if (!row) return res.status(404).json({ message: 'Analysis not found.' });
  res.json({ analysis: formatAnalysis(row) });
});

app.get('/api/resumes', requireLogin, (req, res) => {
  const rows = many('SELECT * FROM resumes WHERE user_id = ? ORDER BY updated_at DESC', [req.user.id]);
  res.json({ resumes: rows.map(formatResume).filter(Boolean) });
});

app.get('/api/resumes/:id', requireLogin, (req, res) => {
  const row = one('SELECT * FROM resumes WHERE id = ? AND user_id = ?', [Number(req.params.id), req.user.id]);
  if (!row) return res.status(404).json({ message: 'Saved resume not found.' });
  res.json({ resume: formatResume(row) });
});

app.post('/api/resumes/generate', requireLogin, (req, res) => {
  const prompt = String(req.body.prompt || '').trim();
  const title = String(req.body.title || 'My resume draft').trim().slice(0, 100);
  if (prompt.length < 20) return res.status(400).json({ message: 'Please describe your background and the job you want in at least 20 characters.' });
  const content = makeResumeDraft(prompt);
  const now = new Date().toISOString();
  run('INSERT INTO resumes (user_id, title, prompt, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [req.user.id, title || 'My resume draft', prompt, content, now, now]);
  const row = one('SELECT * FROM resumes WHERE user_id = ? ORDER BY id DESC LIMIT 1', [req.user.id]);
  if (!row) return res.status(500).json({ message: 'The resume draft was created but could not be loaded. Please try again.' });
  res.status(201).json({ resume: formatResume(row), note: 'This is a template-based draft, not AI-generated. Review every detail before using it.' });
});

app.put('/api/resumes/:id', requireLogin, (req, res) => {
  const id = Number(req.params.id);
  const title = String(req.body.title || 'My resume draft').trim().slice(0, 100);
  const content = String(req.body.content || '').trim();
  if (!content) return res.status(400).json({ message: 'Resume content cannot be empty.' });
  const existing = one('SELECT id FROM resumes WHERE id = ? AND user_id = ?', [id, req.user.id]);
  if (!existing) return res.status(404).json({ message: 'Saved resume not found.' });
  run('UPDATE resumes SET title = ?, content = ?, updated_at = ? WHERE id = ? AND user_id = ?', [title || 'My resume draft', content, new Date().toISOString(), id, req.user.id]);
  const row = one('SELECT * FROM resumes WHERE id = ? AND user_id = ?', [id, req.user.id]);
  res.json({ resume: formatResume(row) });
});

app.delete('/api/resumes/:id', requireLogin, (req, res) => {
  const existing = one('SELECT id FROM resumes WHERE id = ? AND user_id = ?', [Number(req.params.id), req.user.id]);
  if (!existing) return res.status(404).json({ message: 'Saved resume not found.' });
  run('DELETE FROM resumes WHERE id = ? AND user_id = ?', [Number(req.params.id), req.user.id]);
  res.json({ ok: true });
});

app.post('/api/analyze', requireLogin, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Choose a PDF resume first.' });
    const jobRole = String(req.body.jobRole || '').trim();
    const jobDescription = String(req.body.jobDescription || '').trim();
    if (!jobRole) return res.status(400).json({ message: 'Enter the job role you are applying for.' });
    const parsed = await pdf(req.file.buffer);
    const resumeText = String(parsed.text || '').trim();
    if (resumeText.length < 30) return res.status(400).json({ message: 'We could not read enough text from this PDF. Try a text-based PDF rather than a scanned image.' });
    const result = analyzeResume(resumeText, jobRole, jobDescription);
    const createdAt = new Date().toISOString();
    run(`INSERT INTO analyses (user_id, job_role, job_description, file_name, resume_text, score, matched_keywords, missing_keywords, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [req.user.id, jobRole, jobDescription, req.file.originalname, resumeText, result.score, JSON.stringify(result.matchedKeywords), JSON.stringify(result.missingKeywords), createdAt]);
    const row = one('SELECT * FROM analyses WHERE user_id = ? ORDER BY id DESC LIMIT 1', [req.user.id]);
    if (!row) return res.status(500).json({ message: 'The analysis was saved but could not be loaded. Please try again.' });
    res.status(201).json({ analysis: { ...formatAnalysis(row), summary: result.summary } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Analysis failed. Please try another PDF.' });
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: 'PDF must be 5 MB or smaller.' });
  res.status(400).json({ message: error.message || 'Something went wrong.' });
});

app.listen(PORT, () => console.log(`Resume Buddy backend running at http://localhost:${PORT}`));
