# RCRS NotebookLM Training System

AI-powered training content generation pipeline for River City Roofing Solutions.

Uses [notebooklm-py](https://github.com/teng-lin/notebooklm-py) to programmatically create NotebookLM notebooks from RCRS project documentation and generate comprehensive training materials.

---

## Quick Start

```bash
# 1. Install dependencies
pip install "notebooklm-py[browser]"
playwright install

# 2. Authenticate with Google (one-time)
notebooklm login

# 3. Prepare source documents from RCRS project
python prepare_sources.py

# 4. Create notebooks & generate all content
python generate_notebooks.py

# 5. Sync generated content to the web portal
python sync_to_portal.py
```

---

## System Architecture

```
RCRS Project Docs          NotebookLM               Web Portal
+------------------+      +------------------+      +------------------+
| docs/*.md        |      | Sales Training   |      | /training/library|
| lib/*.ts         | ---> | Onboarding       | ---> | Audio players    |
| ARCHITECTURE.md  |      | Field Ops        |      | Video players    |
| PORTAL-GUIDE.md  |      | Customer Service |      | Quiz engine      |
| API routes       |      | Admin Deep Dive  |      | Flashcard viewer |
+------------------+      +------------------+      | Mind maps        |
                                |                    | Infographics     |
                           Generates:                | Study guides     |
                           - Audio podcasts           +------------------+
                           - Training videos
                           - Quizzes (JSON)
                           - Flashcards (JSON)
                           - Study guides (MD)
                           - Mind maps (PNG)
                           - Infographics (PNG)
```

---

## Notebooks

| Notebook | Audience | Sources | Content Generated |
|----------|----------|---------|-------------------|
| **Sales Training & Mastery** | Sales reps, managers | 3 files (104 KB) | Audio, video, quiz, flashcards, guide, mindmap, infographic |
| **Platform Onboarding** | All employees | 3 files (107 KB) | Audio, video, quiz, flashcards, guide, mindmap, infographic |
| **Field Operations** | Drivers, warehouse, crews | 2 files (193 KB) | Audio, video, quiz, flashcards, guide, mindmap, infographic |
| **Customer Service** | Office staff | 2 files (169 KB) | Audio, video, quiz, flashcards, guide, mindmap, infographic |
| **Admin Deep Dive** | Admins, managers, owner | 4 files (245 KB) | Audio, video, quiz, flashcards, guide, mindmap, infographic |

---

## File Structure

```
rcrs-notebooklm/
├── README.md                  # This file
├── requirements.txt           # Python dependencies
├── prepare_sources.py         # Step 1: Consolidate RCRS docs into sources
├── generate_notebooks.py      # Step 2: Create notebooks & generate content
├── sync_to_portal.py          # Step 3: Copy content to web portal
├── pipeline_state.json        # State tracking (auto-generated)
├── GENERATION-REPORT.md       # Report of generated content (auto-generated)
├── sources/                   # Prepared source documents
│   ├── manifest.json
│   ├── sales/
│   ├── onboarding/
│   ├── field-ops/
│   ├── customer-service/
│   ├── admin-deep-dive/
│   └── system-overview/
└── output/                    # Generated content
    ├── audio/                 # .mp3 podcast files
    ├── video/                 # .mp4 training videos
    ├── quizzes/               # .json quiz data
    ├── guides/                # .md study guides
    ├── infographics/          # .png infographic images
    ├── mindmaps/              # .png mind map images
    └── flashcards/            # .json flashcard data
```

---

## Portal Integration

Generated content syncs to:
- `public/training/` - Static assets served by Next.js
- `lib/training-content.ts` - TypeScript module data consumed by React

Training Library page: `/portal/training/library`

---

## Pipeline Commands

```bash
# Full pipeline
python prepare_sources.py && python generate_notebooks.py && python sync_to_portal.py

# Single notebook
python generate_notebooks.py --notebook sales

# Check pipeline state
python generate_notebooks.py --list

# Re-sync without regenerating
python sync_to_portal.py
```

---

## Content Types

| Type | Format | Description |
|------|--------|-------------|
| Audio Deep Dive | MP3 | 15-30 min AI podcast covering the topic |
| Training Video | MP4 | Animated explainer video (corporate style) |
| Brief Video | MP4 | 2-minute summary video (dynamic style) |
| Quiz | JSON/MD | 10-15 questions with answer key |
| Flashcards | JSON | 20-35 Q&A cards per module |
| Study Guide | Markdown | Comprehensive study reference |
| Mind Map | PNG | Visual concept map of the topic |
| Infographic | PNG | Key facts and stats visual |

---

## Roadmap

### Phase 1 - Foundation (Current)
- [x] Source preparation pipeline
- [x] Notebook generation pipeline
- [x] Portal sync system
- [x] Training Library page (React)
- [x] Audio player, video player, quiz engine, flashcard viewer

### Phase 2 - Enhancement
- [ ] Progress tracking per user (Google Sheets)
- [ ] Certificate generation on quiz completion
- [ ] Role-based auto-assignment of training paths
- [ ] Completion analytics dashboard

### Phase 3 - Advanced
- [ ] Scheduled re-generation (weekly content refresh)
- [ ] Custom notebook creation from admin portal
- [ ] Training content versioning
- [ ] Integration with RCRS University points/badges system
- [ ] Mobile-optimized training player

### Phase 4 - Expansion
- [ ] Customer-facing training (homeowner roofing 101)
- [ ] Vendor/subcontractor onboarding notebooks
- [ ] Compliance training with sign-off tracking
- [ ] Multi-language audio generation
