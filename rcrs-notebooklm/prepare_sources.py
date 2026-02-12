#!/usr/bin/env python3
"""
RCRS NotebookLM Source Preparation Script

Consolidates all River City Roofing project documentation into
organized text files ready for NotebookLM notebook upload.

Each output file becomes a "source" in the appropriate NotebookLM notebook.
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime

# Project paths
RCRS_ROOT = Path(__file__).parent.parent
SOURCES_DIR = Path(__file__).parent / "sources"
DOCS_DIR = RCRS_ROOT / "docs"
LIB_DIR = RCRS_ROOT / "lib"
APP_DIR = RCRS_ROOT / "app"
COMPONENTS_DIR = RCRS_ROOT / "components"
DATA_DIR = RCRS_ROOT / "data"

# Ensure output dirs exist
SOURCES_DIR.mkdir(exist_ok=True)
for subdir in ["sales", "onboarding", "field-ops", "customer-service", "admin-deep-dive", "system-overview"]:
    (SOURCES_DIR / subdir).mkdir(exist_ok=True)


def read_file_safe(path: Path) -> str:
    """Read a file with UTF-8 encoding, fallback to latin-1."""
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="latin-1")
    except Exception as e:
        return f"[Error reading {path}: {e}]"


def collect_markdown_docs() -> dict:
    """Collect all markdown documentation files."""
    docs = {}

    # Root-level markdown files
    root_mds = [
        "PUNCHOUT-LIST.md", "PORTAL-TRAINING-GUIDE.md", "PROJECT-OVERVIEW.md",
        "COMMAND-CENTER-README.md", "INVENTORY-FLOW-SPEC.md", "MASTER_STRATEGY.md",
        "COLOR-SCHEME-GUIDE.md", "FILE-STRUCTURE-GUIDE.md", "GOOGLE-APPS-SCRIPT-SETUP.md",
        "GOOGLE-SHEETS-GLOSSARY.md", "IMAGE-SETUP-GUIDE.md", "ENV-CONFIGURATION-STATUS.md",
    ]
    for md in root_mds:
        path = RCRS_ROOT / md
        if path.exists():
            docs[md] = read_file_safe(path)

    # docs/ directory
    if DOCS_DIR.exists():
        for f in DOCS_DIR.glob("*.md"):
            docs[f"docs/{f.name}"] = read_file_safe(f)

    # lib/ARCHITECTURE.md
    arch = LIB_DIR / "ARCHITECTURE.md"
    if arch.exists():
        docs["lib/ARCHITECTURE.md"] = read_file_safe(arch)

    return docs


def collect_training_content() -> dict:
    """Extract existing training page content."""
    content = {}
    training_paths = [
        APP_DIR / "portal" / "training" / "page.tsx",
        APP_DIR / "portal" / "training" / "sales" / "page.tsx",
        APP_DIR / "portal" / "training" / "onboarding" / "page.tsx",
    ]
    for p in training_paths:
        if p.exists():
            content[str(p.relative_to(RCRS_ROOT))] = read_file_safe(p)
    return content


def collect_api_routes() -> dict:
    """Collect all API route files for system documentation."""
    routes = {}
    api_dir = APP_DIR / "api"
    if api_dir.exists():
        for route_file in api_dir.rglob("route.ts"):
            rel = str(route_file.relative_to(RCRS_ROOT))
            routes[rel] = read_file_safe(route_file)
    return routes


def collect_lib_services() -> dict:
    """Collect key service files from lib/."""
    services = {}
    key_libs = [
        "google-sheets-service.ts", "auth-service.ts", "team-roles.ts",
        "teamData.ts", "jobnimbus-service.ts", "inventory-service.ts",
        "delivery-reminder-service.ts", "google-calendar.ts", "cms-sheets-service.ts",
        "lead-distribution-service.ts", "commission-service.ts", "billing-service.ts",
        "sales-portal-service.ts", "customer-portal-service.ts",
    ]
    for lib_file in key_libs:
        path = LIB_DIR / lib_file
        if path.exists():
            services[lib_file] = read_file_safe(path)
    return services


def collect_component_info() -> dict:
    """Collect key component files."""
    components = {}
    key_components = [
        "Header.tsx", "Footer.tsx", "ContactForm.tsx", "ReferralForm.tsx",
        "AdminLayout.tsx", "Leaderboard.tsx", "WeatherWidget.tsx",
        "portal/ChatWidget.tsx", "RoleTrainingPopup.tsx", "TrainingPopup.tsx",
        "SettingsMenu.tsx", "FeatureUpdatesPopup.tsx",
    ]
    for comp in key_components:
        path = COMPONENTS_DIR / comp
        if path.exists():
            components[comp] = read_file_safe(path)
    return components


def collect_portal_pages() -> dict:
    """Collect portal page files organized by section."""
    pages = {}
    portal_dir = APP_DIR / "portal"
    if portal_dir.exists():
        for page_file in portal_dir.rglob("page.tsx"):
            rel = str(page_file.relative_to(RCRS_ROOT))
            pages[rel] = read_file_safe(page_file)
    return pages


def build_source_file(title: str, sections: dict, output_path: Path):
    """Build a consolidated source document from multiple sections."""
    lines = [
        f"# {title}",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        f"Source: River City Roofing Solutions Platform",
        "",
        "---",
        "",
    ]
    for section_name, content in sections.items():
        lines.append(f"## {section_name}")
        lines.append("")
        lines.append(content[:50000])  # Cap at 50K chars per section
        lines.append("")
        lines.append("---")
        lines.append("")

    output_path.write_text("\n".join(lines), encoding="utf-8")
    size_kb = output_path.stat().st_size / 1024
    print(f"  Created: {output_path.name} ({size_kb:.1f} KB)")


def prepare_sales_training_sources():
    """Prepare sources for the Sales Training notebook."""
    print("\n[1/6] Preparing SALES TRAINING sources...")

    # Source 1: Sales Training Course Content
    training = collect_training_content()
    sales_page = training.get("app/portal/training/sales/page.tsx", "")
    build_source_file(
        "RCRS Sales Training Course - Full Module Content",
        {"Sales Training Page (7 Modules with Quizzes)": sales_page},
        SOURCES_DIR / "sales" / "01-sales-training-course.txt"
    )

    # Source 2: Lead Management System
    libs = collect_lib_services()
    lead_sections = {}
    if "lead-distribution-service.ts" in libs:
        lead_sections["Lead Distribution Service"] = libs["lead-distribution-service.ts"]
    if "commission-service.ts" in libs:
        lead_sections["Commission Tracking"] = libs["commission-service.ts"]
    if "sales-portal-service.ts" in libs:
        lead_sections["Sales Portal Service"] = libs["sales-portal-service.ts"]

    docs = collect_markdown_docs()
    if "docs/LEAD_DASHBOARD_GUIDE.md" in docs:
        lead_sections["Lead Dashboard Guide"] = docs["docs/LEAD_DASHBOARD_GUIDE.md"]

    build_source_file(
        "RCRS Lead Management & Sales Operations",
        lead_sections,
        SOURCES_DIR / "sales" / "02-lead-management.txt"
    )

    # Source 3: CRM & Customer Interaction
    crm_sections = {}
    if "jobnimbus-service.ts" in libs:
        crm_sections["JobNimbus CRM Integration"] = libs["jobnimbus-service.ts"]
    if "google-sheets-service.ts" in libs:
        crm_sections["Google Sheets Backend"] = libs["google-sheets-service.ts"]

    build_source_file(
        "RCRS CRM & Customer Data Systems",
        crm_sections,
        SOURCES_DIR / "sales" / "03-crm-systems.txt"
    )


def prepare_onboarding_sources():
    """Prepare sources for the Platform Onboarding notebook."""
    print("\n[2/6] Preparing PLATFORM ONBOARDING sources...")

    # Source 1: System Overview
    docs = collect_markdown_docs()
    overview_sections = {}
    for key in ["docs/SYSTEM-OVERVIEW.md", "lib/ARCHITECTURE.md", "PROJECT-OVERVIEW.md"]:
        if key in docs:
            overview_sections[key] = docs[key]

    build_source_file(
        "RCRS Platform - System Architecture & Overview",
        overview_sections,
        SOURCES_DIR / "onboarding" / "01-system-overview.txt"
    )

    # Source 2: Portal Training Guide
    portal_sections = {}
    for key in ["PORTAL-TRAINING-GUIDE.md", "COMMAND-CENTER-README.md", "FILE-STRUCTURE-GUIDE.md"]:
        if key in docs:
            portal_sections[key] = docs[key]

    build_source_file(
        "RCRS Portal - Navigation & Training Guide",
        portal_sections,
        SOURCES_DIR / "onboarding" / "02-portal-guide.txt"
    )

    # Source 3: Integrations & Setup
    integration_sections = {}
    for key in ["docs/INTEGRATIONS.md", "GOOGLE-APPS-SCRIPT-SETUP.md",
                "GOOGLE-SHEETS-GLOSSARY.md", "ENV-CONFIGURATION-STATUS.md"]:
        if key in docs:
            integration_sections[key] = docs[key]

    build_source_file(
        "RCRS Integrations & Environment Setup",
        integration_sections,
        SOURCES_DIR / "onboarding" / "03-integrations-setup.txt"
    )

    # Source 4: Training page content
    training = collect_training_content()
    onboarding_page = training.get("app/portal/training/onboarding/page.tsx", "")
    if onboarding_page:
        build_source_file(
            "RCRS Onboarding Course Content",
            {"Onboarding Training Page": onboarding_page},
            SOURCES_DIR / "onboarding" / "04-onboarding-course.txt"
        )


def prepare_field_ops_sources():
    """Prepare sources for the Field Operations notebook."""
    print("\n[3/6] Preparing FIELD OPERATIONS sources...")

    # Source 1: Delivery & Inventory
    docs = collect_markdown_docs()
    libs = collect_lib_services()
    delivery_sections = {}
    if "INVENTORY-FLOW-SPEC.md" in docs:
        delivery_sections["Inventory Flow Spec"] = docs["INVENTORY-FLOW-SPEC.md"]
    if "PORTAL-TRAINING-GUIDE.md" in docs:
        delivery_sections["Portal Training (Delivery Focus)"] = docs["PORTAL-TRAINING-GUIDE.md"]
    if "inventory-service.ts" in libs:
        delivery_sections["Inventory Service Code"] = libs["inventory-service.ts"]
    if "delivery-reminder-service.ts" in libs:
        delivery_sections["Delivery Reminder Service"] = libs["delivery-reminder-service.ts"]

    build_source_file(
        "RCRS Field Operations - Delivery & Inventory",
        delivery_sections,
        SOURCES_DIR / "field-ops" / "01-delivery-inventory.txt"
    )

    # Source 2: Driver portal pages
    pages = collect_portal_pages()
    driver_sections = {}
    for key, val in pages.items():
        if "driver" in key.lower() or "delivery" in key.lower():
            driver_sections[key] = val

    if driver_sections:
        build_source_file(
            "RCRS Driver & Delivery Portal Pages",
            driver_sections,
            SOURCES_DIR / "field-ops" / "02-driver-portal.txt"
        )


def prepare_customer_service_sources():
    """Prepare sources for the Customer Service notebook."""
    print("\n[4/6] Preparing CUSTOMER SERVICE sources...")

    libs = collect_lib_services()
    docs = collect_markdown_docs()

    # Source 1: Customer Portal
    cs_sections = {}
    if "customer-portal-service.ts" in libs:
        cs_sections["Customer Portal Service"] = libs["customer-portal-service.ts"]

    pages = collect_portal_pages()
    for key, val in pages.items():
        if "customer" in key.lower():
            cs_sections[key] = val

    build_source_file(
        "RCRS Customer Portal & Service System",
        cs_sections,
        SOURCES_DIR / "customer-service" / "01-customer-portal.txt"
    )

    # Source 2: Communication & CRM
    comm_sections = {}
    if "jobnimbus-service.ts" in libs:
        comm_sections["JobNimbus CRM"] = libs["jobnimbus-service.ts"]
    if "google-calendar.ts" in libs:
        comm_sections["Google Calendar Integration"] = libs["google-calendar.ts"]
    if "docs/TROUBLESHOOTING.md" in docs:
        comm_sections["Troubleshooting Guide"] = docs["docs/TROUBLESHOOTING.md"]

    build_source_file(
        "RCRS Communication & CRM Systems",
        comm_sections,
        SOURCES_DIR / "customer-service" / "02-communication-crm.txt"
    )


def prepare_admin_deep_dive_sources():
    """Prepare sources for the Admin Deep Dive notebook."""
    print("\n[5/6] Preparing ADMIN DEEP DIVE sources...")

    docs = collect_markdown_docs()
    libs = collect_lib_services()

    # Source 1: Full Architecture
    arch_sections = {}
    if "lib/ARCHITECTURE.md" in docs:
        arch_sections["Architecture Documentation"] = docs["lib/ARCHITECTURE.md"]
    if "docs/SYSTEM-OVERVIEW.md" in docs:
        arch_sections["System Overview"] = docs["docs/SYSTEM-OVERVIEW.md"]
    if "docs/API-REFERENCE.md" in docs:
        arch_sections["API Reference"] = docs["docs/API-REFERENCE.md"]

    build_source_file(
        "RCRS Full System Architecture & API Reference",
        arch_sections,
        SOURCES_DIR / "admin-deep-dive" / "01-architecture.txt"
    )

    # Source 2: Security & Auth
    security_sections = {}
    if "auth-service.ts" in libs:
        security_sections["Authentication Service"] = libs["auth-service.ts"]
    if "team-roles.ts" in libs:
        security_sections["Team Roles & Permissions"] = libs["team-roles.ts"]
    if "docs/TEAM_ADMIN_GUIDE.md" in docs:
        security_sections["Team Admin Guide"] = docs["docs/TEAM_ADMIN_GUIDE.md"]

    build_source_file(
        "RCRS Security, Auth & Team Management",
        security_sections,
        SOURCES_DIR / "admin-deep-dive" / "02-security-auth.txt"
    )

    # Source 3: Data & Integrations
    data_sections = {}
    if "google-sheets-service.ts" in libs:
        data_sections["Google Sheets Service"] = libs["google-sheets-service.ts"]
    if "billing-service.ts" in libs:
        data_sections["Billing Service"] = libs["billing-service.ts"]
    for key in ["docs/GOOGLE_SHEETS_SETUP.md", "docs/GOOGLE_SHEETS_STRUCTURE.md",
                "docs/INTEGRATIONS.md", "docs/DEPLOYMENT_STRATEGY.md"]:
        if key in docs:
            data_sections[key] = docs[key]

    build_source_file(
        "RCRS Data Layer, Billing & Integration Deep Dive",
        data_sections,
        SOURCES_DIR / "admin-deep-dive" / "03-data-integrations.txt"
    )

    # Source 4: SEO & Marketing
    seo_sections = {}
    for key in ["docs/SEO_STRATEGY.md", "docs/COMPETITIVE_ANALYSIS.md",
                "docs/OPTIMIZATION_STRATEGY.md", "MASTER_STRATEGY.md"]:
        if key in docs:
            seo_sections[key] = docs[key]

    build_source_file(
        "RCRS SEO, Marketing & Optimization Strategy",
        seo_sections,
        SOURCES_DIR / "admin-deep-dive" / "04-seo-marketing.txt"
    )


def prepare_system_overview_sources():
    """Prepare a comprehensive system overview source."""
    print("\n[6/6] Preparing SYSTEM OVERVIEW sources...")

    docs = collect_markdown_docs()

    # Combine all docs into one mega overview
    all_sections = {}
    for key, val in sorted(docs.items()):
        all_sections[key] = val

    build_source_file(
        "RCRS Complete Documentation Index",
        all_sections,
        SOURCES_DIR / "system-overview" / "01-complete-docs.txt"
    )

    # Team data
    libs = collect_lib_services()
    if "teamData.ts" in libs:
        build_source_file(
            "RCRS Team Members & Organization",
            {"Team Data": libs["teamData.ts"]},
            SOURCES_DIR / "system-overview" / "02-team-data.txt"
        )


def generate_manifest():
    """Generate a JSON manifest of all prepared sources."""
    manifest = {
        "generated": datetime.now().isoformat(),
        "project": "River City Roofing Solutions",
        "notebooks": {}
    }

    for notebook_dir in sorted(SOURCES_DIR.iterdir()):
        if notebook_dir.is_dir():
            files = []
            for f in sorted(notebook_dir.glob("*.txt")):
                files.append({
                    "file": f.name,
                    "size_kb": round(f.stat().st_size / 1024, 1),
                    "path": str(f.relative_to(SOURCES_DIR))
                })
            if files:
                manifest["notebooks"][notebook_dir.name] = {
                    "source_count": len(files),
                    "total_size_kb": round(sum(f["size_kb"] for f in files), 1),
                    "files": files
                }

    manifest_path = SOURCES_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"\nManifest written to: {manifest_path}")
    return manifest


def main():
    print("=" * 60)
    print("RCRS NotebookLM Source Preparation")
    print(f"Project Root: {RCRS_ROOT}")
    print(f"Output Dir: {SOURCES_DIR}")
    print("=" * 60)

    prepare_sales_training_sources()
    prepare_onboarding_sources()
    prepare_field_ops_sources()
    prepare_customer_service_sources()
    prepare_admin_deep_dive_sources()
    prepare_system_overview_sources()

    manifest = generate_manifest()

    print("\n" + "=" * 60)
    print("SOURCE PREPARATION COMPLETE")
    print("=" * 60)
    for nb_name, nb_info in manifest["notebooks"].items():
        print(f"  {nb_name}: {nb_info['source_count']} sources ({nb_info['total_size_kb']} KB)")
    print(f"\nTotal notebooks: {len(manifest['notebooks'])}")
    print(f"\nNext step: Run `python generate_notebooks.py` to create NotebookLM notebooks")


if __name__ == "__main__":
    main()
