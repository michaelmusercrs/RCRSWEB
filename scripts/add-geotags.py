"""Add EXIF geotags, artist, and copyright to all JPEG images in public/uploads/."""
import os
import struct
import piexif

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'uploads')

# GPS coordinates: (lat, lon)
COORDS = {
    'decatur': (34.6059, -86.9833),
    'huntsville': (34.7304, -86.5861),
    'madison': (34.6993, -86.7483),
    'athens': (34.8026, -86.9717),
    'owens-crossroads': (34.5875, -86.4547),
    'hartselle': (34.4434, -86.9350),
    'cullman': (34.1748, -86.8436),
    'moulton': (34.4812, -87.2942),
    'florence': (34.7998, -87.6773),
    'north-alabama': (34.6059, -86.9833),
    'birmingham': (33.5207, -86.8025),
    'nashville': (36.1627, -86.7816),
    'albertville': (34.2676, -86.2089),
    'guntersville': (34.3581, -86.2947),
    'arab': (34.3181, -86.4958),
    'scottsboro': (34.6723, -86.0344),
    'fort-payne': (34.4443, -85.7197),
    'muscle-shoals': (34.7448, -87.6675),
    'meridianville': (34.8515, -86.5722),
    'hazel-green': (34.9315, -86.5680),
    'priceville': (34.5140, -86.8875),
    'somerville': (34.4726, -86.7994),
}

DEFAULT_COORDS = COORDS['decatur']  # blog-* and service-* default

def get_coords(filename):
    name = filename.lower().replace('.jpg', '').replace('.jpeg', '')
    if name.startswith('area-'):
        city = name[5:]
        # Handle special cases
        if city.startswith('huntsville'):
            return COORDS['huntsville']
        return COORDS.get(city, DEFAULT_COORDS)
    # blog-* and service-* → Decatur
    return DEFAULT_COORDS

def to_deg_min_sec(decimal):
    """Convert decimal degrees to (degrees, minutes, seconds) as rationals."""
    d = int(abs(decimal))
    m = int((abs(decimal) - d) * 60)
    s = int(((abs(decimal) - d) * 60 - m) * 60 * 10000)
    return ((d, 1), (m, 1), (s, 10000))

def make_gps_ifd(lat, lon):
    return {
        piexif.GPSIFD.GPSLatitudeRef: b'N' if lat >= 0 else b'S',
        piexif.GPSIFD.GPSLatitude: to_deg_min_sec(lat),
        piexif.GPSIFD.GPSLongitudeRef: b'W' if lon < 0 else b'E',
        piexif.GPSIFD.GPSLongitude: to_deg_min_sec(abs(lon)),
    }

def process_image(filepath):
    filename = os.path.basename(filepath)
    lat, lon = get_coords(filename)
    
    try:
        # Try to load existing EXIF
        try:
            exif_dict = piexif.load(filepath)
        except:
            exif_dict = {'0th': {}, '1st': {}, 'Exif': {}, 'GPS': {}, 'Interop': {}}
        
        # Add GPS
        exif_dict['GPS'] = make_gps_ifd(lat, lon)
        
        # Add artist and copyright
        exif_dict['0th'][piexif.ImageIFD.Artist] = 'River City Roofing Solutions'.encode()
        exif_dict['0th'][piexif.ImageIFD.Copyright] = '(c) 2026 River City Roofing Solutions'.encode()
        
        exif_bytes = piexif.dump(exif_dict)
        piexif.insert(exif_bytes, filepath)
        print(f'  OK {filename} -> ({lat}, {lon})')
        return True
    except Exception as e:
        print(f'  FAIL {filename}: {e}')
        return False

if __name__ == '__main__':
    files = [f for f in os.listdir(UPLOAD_DIR) 
             if f.lower().endswith(('.jpg', '.jpeg'))]
    files.sort()
    
    print(f'Processing {len(files)} JPEG files...\n')
    ok = 0
    for f in files:
        if process_image(os.path.join(UPLOAD_DIR, f)):
            ok += 1
    print(f'\nDone: {ok}/{len(files)} geotagged')
