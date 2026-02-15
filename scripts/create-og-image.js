const sharp = require('sharp');
const path = require('path');

async function createOgImage() {
  const width = 1200;
  const height = 630;
  
  // Brand colors
  const bgDark = '#111111';
  const brandGreen = '#84cc16'; // lime-500
  const brandBlue = '#1e3a5f';
  
  const svg = `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${bgDark};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${brandBlue};stop-opacity:1" />
      </linearGradient>
    </defs>
    <!-- Background -->
    <rect width="${width}" height="${height}" fill="url(#bg)" />
    <!-- Green accent bar top -->
    <rect width="${width}" height="8" fill="${brandGreen}" />
    <!-- Green accent bar bottom -->
    <rect y="${height - 8}" width="${width}" height="8" fill="${brandGreen}" />
    <!-- Left accent stripe -->
    <rect x="60" y="180" width="6" height="270" fill="${brandGreen}" rx="3" />
    <!-- Company Name -->
    <text x="90" y="260" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="bold" fill="white">River City</text>
    <text x="90" y="345" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="bold" fill="${brandGreen}">Roofing Solutions</text>
    <!-- Tagline -->
    <text x="90" y="410" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#a3a3a3">Professional Roofing Services · North Alabama</text>
    <!-- Phone -->
    <text x="90" y="470" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="bold" fill="white">(256) 274-8530</text>
    <!-- Website -->
    <text x="90" y="520" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#a3a3a3">www.rivercityroofingsolutions.com</text>
    <!-- Roof icon (simple triangle) -->
    <polygon points="900,150 1100,150 1000,80" fill="${brandGreen}" opacity="0.3" />
    <polygon points="860,200 1140,200 1000,100" fill="none" stroke="${brandGreen}" stroke-width="3" opacity="0.5" />
  </svg>`;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(__dirname, '..', 'public', 'og-image.png'));
  
  console.log('Created public/og-image.png (1200x630)');
}

createOgImage().catch(console.error);
