# ExamFlow Edu — Online Exam Platform with Google Sheets & Apps Script Backend

ExamFlow Edu is a lightweight, responsive online examination platform modeled after Google Forms, featuring multimedia question support (audio, images, video), automatic AI question generation via Gemini, custom school branding, Bloom-Anderson / SOLO taxonomy exam blueprint (kisi-kisi) printing, and Google Sheets as the primary database managed through a Google Apps Script (GAS) Web App backend—free from Firebase or Google Cloud Console overhead.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions have been updated and incorporated based on your latest requirements:

- **Confirmed Decision 1 (Exam Security)**: Configurable per exam by the teacher (strict timer, tab-switch blur warnings, copy-paste restrictions, automatic submission).
- **Confirmed Decision 2 (Database & GAS Setup)**: Live Google Apps Script connection with an in-app interactive Setup Guide. Pre-built `.gs` script that initializes all Google Sheets tabs (`Exams`, `Questions`, `Students`, `Submissions`, `Users`, `SchoolProfile`, `Logs`), exposes RESTful endpoints, and verifies connection health via a live test probe.
- **Confirmed Decision 3 (Visual Design)**: Vibrant modern palette with indigo, emerald, and amber accents, supporting instant Light and Dark mode switching, compliant with WCAG AA contrast and zero-pill typographic discipline.
- **Confirmed Decision 4 (School Profile & Branding)**: Editable school profile in Teacher Settings (School Name, Logo URL/upload, Academic Year, Headmaster/Teacher name, School Address) dynamically rendered on the Student Exam portal header, exam cards, login modal, and printed documents.
- **Confirmed Decision 5 (Taxonomy & Kisi-Kisi Soal)**: Comprehensive printable Blueprint / "Kisi-Kisi Soal" generator supporting **Bloom-Anderson Taxonomy** (C1 Mengingat, C2 Memahami, C3 Menerapkan, C4 Menganalisis, C5 Mengevaluasi, C6 Mencipta) and **SOLO Taxonomy** (Prestructural, Unistructural, Multistructural, Relational, Extended Abstract) with official header and print-ready CSS.
- **Confirmed Decision 6 (Gemini API Configuration)**: Dedicated settings menu with secure local storage for the user's Gemini API key, model selection (`gemini-2.5-flash`), connection tester, and prompt customization to prevent 503/504 errors.

---

## 1. Overview & Core Concept

### What It Does
- **Student Exam Portal**: Students landing on the app immediately see today's available exams and school branding (Logo & School Name). They enter their Student ID (NIS), Name, and optional Exam Token. In the exam room, they interact with multimedia questions (audio player, zoomable images, embedded videos), jump palette, and offline-safe auto-saving.
- **Teacher Workspace**:
  - **School Profile Editor**: Configure school logo, name, academic year, semester, and credentials.
  - **Exam & Question Bank**: Create, edit, delete, duplicate, and redeploy exams.
  - **Manual & AI Question Maker**: Craft rich media questions manually or generate them in bulk using Gemini AI (with custom API key).
  - **Kisi-Kisi Soal (Exam Blueprint) Generator**: Generates official Indonesian-standard curriculum exam specifications based on Bloom-Anderson or SOLO taxonomy, ready to preview, filter, and print to PDF.
  - **Google Sheets Sync**: Real-time bidirectional sync pushing exams, questions, and school profile to Google Sheets, and fetching student submissions with green success notifications.
  - **Analytics Dashboard**: Visual charts for score distributions, question difficulty index, passing rates, and student mastery.
- **Google Apps Script (GAS) & Google Sheets Backend**: Runs entirely on Google Sheets with zero third-party cloud infrastructure (no Firebase, no GCP billing).

---

## 2. User Experience & Visual Design

```
┌────────────────────────────────────────────────────────────────────────┐
│                              TOP BAR                                   │
│  [🏫 School Logo + ExamFlow Edu]         [Siswa | Guru | Kisi-Kisi]    │
│                                          [⚙️ Pengaturan] [🌓 Dark/Light]│
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
           ┌─────────────────────────┴────────────────────────┐
           ▼                                                  ▼
┌──────────────────────────────┐           ┌─────────────────────────────┐
│       STUDENT VIEW           │           │        TEACHER VIEW         │
│                              │           │                             │
│ 1. School Header & Logo      │           │ 1. School Profile & Logo    │
│ 2. Today's Exam Schedule     │           │ 2. Gemini AI Key & Settings │
│ 3. Student Login / NIS Form  │           │ 3. Exam & Question Builder  │
│ 4. Multimedia Question Sheet │           │ 4. Cetak Kisi-Kisi (Bloom/  │
│    - Audio Player            │           │    SOLO Taxonomy Engine)    │
│    - Image Zoom Modal        │           │ 5. Visual Score Analytics   │
│    - Video Embed Player      │           │ 6. GAS Sync Hub & Logs      │
│ 5. Offline Resilient Save    │           │ 7. User & Student Roster    │
│ 6. Submission Receipt        │           │                             │
└──────────────────────────────┘           └─────────────────────────────┘
```

### Key User Flows

1. **School Profile & Student Login Experience**:
   - The teacher opens **Profil Sekolah** in settings, inputs School Name (e.g., "SMA Negeri 1 Nusantara"), uploads or enters a School Logo URL, school motto, and address.
   - When students visit the app, the student landing page and login form proudly display the verified School Logo, institution name, and current academic year.
   - Student selects an active scheduled exam, enters their NIS and Name, and starts the test.

2. **AI Question Generation & Gemini API Key Flow**:
   - Teacher accesses **Pengaturan API Gemini** $\to$ inputs their Gemini API Key $\to$ clicks **Test Koneksi** for instant validation.
   - In Question Generator, teacher inputs topic (e.g., "Sistem Pernapasan Manusia", "Hukum Newton", "Teks Eksplanasi"), difficulty, number of questions, and target taxonomy level.
   - Gemini generates questions with options, correct answer keys, Bloom/SOLO classification, and explanations.

3. **Cetak Kisi-Kisi Soal (Blueprint Matrix) Flow**:
   - Teacher clicks **Cetak Kisi-Kisi** on any exam.
   - Chooses Taxonomy mode: **Bloom-Anderson** (C1–C6) or **SOLO** (Unistructural to Extended Abstract).
   - The app dynamically formats the blueprint table according to national education standards:
     - Header: Kop Sekolah (School Logo, School Name, Mata Pelajaran, Kelas/Semester, Tahun Ajaran, Guru Pengampu).
     - Table: No, Kompetensi Dasar / Capaian Pembelajaran, Materi, Indikator Soal, Level Kognitif (C1–C6 atau SOLO), Bentuk Soal, Nomor Soal.
   - Teacher clicks **Cetak / PDF** $\to$ invokes clean print stylesheet with page breaks and formal formatting.

4. **Exam History & Sync Management**:
   - Complete exam lifecycle: Draft $\to$ Active $\to$ Completed $\to$ Redeploy.
   - Teacher edits questions, adds multimedia assets, and clicks **Sinkronkan ke Google Sheets**.
   - A success banner flashes with timestamp and sync log entry.

---

## 3. Key Product Decisions & Trade-Offs

- **School Logo Storage**:
  - *Chosen Approach*: Support both direct Image URLs (Google Drive public thumbnail, Imgur, school CDN) and inline Base64 storage in localStorage and Google Sheets `SchoolProfile` tab.
  - *Why*: Allows teachers without web hosting to upload an image file directly from their device, while still working completely offline.
- **Taxonomy Dual Support (Bloom-Anderson vs SOLO)**:
  - *Chosen Approach*: Provide an interactive toggle and automatic tagging. In Bloom-Anderson mode: C1 (Mengingat), C2 (Memahami), C3 (Menerapkan), C4 (Menganalisis), C5 (Mengevaluasi), C6 (Mencipta). In SOLO mode: Prestructural, Unistructural, Multistructural, Relational, Extended Abstract. Each question stores both or maps cleanly so the teacher can switch view formats at will.
- **Gemini API Key Security**:
  - *Chosen Approach*: Key is stored securely in the browser's local state / server proxy, never committed to git, with a direct "Hapus Key" button and mask/unmask visibility toggle.
- **Print Optimization**:
  - *Chosen Approach*: Dedicated CSS `@media print` rules ensuring the kisi-kisi prints with crisp monochrome/high-contrast border tables, official letterhead (kop surat), signature columns (Kepala Sekolah & Guru Mata Pelajaran), and no extraneous website navigation.

---

## 4. Technical Architecture & Data Strategy

### System Component Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT APPLICATION                              │
│                                                                        │
│  ┌───────────────────────┐        ┌─────────────────────────────────┐  │
│  │     Student View      │        │          Teacher View           │  │
│  │ - School Logo & Kop   │        │ - School Profile Editor         │  │
│  │ - Exam Schedule Deck  │        │ - Gemini API Key Configuration  │  │
│  │ - Media Question Run  │        │ - Kisi-Kisi Print Engine        │  │
│  │ - Anti-Cheat & Timer  │        │ - Exam History & AI Builder     │  │
│  └───────────┬───────────┘        └────────────────┬────────────────┘  │
│              │                                     │                   │
│              ▼                                     ▼                   │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                  Data & Sync Orchestrator                        │  │
│  │  - Local Cache & Offline Outbox (localStorage / IndexedDB)       │  │
│  │  - Bloom / SOLO Taxonomy Mapping Engine                          │  │
│  │  - Auto-Sync Worker with Synchronous Handshake                  │  │
│  │  - Real-time Success Notification & Live Debug Logger            │  │
│  └───────────────────┬───────────────────────────┬──────────────────┘  │
└──────────────────────┼───────────────────────────┼─────────────────────┘
                       │                           │
         [HTTPS Fetch via Web App URL]    [Gemini API Endpoint]
                       │                           │
                       ▼                           ▼
       ┌──────────────────────────────┐    ┌────────────────┐
       │   Google Apps Script Backend │    │   Gemini API   │
       │   (doGet / doPost Web App)   │    │  (AI Questions)│
       └──────────────┬───────────────┘    └────────────────┘
                      │
                      ▼
       ┌──────────────────────────────┐
       │     Google Sheets Database   │
       │   - Sheet: SchoolProfile     │
       │   - Sheet: Exams             │
       │   - Sheet: Questions         │
       │   - Sheet: Students          │
       │   - Sheet: Submissions       │
       │   - Sheet: Users             │
       │   - Sheet: Logs              │
       └──────────────────────────────┘
```

### Google Sheets Relational Schema

| Sheet Tab Name | Columns | Description |
| :--- | :--- | :--- |
| **`SchoolProfile`** | `name, npsn, address, logoUrl, academicYear, semester, principalName, principalNip` | School branding and official report header details |
| **`Exams`** | `id, title, subject, grade, durationMinutes, passingScore, isStrict, allowReview, startsAt, endsAt, status, totalQuestions, createdAt` | Examination definitions and scheduling parameters |
| **`Questions`** | `id, examId, order, prompt, type, mediaType, mediaUrl, optionsJson, correctKey, points, explanation, bloomLevel, soloLevel, basicCompetency` | Multimedia questions linked to exams with taxonomy tags |
| **`Students`** | `id, studentNo, fullName, classGrade, email, phone, status` | Registered student roster |
| **`Submissions`**| `id, examId, studentNo, studentName, answersJson, score, maxScore, percentage, passed, submittedAt, tabSwitchCount, syncStatus` | Student exam attempts and graded results |
| **`Users`** | `id, username, passwordHash, fullName, role, active` | Teachers and admin accounts |
| **`Logs`** | `id, timestamp, level, category, message, payloadPreview` | Audit and error logs synced to the cloud |

---

## 5. Step-by-Step Implementation Strategy

1. **Data Model & Types**:
   - Add `SchoolProfile` types (name, logoUrl, address, academicYear, principal).
   - Add Taxonomy types (`BloomLevel`: C1–C6, `SoloLevel`: Prestructural–Extended Abstract, `basicCompetency`, `indicator`).
   - Define Gemini configuration types and Google Apps Script payloads.
2. **Google Apps Script Backend (`Code.gs`)**:
   - Update backend script to create and read/write the `SchoolProfile` sheet along with `Exams`, `Questions`, `Students`, `Submissions`, `Users`, and `Logs`.
3. **School Profile & Branding Module**:
   - Settings tab for school profile editing with logo uploader / URL preview.
   - Display school logo and credentials in Student View header, exam selection cards, and student login modal.
4. **Gemini API Key Configuration & AI Generator**:
   - Dedicated Settings view for entering Gemini API key with eye toggle and connection probe.
   - AI generation engine with taxonomy tag prediction (Bloom C1–C6 or SOLO).
5. **Cetak Kisi-Kisi Soal (Blueprint Matrix) Engine**:
   - Dedicated view to select an exam, choose taxonomy model (Bloom-Anderson vs. SOLO), edit indicator descriptions, and generate an Indonesian curriculum standard Kop & Matrix table.
   - Print stylesheet (`@media print`) for clean paper printing or export to PDF with signature fields.
6. **Student Portal (Default Landing)**:
   - Direct landing on today's active exam schedule with school branding.
   - Audio/image/video question player, timer, anti-cheat detection, offline auto-save.
7. **Score Analytics & Sync Hub**:
   - Visual charts, sync log console, real-time sync with success notifications, and dark/light mode toggles.
