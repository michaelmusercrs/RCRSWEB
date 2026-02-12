# RCRS NotebookLM Setup Guide

Step-by-step guide to set up and run the training content pipeline.

---

## Prerequisites

- Python 3.10+
- Google account (for NotebookLM authentication)
- Node.js (for the web portal)

---

## Step 1: Install Python Dependencies

```bash
cd river-city-roofing/rcrs-notebooklm
pip install "notebooklm-py[browser]"
playwright install
```

This installs the NotebookLM Python client and the Playwright browser automation it uses internally.

---

## Step 2: Authenticate with NotebookLM

```bash
notebooklm login
```

This opens a browser window where you log in with your Google account. The session is saved locally so you only need to do this once (or when the session expires).

---

## Step 3: Prepare Source Documents

```bash
python prepare_sources.py
```

This reads all RCRS project documentation and consolidates it into organized text files:

| Notebook | Sources Created | Content |
|----------|----------------|---------|
| Sales | 3 files | Training course, lead management, CRM systems |
| Onboarding | 3-4 files | System overview, portal guide, integrations |
| Field Ops | 2 files | Delivery/inventory, driver portal |
| Customer Service | 2 files | Customer portal, communication/CRM |
| Admin Deep Dive | 4 files | Architecture, security, data layer, SEO/marketing |
| System Overview | 2 files | Complete docs index, team data |

Sources are saved to `sources/` and a manifest.json is generated.

---

## Step 4: Generate NotebookLM Content

```bash
# Generate everything (takes 30-60 minutes)
python generate_notebooks.py

# Or generate a single notebook
python generate_notebooks.py --notebook sales
python generate_notebooks.py --notebook onboarding
python generate_notebooks.py --notebook field-ops
python generate_notebooks.py --notebook customer-service
python generate_notebooks.py --notebook admin-deep-dive
```

For each notebook, the pipeline generates:
- Audio deep dive (MP3 podcast, ~15-30 min)
- Training video (MP4, corporate style)
- Brief video (MP4, 2-min summary)
- Quiz (JSON with questions/answers)
- Flashcards (JSON with Q&A cards)
- Study guide (Markdown reference)
- Mind map (PNG visual)
- Infographic (PNG visual)

Progress is saved to `pipeline_state.json` so you can resume if interrupted.

---

## Step 5: Sync to Web Portal

```bash
python sync_to_portal.py
```

This copies all generated files to `public/training/` and generates `lib/training-content.ts` so the React training library page can display everything.

---

## Step 6: View in Portal

Navigate to: `/portal/training/library`

Or from the Training Center hub: `/portal/training`

---

## Troubleshooting

### "notebooklm login" hangs
- Make sure Playwright browsers are installed: `playwright install`
- Try `notebooklm login --browser chromium`

### Audio/video generation times out
- NotebookLM can take 5-15 minutes per artifact
- The pipeline uses generous timeouts (10-15 min)
- If it fails, re-run with `--notebook <name>` for just that notebook

### Rate limiting
- Google may throttle if you generate too much at once
- The pipeline runs content types sequentially to minimize this
- If throttled, wait 15 minutes and retry

### "No sources prepared" error
- Run `python prepare_sources.py` first
- Check that `sources/manifest.json` exists

### Pipeline state issues
- Delete `pipeline_state.json` to start fresh
- Or use `python generate_notebooks.py --list` to view current state
