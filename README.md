# Resume Buddy — beginner-friendly resume analyzer

A small full-stack project built with React, Express and SQLite. It is designed to be readable for a student learning web development.

## Features
- Register and sign in with an email and password.
- Passwords are hashed with bcrypt; they are not stored as plain text.
- Upload a text-based PDF resume (maximum 5 MB).
- Compare resume words with a job title and optional job description.
- See a simple keyword-overlap score and matched/missing keywords.
- Save analysis history per account and revisit results later.
- Create a resume draft from a prompt, edit it, save it to your account, and reopen it later.
- Print a resume draft or choose “Save as PDF” in the print dialog.
- Light theme, responsive layout, no payment pages or pop-up alerts.

## Requirements
Install Node.js 20 or newer. Internet is needed the first time to download npm packages.

## Run it in VS Code
Open the `resume-buddy` folder in VS Code. Use two terminals.

### Terminal 1 — backend
```bash
cd backend
npm install
```
Copy `.env.example` to `.env`. You can leave the default port, but replace `JWT_SECRET` with a long random value before using real accounts. Then run:
```bash
npm run dev
```
The API runs at `http://localhost:5000`. Test `http://localhost:5000/api/health` in a browser.

### Terminal 2 — frontend
```bash
cd frontend
npm install
npm run dev
```
Open the local URL printed by Vite, usually `http://localhost:5173`.

## Where data is stored
The backend creates `backend/data/resume-buddy.sqlite` on first run. It stores account records, password hashes, and analysis history. The extracted text of each uploaded resume is saved so the result record can be kept; the original PDF file itself is not retained. Resume drafts and their prompts are also saved per account. Each user's history is filtered by their account ID.

**Important:** this is a learning/demo project. The SQLite file is on the computer running the backend, so it is not automatically shared across different computers. To deploy publicly, use a hosted database, HTTPS, a strong `JWT_SECRET`, rate limiting, backups, and a privacy notice. Do not use real sensitive resumes until the project is properly secured.

## How the analysis works
`backend/src/analyzer.js` contains a small keyword matching function. The analyzer does not use an AI service or make hiring decisions. The resume builder is also a simple prompt-to-template helper, not a generative AI service: it creates a structured draft, recognizes a small list of skills, and leaves placeholders for facts the user must add. It extracts words from the role details and checks which ones appear in the resume text. A score is simply the percentage of role keywords found in the resume. It is a learning aid, not a real ATS score.

## Main files
- `frontend/src/main.jsx` — pages and frontend behavior.
- `frontend/src/style.css` — all visual styling.
- `backend/src/server.js` — API routes, login, PDF upload and saved analysis endpoints.
- `backend/src/database.js` — SQLite database and queries.
- `backend/src/analyzer.js` — keyword matching logic.
- Resume builder routes in `backend/src/server.js` — create, save, list, edit, and delete resume drafts.


## Fixes included in this final package
- Uses the CommonJS-compatible `pdf-parse` import so startup does not try to load the package's test PDF path.
- Checks database query results before accessing their `id`, and returns a readable error if a newly saved item cannot be loaded.
- Styles the Create Account / Sign In form's main button grey, with a darker grey hover state.

## Windows troubleshooting
- If port 5000 is already in use, stop the other backend terminal with `Ctrl+C` first. Do not start multiple backend copies. If the port is still busy, use `netstat -ano | findstr :5000` in Command Prompt to identify the PID, then check it with `tasklist /FI "PID eq <PID>"` before stopping the correct process.
- Resume analysis works with text-based PDFs. Scanned/image-only PDFs may not contain extractable text and will be rejected with a helpful message.
- The builder in this package is a template-based demo, not an external AI service. It saves an editable draft and allows Print / Save PDF.
