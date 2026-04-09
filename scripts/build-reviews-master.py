#!/usr/bin/env python3
"""Build data/reviews-master.json from raw CSV exports in C:/Users/Michael/RCRS/data/.

Output schema matches lib/reviewsData.ts Review type so the loader can use it as fallback.
"""
import csv
import json
import hashlib
import os
from datetime import datetime
from collections import Counter

# Map raw rep names → canonical (slug, displayName).
# IMPORTANT: slugs MUST match teamData.ts so /team/[slug] links resolve.
# Most teamData entries use first-name slugs ("hunter", "aaron", "brendon").
# Adam Rudell is a 1099 sales rep — he's not in teamData.ts yet, so we use
# 'adam-rudell' which won't link to a profile but will still appear in the
# leaderboard (where no link is required).
REP_MAP = {
    # Adam Rudell — slug 'adam' in team-roles.ts. The "Rudy" nickname appears
    # in many reviews and refers to Adam Rudell (not the separate 'rudy' member).
    'adam rudell rudy': ('adam', 'Adam Rudell'),
    'adam rudell': ('adam', 'Adam Rudell'),
    'adam': ('adam', 'Adam Rudell'),
    'rudy': ('adam', 'Adam Rudell'),
    # Active reps with /team profiles
    'brendon muse': ('brendon', 'Brendon Muse'),
    'brendon': ('brendon', 'Brendon Muse'),
    'brenden': ('brendon', 'Brendon Muse'),
    'brenden muse': ('brendon', 'Brendon Muse'),
    'brandon muse': ('brendon', 'Brendon Muse'),
    'brandon': ('brendon', 'Brendon Muse'),
    'aaron lussi': ('aaron', 'Aaron Lussi'),
    'aaron': ('aaron', 'Aaron Lussi'),
    'hunter rivers': ('hunter', 'Hunter Rivers'),
    'hunter': ('hunter', 'Hunter Rivers'),
    'travis wages': ('travis', 'Travis Wages'),
    'travis': ('travis', 'Travis Wages'),
    'greg muse': ('greg', 'Greg Muse'),
    'greg': ('greg', 'Greg Muse'),
    'chris muse': ('chris-muse', 'Chris Muse'),
    'chris': ('chris-muse', 'Chris Muse'),
    'michael muse': ('michael-muse', 'Michael Muse'),
    'michael': ('michael-muse', 'Michael Muse'),
    'mike muse': ('michael-muse', 'Michael Muse'),
    'destin mccary': ('destin', 'Destin Mccary'),
    'destin': ('destin', 'Destin Mccary'),
    'sara hill': ('sara-hill', 'Sara Hill'),
    'sara': ('sara-hill', 'Sara Hill'),
    'tia muse morris': ('tia', 'Tia Muse Morris'),
    'tia': ('tia', 'Tia Muse Morris'),
    'bart roberts': ('bart', 'Bart Roberts'),
    'bart': ('bart', 'Bart Roberts'),
    'john cordonis': ('john', 'John Cordonis'),
    'john': ('john', 'John Cordonis'),
    'rick': ('rick', 'Rick'),
    'richard': ('richard', 'Richard Geahr'),
    'richard rick': ('rick', 'Rick'),
    'joseph dowd': ('joseph-dowd', 'Joseph Dowd'),
    'joseph': ('joseph-dowd', 'Joseph Dowd'),
    'alijah': ('alijah', 'Alijah'),
    # former employees - no profile pages
    'wess': ('wess-former', 'Wess (former)'),
    'wes': ('wess-former', 'Wess (former)'),
    'cozelos wess': ('wess-former', 'Cozelos Wess (former)'),
    'mj': ('mj-former', 'MJ (former)'),
    'mj michael': ('mj-former', 'MJ (former)'),
    'david thomas': ('david-thomas-former', 'David Thomas (former)'),
    'donnie dotson': ('donnie-dotson', 'Donnie Dotson'),
    'donnie': ('donnie-dotson', 'Donnie Dotson'),
    'reggie jackson': ('reggie-jackson', 'Reggie Jackson'),
    'reggie': ('reggie-jackson', 'Reggie Jackson'),
    'danny ray muse': ('danny-ray-muse', 'Danny Ray Muse'),
    'danny': ('danny-ray-muse', 'Danny Ray Muse'),
    'tae orr': ('tae', 'Tae Orr'),
    'tae': ('tae', 'Tae Orr'),
}

RATING_MAP = {
    'FIVE': 5, '5': 5, '5/5': 5, '5.0': 5,
    'FOUR': 4, '4': 4, '4/5': 4, '4.0': 4,
    'THREE': 3, '3': 3, '3/5': 3, '3.0': 3,
    'TWO': 2, '2': 2, '2/5': 2, '2.0': 2,
    'ONE': 1, '1': 1, '1/5': 1, '1.0': 1,
}


def parse_rating(s):
    s = (s or '').strip().upper()
    return RATING_MAP.get(s, 5)


def parse_rep(s):
    if not s:
        return (None, None)
    s = s.strip().lower()
    if not s or s == 'none' or s == 'n/a':
        return (None, None)
    return REP_MAP.get(s, (None, None))


def parse_date(s):
    if not s:
        return '2024-01-01'
    s = s.strip()
    try:
        return datetime.fromisoformat(s.replace('Z', '+00:00')).date().isoformat()
    except Exception:
        pass
    try:
        return datetime.strptime(s[:10], '%Y-%m-%d').date().isoformat()
    except Exception:
        pass
    return '2024-01-01'


def main():
    reviews = []
    seen = set()
    src_dir = 'C:/Users/Michael/RCRS/data'

    # Source 1: all_reviews_reps_verified.csv (cleanest, ISO dates)
    path1 = f'{src_dir}/all_reviews_reps_verified.csv'
    with open(path1, encoding='utf-8') as f:
        for r in csv.DictReader(f):
            text = (r.get('Review Summary', '') or '').strip()
            if not text:
                continue
            name = (r.get('Username', '') or 'Anonymous').strip()
            date = parse_date(r.get('Date', ''))
            rating = parse_rating(r.get('Rating', ''))
            rep_slug, rep_name = parse_rep(r.get('Sales Rep Mentioned', ''))
            key = f'{name.lower()}|{date}|{text[:50].lower()}'
            if key in seen:
                continue
            seen.add(key)
            rid = hashlib.md5(key.encode()).hexdigest()[:12]
            reviews.append({
                'id': rid,
                'name': name,
                'date': date,
                'rating': rating,
                'text': text,
                'salesRep': rep_name or '',
                'repSlug': rep_slug or '',
                'source': 'Google',
            })

    # Source 2: Reviews12-2025 - has explicit Source column
    path2 = f'{src_dir}/Reviews12-2025 - Reviews.csv'
    cols = ['Date', 'Username', 'Summary', 'SalesRep', 'Area', 'Service', 'Insurance', 'Rating', 'Source', 'SourceURL']
    with open(path2, encoding='utf-8') as f:
        for row in csv.reader(f):
            if len(row) < 8:
                continue
            r = dict(zip(cols, row))
            text = (r.get('Summary', '') or '').strip()
            if not text or text == 'Summary':
                continue
            name = (r.get('Username', '') or 'Anonymous').strip()
            if name == 'Username':
                continue
            date = parse_date(r.get('Date', ''))
            rating = parse_rating(r.get('Rating', ''))
            rep_slug, rep_name = parse_rep(r.get('SalesRep', ''))
            source = (r.get('Source', '') or 'Google').strip() or 'Google'
            if source == 'Source':
                source = 'Google'
            key = f'{name.lower()}|{date}|{text[:50].lower()}'
            if key in seen:
                continue
            seen.add(key)
            rid = hashlib.md5(key.encode()).hexdigest()[:12]
            reviews.append({
                'id': rid,
                'name': name,
                'date': date,
                'rating': rating,
                'text': text,
                'salesRep': rep_name or '',
                'repSlug': rep_slug or '',
                'source': source,
            })

    # Sort newest first
    reviews.sort(key=lambda r: r['date'], reverse=True)

    print(f'Total unique reviews: {len(reviews)}')
    print(f'5-star: {sum(1 for r in reviews if r["rating"] == 5)}')
    print(f'1-3 star: {sum(1 for r in reviews if r["rating"] <= 3)}')
    rep_counts = Counter(r['repSlug'] or '(unattributed)' for r in reviews)
    print(f'\nBy rep:')
    for slug, c in rep_counts.most_common(20):
        print(f'  {c:>4}  {slug}')

    os.makedirs('data', exist_ok=True)
    out = {
        'generated': datetime.now().isoformat(),
        'count': len(reviews),
        'fiveStarCount': sum(1 for r in reviews if r['rating'] == 5),
        'averageRating': round(sum(r['rating'] for r in reviews) / len(reviews), 2) if reviews else 0,
        'reviews': reviews,
    }
    with open('data/reviews-master.json', 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f'\nWrote data/reviews-master.json ({len(reviews)} reviews)')


if __name__ == '__main__':
    main()
