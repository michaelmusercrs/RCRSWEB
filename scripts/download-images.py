"""Download stock images from Unsplash for RCRS website."""
import urllib.request
import os
import time

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'uploads')

# Unsplash photo IDs mapped to our needs
# Format: filename -> unsplash photo ID
DOWNLOADS = {
    # Service area images
    'area-hartselle.jpg': 'photo-1570129477492-45c003edd2be',  # suburban neighborhood
    'area-cullman.jpg': 'photo-1560518883-ce09059eeffa',  # residential area
    'area-moulton.jpg': 'photo-1500382017468-9049fed747ef',  # rural countryside
    'area-florence.jpg': 'photo-1555396273-367ea4eb4db5',  # historic downtown
    
    # Service images
    'service-repair.jpg': 'photo-1632759145351-1d592919f522',  # roof work
    'service-inspection.jpg': 'photo-1504307651254-35680f356dfd',  # construction inspection
    'service-ventilation.jpg': 'photo-1558618666-fcd25c85f82e',  # attic/ventilation
    'service-emergency.jpg': 'photo-1523413555067-3f522b6de3e4',  # storm damage
    
    # Blog replacement images (top 20+ small PNGs)
    'blog-algae-moss.jpg': 'photo-1591778080940-93a3cf7b38af',  # mossy roof
    'blog-commercial-roofing.jpg': 'photo-1486406146926-c627a92ad1ab',  # commercial building
    'blog-diy-vs-professional.jpg': 'photo-1504307651254-35680f356dfd',  # professional worker
    'blog-energy-efficient.jpg': 'photo-1558618666-fcd25c85f82e',  # insulation
    'blog-gutters.jpg': 'photo-1594818379496-da1e345b0ded',  # gutters
    'blog-insurance-claims.jpg': 'photo-1450101499163-c8848e968838',  # document/inspection
    'blog-metal-roofing.jpg': 'photo-1510076857177-7470076d4098',  # metal roof
    'blog-chimney-caps-and-crowns.jpg': 'photo-1513584684374-8bab748fbf90',  # chimney
    'blog-choosing-contractor.jpg': 'photo-1581578731548-c64695cc6952',  # handshake/contractor
    'blog-flashing.jpg': 'photo-1632759145351-1d592919f522',  # roof detail
    'blog-flat-roof.jpg': 'photo-1486406146926-c627a92ad1ab',  # flat roof commercial
    'blog-hail-damage-assessment.jpg': 'photo-1523413555067-3f522b6de3e4',  # storm/hail
    'blog-historic-home.jpg': 'photo-1564013799919-ab600027ffc6',  # historic home
    'blog-impact-resistant.jpg': 'photo-1523413555067-3f522b6de3e4',  # storm protection
    'blog-inspection-checklist.jpg': 'photo-1504307651254-35680f356dfd',  # inspection
    'blog-leak-detection.jpg': 'photo-1585704032915-c3400ca199e7',  # water leak
    'blog-lifespan.jpg': 'photo-1570129477492-45c003edd2be',  # house exterior
    'blog-materials-compared.jpg': 'photo-1510076857177-7470076d4098',  # roofing materials
    'blog-new-construction.jpg': 'photo-1504615755583-2916b52192a3',  # new construction
    'blog-permits.jpg': 'photo-1450101499163-c8848e968838',  # paperwork
    'blog-preparing-replacement.jpg': 'photo-1632759145351-1d592919f522',  # roof prep
    'blog-questions.jpg': 'photo-1581578731548-c64695cc6952',  # consultation
    'blog-repair-vs-replacement.jpg': 'photo-1632759145351-1d592919f522',  # roof work
    'blog-replacement-timeline.jpg': 'photo-1504615755583-2916b52192a3',  # construction timeline
    'blog-roof-decking.jpg': 'photo-1504615755583-2916b52192a3',  # roof structure
    'blog-roofing-myths.jpg': 'photo-1570129477492-45c003edd2be',  # house
    'blog-roofing-safety.jpg': 'photo-1504307651254-35680f356dfd',  # safety equipment
    'blog-roof-valleys.jpg': 'photo-1632759145351-1d592919f522',  # roof details
    'blog-shingle-colors.jpg': 'photo-1570129477492-45c003edd2be',  # house with shingles
    'blog-skylights.jpg': 'photo-1558618666-fcd25c85f82e',  # skylight/attic
    'blog-smart-roof-technology.jpg': 'photo-1558618666-fcd25c85f82e',  # technology
    'blog-soffits-fascia.jpg': 'photo-1570129477492-45c003edd2be',  # house detail
    'blog-spring-inspection.jpg': 'photo-1504307651254-35680f356dfd',  # inspection
    'blog-summer-roof-care.jpg': 'photo-1570129477492-45c003edd2be',  # summer house
    'blog-terminology.jpg': 'photo-1632759145351-1d592919f522',  # roof
    'blog-ventilation.jpg': 'photo-1558618666-fcd25c85f82e',  # ventilation
    'blog-warranties.jpg': 'photo-1450101499163-c8848e968838',  # documents
    'blog-wind-damage.jpg': 'photo-1523413555067-3f522b6de3e4',  # wind/storm
    'blog-winter-maintenance.jpg': 'photo-1516402707257-e5e02c0aab85',  # winter house
    'blog-commercial-vs-residential.jpg': 'photo-1486406146926-c627a92ad1ab',  # commercial
    'blog-emergency-repair.jpg': 'photo-1523413555067-3f522b6de3e4',  # emergency
    'blog-fall-maintenance.jpg': 'photo-1570129477492-45c003edd2be',  # fall house
    'blog-family-owned-roofer.jpg': 'photo-1581578731548-c64695cc6952',  # family business
    'blog-owens-vs-iko.jpg': 'photo-1510076857177-7470076d4098',  # shingles
    'blog-2026-storm-prep.jpg': 'photo-1523413555067-3f522b6de3e4',  # storm prep
    'blog-alabama-building-codes-2026.jpg': 'photo-1450101499163-c8848e968838',  # codes/docs
    'blog-spring-2026-checklist.jpg': 'photo-1504307651254-35680f356dfd',  # checklist
    'blog-valentines-home-care.jpg': 'photo-1564013799919-ab600027ffc6',  # cozy home
    'blog-roof-financing-options-2026.jpg': 'photo-1450101499163-c8848e968838',  # finance
}

def download(filename, photo_id):
    path = os.path.join(UPLOAD_DIR, filename)
    if os.path.exists(path) and os.path.getsize(path) > 50000:
        print(f'  SKIP {filename} (already exists, {os.path.getsize(path)} bytes)')
        return True
    url = f'https://images.unsplash.com/{photo_id}?w=1200&q=80'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        data = resp.read()
        with open(path, 'wb') as f:
            f.write(data)
        print(f'  OK {filename} ({len(data)} bytes)')
        return True
    except Exception as e:
        print(f'  FAIL {filename}: {e}')
        return False

if __name__ == '__main__':
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    total = len(DOWNLOADS)
    ok = 0
    for i, (fname, pid) in enumerate(DOWNLOADS.items()):
        print(f'[{i+1}/{total}] {fname}')
        if download(fname, pid):
            ok += 1
        time.sleep(0.3)  # be nice
    print(f'\nDone: {ok}/{total} succeeded')
