#!/usr/bin/env python3
"""
RCRS NotebookLM Content Generation Pipeline

Creates NotebookLM notebooks from prepared sources and generates
all training content: audio deep dives, videos, quizzes, flashcards,
mind maps, infographics, and study guides.

Prerequisites:
  pip install "notebooklm-py[browser]"
  playwright install
  notebooklm login

Usage:
  python generate_notebooks.py                    # Run full pipeline
  python generate_notebooks.py --notebook sales   # Single notebook only
  python generate_notebooks.py --content-only     # Skip notebook creation, just generate content
  python generate_notebooks.py --download-only    # Just download existing artifacts
"""

import asyncio
import argparse
import json
import sys
import os
from pathlib import Path
from datetime import datetime

# Import notebooklm-py
try:
    from notebooklm import NotebookLMClient
except ImportError:
    print("ERROR: notebooklm-py not installed.")
    print("Run: pip install 'notebooklm-py[browser]'")
    print("Then: playwright install")
    print("Then: notebooklm login")
    sys.exit(1)

# Paths
SCRIPT_DIR = Path(__file__).parent
SOURCES_DIR = SCRIPT_DIR / "sources"
OUTPUT_DIR = SCRIPT_DIR / "output"
STATE_FILE = SCRIPT_DIR / "pipeline_state.json"

# Notebook definitions
NOTEBOOKS = {
    "sales": {
        "title": "RCRS Sales Training & Mastery",
        "description": "Complete sales training program for River City Roofing Solutions sales representatives",
        "source_dir": "sales",
        "audio_instructions": (
            "Create an engaging training podcast for new roofing sales representatives. "
            "Cover the 7 training modules, pitch techniques, objection handling, "
            "insurance claim process, and how to use the lead management system. "
            "Make it practical with real-world examples from the roofing industry."
        ),
        "video_instructions": (
            "Create a professional training video covering the RCRS sales process "
            "from lead assignment through closing. Include the CRM workflow, "
            "commission structure, and customer interaction best practices."
        ),
        "quiz_difficulty": "intermediate",
        "flashcard_count": 30,
    },
    "onboarding": {
        "title": "RCRS Platform Onboarding",
        "description": "New employee onboarding for the RCRS digital platform and tools",
        "source_dir": "onboarding",
        "audio_instructions": (
            "Create a friendly onboarding walkthrough podcast for new RCRS employees. "
            "Explain the platform architecture, how to navigate the portal, "
            "key integrations (Google Sheets, JobNimbus, calendar), and daily workflows. "
            "Keep it welcoming and practical."
        ),
        "video_instructions": (
            "Create an onboarding explainer video showing the RCRS platform layout, "
            "portal navigation, team structure, and key tools employees will use daily."
        ),
        "quiz_difficulty": "beginner",
        "flashcard_count": 25,
    },
    "field-ops": {
        "title": "RCRS Field Operations & Delivery",
        "description": "Field operations training for drivers, warehouse staff, and crew leads",
        "source_dir": "field-ops",
        "audio_instructions": (
            "Create a field operations training podcast for RCRS drivers and warehouse staff. "
            "Cover the delivery process, inventory management, driver portal usage, "
            "loading checklists, customer delivery notifications, and ETA tracking. "
            "Make it concise and action-oriented."
        ),
        "video_instructions": (
            "Create a field operations training video covering the delivery workflow, "
            "inventory counting process, material ordering, and driver portal features."
        ),
        "quiz_difficulty": "beginner",
        "flashcard_count": 20,
    },
    "customer-service": {
        "title": "RCRS Customer Service Excellence",
        "description": "Customer service training covering the customer portal, CRM, and communication",
        "source_dir": "customer-service",
        "audio_instructions": (
            "Create a customer service training podcast for RCRS office staff. "
            "Cover the customer portal features, how customers track their jobs, "
            "the messaging system, appointment scheduling, weather and hail alerts, "
            "and best practices for customer communication in the roofing industry."
        ),
        "video_instructions": (
            "Create a customer service video walkthrough of the RCRS customer portal, "
            "showing job tracking, messaging, scheduling, and document management."
        ),
        "quiz_difficulty": "intermediate",
        "flashcard_count": 20,
    },
    "admin-deep-dive": {
        "title": "RCRS Admin & Architecture Deep Dive",
        "description": "Technical deep dive for managers and admins covering the full system",
        "source_dir": "admin-deep-dive",
        "audio_instructions": (
            "Create a technical deep dive podcast for RCRS managers and administrators. "
            "Cover the full system architecture, security model, API structure, "
            "Google Sheets data layer, JobNimbus CRM integration, billing system, "
            "SEO strategy, and deployment pipeline. Be thorough and technical."
        ),
        "video_instructions": (
            "Create a technical architecture overview video covering the RCRS platform "
            "stack, data flow, API routes, integrations, and admin capabilities."
        ),
        "quiz_difficulty": "advanced",
        "flashcard_count": 35,
    },
}


def load_state() -> dict:
    """Load pipeline state from disk."""
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {"notebooks": {}, "last_run": None}


def save_state(state: dict):
    """Save pipeline state to disk."""
    state["last_run"] = datetime.now().isoformat()
    STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")


async def create_notebook(client, name: str, config: dict, state: dict) -> str:
    """Create a notebook and add sources. Returns notebook ID."""
    print(f"\n{'='*50}")
    print(f"Creating notebook: {config['title']}")
    print(f"{'='*50}")

    # Check if notebook already exists in state
    if name in state["notebooks"] and state["notebooks"][name].get("notebook_id"):
        nb_id = state["notebooks"][name]["notebook_id"]
        print(f"  Using existing notebook: {nb_id}")
        return nb_id

    # Create notebook
    notebook = await client.notebooks.create(title=config["title"])
    nb_id = notebook.id
    print(f"  Created notebook: {nb_id}")

    # Add sources (with 2s delay between calls to avoid rate limiting)
    source_dir = SOURCES_DIR / config["source_dir"]
    if source_dir.exists():
        source_files = sorted(source_dir.glob("*.txt"))
        for sf in source_files:
            try:
                content = sf.read_text(encoding="utf-8")
                title = sf.stem.replace("-", " ").replace("_", " ").title()
                await client.sources.add_text(nb_id, content, title=title)
                print(f"  Added source: {sf.name} ({len(content)//1024}KB)")
                await asyncio.sleep(2)  # Rate limit protection
            except Exception as e:
                print(f"  WARNING: Failed to add {sf.name}: {e}")

    # Save state
    if name not in state["notebooks"]:
        state["notebooks"][name] = {}
    state["notebooks"][name]["notebook_id"] = nb_id
    state["notebooks"][name]["created"] = datetime.now().isoformat()
    save_state(state)

    return nb_id


async def generate_audio(client, nb_id: str, name: str, config: dict, state: dict):
    """Generate audio podcast for a notebook."""
    print(f"\n  Generating audio deep dive...")
    try:
        task = await client.artifacts.generate_audio(
            nb_id,
            instructions=config["audio_instructions"]
        )
        result = await task.wait_for_completion(timeout=600, poll_interval=15)
        if result:
            out_path = OUTPUT_DIR / "audio" / f"{name}-deep-dive.mp3"
            await result.download(str(out_path))
            print(f"  Audio saved: {out_path}")
            state["notebooks"][name]["audio"] = str(out_path)
        else:
            print(f"  Audio generation completed but no result returned")
        await asyncio.sleep(2)
    except Exception as e:
        print(f"  WARNING: Audio generation failed: {e}")


async def generate_video(client, nb_id: str, name: str, config: dict, state: dict):
    """Generate explainer video for a notebook."""
    print(f"\n  Generating training video...")
    try:
        task = await client.artifacts.generate_video(
            nb_id,
            format="EXPLAINER",
            style="CORPORATE",
            instructions=config["video_instructions"]
        )
        result = await task.wait_for_completion(timeout=900, poll_interval=20)
        if result:
            out_path = OUTPUT_DIR / "video" / f"{name}-training.mp4"
            await result.download(str(out_path))
            print(f"  Video saved: {out_path}")
            state["notebooks"][name]["video"] = str(out_path)
        await asyncio.sleep(2)

        # Also generate a brief version
        print(f"  Generating brief video...")
        brief_task = await client.artifacts.generate_video(
            nb_id,
            format="BRIEF",
            style="DYNAMIC",
            instructions=f"Create a 2-minute brief overview of {config['title']}"
        )
        brief_result = await brief_task.wait_for_completion(timeout=600, poll_interval=15)
        if brief_result:
            brief_path = OUTPUT_DIR / "video" / f"{name}-brief.mp4"
            await brief_result.download(str(brief_path))
            print(f"  Brief video saved: {brief_path}")
            state["notebooks"][name]["video_brief"] = str(brief_path)
        await asyncio.sleep(2)
    except Exception as e:
        print(f"  WARNING: Video generation failed: {e}")


async def generate_quiz(client, nb_id: str, name: str, config: dict, state: dict):
    """Generate quiz for a notebook."""
    print(f"\n  Generating quiz ({config['quiz_difficulty']})...")
    try:
        task = await client.artifacts.generate_quiz(
            nb_id,
            difficulty=config["quiz_difficulty"]
        )
        result = await task.wait_for_completion(timeout=300, poll_interval=10)
        if result:
            out_path = OUTPUT_DIR / "quizzes" / f"{name}-quiz.json"
            await result.download(str(out_path), format="json")
            print(f"  Quiz saved: {out_path}")
            state["notebooks"][name]["quiz"] = str(out_path)

            # Also save as markdown for portal display
            md_path = OUTPUT_DIR / "quizzes" / f"{name}-quiz.md"
            await result.download(str(md_path), format="markdown")
            print(f"  Quiz (MD) saved: {md_path}")
        await asyncio.sleep(2)
    except Exception as e:
        print(f"  WARNING: Quiz generation failed: {e}")


async def generate_flashcards(client, nb_id: str, name: str, config: dict, state: dict):
    """Generate flashcards for a notebook."""
    print(f"\n  Generating {config['flashcard_count']} flashcards...")
    try:
        task = await client.artifacts.generate_flashcards(
            nb_id,
            count=config["flashcard_count"]
        )
        result = await task.wait_for_completion(timeout=300, poll_interval=10)
        if result:
            out_path = OUTPUT_DIR / "flashcards" / f"{name}-flashcards.json"
            await result.download(str(out_path), format="json")
            print(f"  Flashcards saved: {out_path}")
            state["notebooks"][name]["flashcards"] = str(out_path)
        await asyncio.sleep(2)
    except Exception as e:
        print(f"  WARNING: Flashcard generation failed: {e}")


async def generate_study_guide(client, nb_id: str, name: str, config: dict, state: dict):
    """Generate study guide for a notebook."""
    print(f"\n  Generating study guide...")
    try:
        task = await client.artifacts.generate_report(
            nb_id,
            instructions="Create a comprehensive study guide"
        )
        result = await task.wait_for_completion(timeout=300, poll_interval=10)
        if result:
            out_path = OUTPUT_DIR / "guides" / f"{name}-study-guide.md"
            await result.download(str(out_path), format="markdown")
            print(f"  Study guide saved: {out_path}")
            state["notebooks"][name]["study_guide"] = str(out_path)
        await asyncio.sleep(2)
    except Exception as e:
        print(f"  WARNING: Study guide generation failed: {e}")


async def generate_mind_map(client, nb_id: str, name: str, config: dict, state: dict):
    """Generate mind map for a notebook."""
    print(f"\n  Generating mind map...")
    try:
        task = await client.artifacts.generate_mind_map(nb_id)
        result = await task.wait_for_completion(timeout=300, poll_interval=10)
        if result:
            out_path = OUTPUT_DIR / "mindmaps" / f"{name}-mindmap.json"
            await result.download(str(out_path))
            print(f"  Mind map saved: {out_path}")
            state["notebooks"][name]["mindmap"] = str(out_path)
        await asyncio.sleep(2)
    except Exception as e:
        print(f"  WARNING: Mind map generation failed: {e}")


async def generate_infographic(client, nb_id: str, name: str, config: dict, state: dict):
    """Generate infographic for a notebook."""
    print(f"\n  Generating infographic...")
    try:
        task = await client.artifacts.generate_infographic(nb_id)
        result = await task.wait_for_completion(timeout=300, poll_interval=10)
        if result:
            out_path = OUTPUT_DIR / "infographics" / f"{name}-infographic.png"
            await result.download(str(out_path))
            print(f"  Infographic saved: {out_path}")
            state["notebooks"][name]["infographic"] = str(out_path)
        await asyncio.sleep(2)
    except Exception as e:
        print(f"  WARNING: Infographic generation failed: {e}")


async def process_notebook(client, name: str, config: dict, state: dict):
    """Full processing pipeline for a single notebook."""
    nb_id = await create_notebook(client, name, config, state)

    # Generate all content types (sequentially to avoid rate limits)
    await generate_audio(client, nb_id, name, config, state)
    await generate_video(client, nb_id, name, config, state)
    await generate_quiz(client, nb_id, name, config, state)
    await generate_flashcards(client, nb_id, name, config, state)
    await generate_study_guide(client, nb_id, name, config, state)
    await generate_mind_map(client, nb_id, name, config, state)
    await generate_infographic(client, nb_id, name, config, state)

    save_state(state)
    print(f"\n  Notebook '{name}' processing complete!")


async def main():
    parser = argparse.ArgumentParser(description="RCRS NotebookLM Content Pipeline")
    parser.add_argument("--notebook", choices=list(NOTEBOOKS.keys()),
                        help="Process a single notebook only")
    parser.add_argument("--content-only", action="store_true",
                        help="Skip notebook creation, just generate content for existing notebooks")
    parser.add_argument("--download-only", action="store_true",
                        help="Only download existing artifacts")
    parser.add_argument("--list", action="store_true",
                        help="List current pipeline state")
    args = parser.parse_args()

    state = load_state()

    if args.list:
        print(json.dumps(state, indent=2))
        return

    # Check sources exist
    manifest_path = SOURCES_DIR / "manifest.json"
    if not manifest_path.exists():
        print("ERROR: No sources prepared. Run `python prepare_sources.py` first.")
        sys.exit(1)

    print("=" * 60)
    print("RCRS NotebookLM Content Generation Pipeline")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # Connect to NotebookLM
    print("\nConnecting to NotebookLM...")
    async with await NotebookLMClient.from_storage() as client:
        print("Connected!")

        if args.notebook:
            # Process single notebook
            config = NOTEBOOKS[args.notebook]
            await process_notebook(client, args.notebook, config, state)
        else:
            # Process all notebooks
            for name, config in NOTEBOOKS.items():
                await process_notebook(client, name, config, state)

    # Generate final report
    generate_report(state)


def generate_report(state: dict):
    """Generate a summary report of all generated content."""
    report_lines = [
        "# RCRS NotebookLM Content Generation Report",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        "---",
        "",
    ]

    content_types = ["audio", "video", "video_brief", "quiz", "flashcards",
                     "study_guide", "mindmap", "infographic"]

    for nb_name, nb_data in state.get("notebooks", {}).items():
        report_lines.append(f"## {nb_name.replace('-', ' ').title()}")
        report_lines.append(f"- Notebook ID: `{nb_data.get('notebook_id', 'N/A')}`")
        report_lines.append(f"- Created: {nb_data.get('created', 'N/A')}")
        report_lines.append("")
        report_lines.append("| Content Type | Status | Path |")
        report_lines.append("|---|---|---|")
        for ct in content_types:
            path = nb_data.get(ct, "")
            status = "Generated" if path else "Not generated"
            report_lines.append(f"| {ct.replace('_', ' ').title()} | {status} | {path} |")
        report_lines.append("")

    report_path = SCRIPT_DIR / "GENERATION-REPORT.md"
    report_path.write_text("\n".join(report_lines), encoding="utf-8")
    print(f"\nReport saved to: {report_path}")


if __name__ == "__main__":
    asyncio.run(main())
