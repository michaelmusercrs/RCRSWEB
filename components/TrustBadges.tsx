import Link from 'next/link';
import Image from 'next/image';

/* ─────────────────────────────────────────────────────────────────────
 *  TrustBadges — BBB A+, Certifications, Awards
 *  
 *  LOGO FILES: Place official logos in /public/logos/ and update the
 *  <Image> src paths. Current implementation uses high-fidelity SVG
 *  recreations matching official brand guidelines.
 *  
 *  To swap in real logos:
 *    /public/logos/bbb-a-plus.png
 *    /public/logos/iko-craftsman-premier.png  
 *    /public/logos/owens-corning-preferred.png
 *    /public/logos/decatur-daily-best.png
 *    /public/logos/leafx.png
 *    /public/logos/procat.png
 *    /public/logos/boral.png
 * ───────────────────────────────────────────────────────────────────── */

/* ═══ BBB A+ Accredited Business Badge ═══ */
function BBBBadge({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center group ${className}`}>
      <a
        href="https://www.bbb.org/us/al/decatur/profile/roofing-contractors/river-city-roofing-solutions-llc-0463-90137393"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="BBB A+ Accredited Business"
        className="block"
      >
        <div className="w-[140px] h-[54px] md:w-[170px] md:h-[65px] relative">
          {/* Official-style BBB horizontal seal */}
          <svg viewBox="0 0 340 130" className="w-full h-full" role="img" aria-label="BBB A+ Accredited Business">
            {/* Background */}
            <rect width="340" height="130" rx="6" fill="#00529B" />
            
            {/* Left section - BBB torch */}
            <rect x="0" y="0" width="95" height="130" rx="6" fill="#003B6F" />
            {/* Torch flame */}
            <ellipse cx="48" cy="28" rx="10" ry="14" fill="#F7941D" />
            <ellipse cx="48" cy="26" rx="6" ry="9" fill="#FDB913" />
            <ellipse cx="48" cy="24" rx="3" ry="5" fill="#FFFFFF" opacity="0.8" />
            {/* Torch handle */}
            <rect x="45" y="40" width="6" height="30" rx="2" fill="#F7941D" />
            {/* Torch base */}
            <rect x="38" y="68" width="20" height="4" rx="2" fill="#F7941D" />
            {/* BBB letters */}
            <text x="48" y="95" textAnchor="middle" fill="white" fontSize="18" fontWeight="900" fontFamily="Arial, Helvetica, sans-serif" letterSpacing="1">BBB</text>
            
            {/* Right section - Rating info */}
            {/* Accredited Business text */}
            <text x="115" y="30" fill="white" fontSize="11" fontFamily="Arial, Helvetica, sans-serif" fontWeight="400" letterSpacing="0.5">ACCREDITED</text>
            <text x="115" y="46" fill="white" fontSize="11" fontFamily="Arial, Helvetica, sans-serif" fontWeight="400" letterSpacing="0.5">BUSINESS</text>
            
            {/* Divider line */}
            <line x1="110" y1="56" x2="320" y2="56" stroke="white" strokeWidth="0.5" opacity="0.4" />
            
            {/* Rating row */}
            <text x="115" y="78" fill="white" fontSize="12" fontFamily="Arial, Helvetica, sans-serif" opacity="0.8">Rating:</text>
            <rect x="170" y="64" width="50" height="22" rx="3" fill="#F7941D" />
            <text x="195" y="80" textAnchor="middle" fill="white" fontSize="16" fontWeight="900" fontFamily="Arial, Helvetica, sans-serif">A+</text>
            
            {/* As of date */}
            <text x="115" y="100" fill="white" fontSize="9" fontFamily="Arial, Helvetica, sans-serif" opacity="0.6">As of {new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</text>
            
            {/* Click for Profile text */}
            <text x="115" y="118" fill="#8FBFE0" fontSize="9" fontFamily="Arial, Helvetica, sans-serif">Click for Profile</text>
          </svg>
        </div>
      </a>
    </div>
  );
}

/* ═══ IKO ROOFPRO Craftsman Premier — MAIN PRODUCT, PROMINENT ═══ */
function IKOCraftsmanPremier({ className = '', prominent = false }: { className?: string; prominent?: boolean }) {
  const size = prominent 
    ? 'w-[180px] h-[180px] md:w-[220px] md:h-[220px]' 
    : 'w-[130px] h-[130px] md:w-[160px] md:h-[160px]';
  
  // TODO: Replace with RCRS's actual IKO ROOFPRO profile URL once available
  const ikoProfileUrl = 'https://www.iko.com/na/roofpro/';

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <a href={ikoProfileUrl} target="_blank" rel="noopener noreferrer" aria-label="IKO ROOFPRO Craftsman Premier Contractor" className="block">
      <div className={`${size} relative`}>
        <svg viewBox="0 0 300 300" className="w-full h-full" role="img" aria-label="IKO ROOFPRO Craftsman Premier Contractor">
          {/* Outer ring - dark navy */}
          <circle cx="150" cy="150" r="145" fill="#0A1628" stroke="#C9A84C" strokeWidth="3" />
          {/* Inner gold ring */}
          <circle cx="150" cy="150" r="130" fill="none" stroke="#C9A84C" strokeWidth="1.5" />
          {/* Inner dark circle */}
          <circle cx="150" cy="150" r="125" fill="#0D1F3C" />
          
          {/* Top arc text - ROOFPRO */}
          <defs>
            <path id="topArc" d="M 60,150 A 90,90 0 0,1 240,150" fill="none" />
            <path id="bottomArc" d="M 60,160 A 90,90 0 0,0 240,160" fill="none" />
          </defs>
          <text fill="#C9A84C" fontSize="13" fontWeight="700" fontFamily="Arial, sans-serif" letterSpacing="4">
            <textPath href="#topArc" startOffset="50%" textAnchor="middle">ROOFPRO®</textPath>
          </text>
          
          {/* Stars row */}
          <text x="150" y="85" textAnchor="middle" fill="#C9A84C" fontSize="14" letterSpacing="2">★ ★ ★ ★ ★</text>
          
          {/* IKO Logo */}
          <text x="150" y="125" textAnchor="middle" fill="white" fontSize="48" fontWeight="900" fontFamily="Arial Black, Arial, sans-serif" letterSpacing="6">IKO</text>
          
          {/* Divider lines */}
          <line x1="70" y1="138" x2="120" y2="138" stroke="#C9A84C" strokeWidth="1" />
          <line x1="180" y1="138" x2="230" y2="138" stroke="#C9A84C" strokeWidth="1" />
          <text x="150" y="143" textAnchor="middle" fill="#C9A84C" fontSize="8">◆</text>
          
          {/* CRAFTSMAN */}
          <text x="150" y="168" textAnchor="middle" fill="white" fontSize="20" fontWeight="700" fontFamily="Arial, sans-serif" letterSpacing="5">CRAFTSMAN</text>
          
          {/* PREMIER */}
          <text x="150" y="195" textAnchor="middle" fill="#C9A84C" fontSize="24" fontWeight="900" fontFamily="Arial, sans-serif" letterSpacing="6">PREMIER</text>
          
          {/* Bottom arc - CERTIFIED CONTRACTOR */}
          <text fill="white" fontSize="11" fontWeight="400" fontFamily="Arial, sans-serif" letterSpacing="3" opacity="0.8">
            <textPath href="#bottomArc" startOffset="50%" textAnchor="middle">CERTIFIED CONTRACTOR</textPath>
          </text>
          
          {/* Bottom accent */}
          <line x1="100" y1="245" x2="200" y2="245" stroke="#C9A84C" strokeWidth="1" />
        </svg>
      </div>
      </a>
      {prominent && (
        <span className="text-sm md:text-base text-brand-green font-bold uppercase tracking-widest mt-2">
          IKO&apos;s Highest Tier
        </span>
      )}
    </div>
  );
}

/* ═══ Owens Corning Preferred Contractor ═══ */
function OwensCorningPreferred({ className = '' }: { className?: string }) {
  // TODO: Replace with RCRS's actual Owens Corning Preferred Contractor profile URL
  const ocProfileUrl = 'https://www.owenscorning.com/en-us/roofing/contractors';

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <a href={ocProfileUrl} target="_blank" rel="noopener noreferrer" aria-label="Owens Corning Preferred Contractor" className="block">
      <div className="w-[130px] h-[130px] md:w-[150px] md:h-[150px] relative">
        <svg viewBox="0 0 300 300" className="w-full h-full" role="img" aria-label="Owens Corning Preferred Contractor">
          {/* Background - OC signature pink/coral */}
          <rect width="300" height="300" rx="12" fill="#E4006F" />
          
          {/* OC text/logo area */}
          <text x="150" y="70" textAnchor="middle" fill="white" fontSize="16" fontWeight="400" fontFamily="Arial, sans-serif" letterSpacing="1">OWENS CORNING</text>
          
          {/* Divider */}
          <line x1="50" y1="85" x2="250" y2="85" stroke="white" strokeWidth="0.5" opacity="0.5" />
          
          {/* Panther silhouette placeholder / shield icon */}
          <text x="150" y="140" textAnchor="middle" fill="white" fontSize="50" opacity="0.15">🏠</text>
          
          {/* PREFERRED */}
          <text x="150" y="170" textAnchor="middle" fill="white" fontSize="28" fontWeight="900" fontFamily="Arial, sans-serif" letterSpacing="3">PREFERRED</text>
          
          {/* CONTRACTOR */}
          <text x="150" y="200" textAnchor="middle" fill="white" fontSize="20" fontWeight="400" fontFamily="Arial, sans-serif" letterSpacing="4">CONTRACTOR</text>
          
          {/* Bottom detail */}
          <line x1="80" y1="215" x2="220" y2="215" stroke="white" strokeWidth="0.5" opacity="0.5" />
          
          {/* Tagline */}
          <text x="150" y="245" textAnchor="middle" fill="white" fontSize="10" fontFamily="Arial, sans-serif" opacity="0.8" letterSpacing="1">ROOFING CONTRACTOR NETWORK</text>
          
          {/* Checkmark */}
          <circle cx="150" cy="270" r="10" fill="white" opacity="0.2" />
          <text x="150" y="275" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">✓</text>
        </svg>
      </div>
      </a>
      <span className="text-[10px] md:text-xs text-gray-400 mt-1 text-center font-semibold uppercase tracking-wider">
        Preferred Contractor
      </span>
    </div>
  );
}

/* ═══ Decatur Daily — Best of the Best of the Tennessee Valley ═══ */
function BestOfBestBadge({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="relative w-[160px] h-[160px] md:w-[200px] md:h-[200px]">
        <svg viewBox="0 0 400 400" className="w-full h-full" role="img" aria-label="Decatur Daily Best of the Best of the Tennessee Valley - 4 Years Running">
          {/* Outer laurel wreath left */}
          <g transform="translate(200,200)" opacity="0.9">
            {/* Left laurel */}
            {[...Array(8)].map((_, i) => (
              <ellipse
                key={`ll${i}`}
                cx={-120 + i * 3}
                cy={-60 + i * 18}
                rx="12"
                ry="22"
                transform={`rotate(${-30 + i * 8})`}
                fill="none"
                stroke="#C9A84C"
                strokeWidth="1.5"
              />
            ))}
            {/* Right laurel */}
            {[...Array(8)].map((_, i) => (
              <ellipse
                key={`rl${i}`}
                cx={120 - i * 3}
                cy={-60 + i * 18}
                rx="12"
                ry="22"
                transform={`rotate(${30 - i * 8})`}
                fill="none"
                stroke="#C9A84C"
                strokeWidth="1.5"
              />
            ))}
          </g>
          
          {/* Central medallion */}
          <circle cx="200" cy="200" r="140" fill="#1a1a1a" stroke="#C9A84C" strokeWidth="4" />
          <circle cx="200" cy="200" r="130" fill="none" stroke="#C9A84C" strokeWidth="1" opacity="0.5" />
          <circle cx="200" cy="200" r="125" fill="#111" />
          
          {/* THE DECATUR DAILY */}
          <text x="200" y="105" textAnchor="middle" fill="#C9A84C" fontSize="11" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" letterSpacing="1">THE DECATUR DAILY</text>
          
          {/* Divider */}
          <line x1="120" y1="115" x2="280" y2="115" stroke="#C9A84C" strokeWidth="0.8" opacity="0.6" />
          
          {/* BEST OF THE BEST */}
          <text x="200" y="148" textAnchor="middle" fill="white" fontSize="22" fontWeight="900" fontFamily="Arial, sans-serif" letterSpacing="2">BEST OF THE</text>
          <text x="200" y="178" textAnchor="middle" fill="#C9A84C" fontSize="28" fontWeight="900" fontFamily="Arial, sans-serif" letterSpacing="3">BEST</text>
          
          {/* OF THE TENNESSEE VALLEY */}
          <text x="200" y="205" textAnchor="middle" fill="white" fontSize="11" fontFamily="Arial, sans-serif" letterSpacing="2" opacity="0.85">OF THE TENNESSEE VALLEY</text>
          
          {/* Star divider */}
          <text x="200" y="225" textAnchor="middle" fill="#C9A84C" fontSize="10" letterSpacing="6">★ ★ ★</text>
          
          {/* 4 YEARS IN A ROW */}
          <rect x="115" y="235" width="170" height="28" rx="4" fill="#C9A84C" />
          <text x="200" y="255" textAnchor="middle" fill="#1a1a1a" fontSize="14" fontWeight="900" fontFamily="Arial, sans-serif" letterSpacing="1">4 YEARS IN A ROW</text>
          
          {/* Years */}
          <text x="200" y="285" textAnchor="middle" fill="white" fontSize="11" fontFamily="Arial, sans-serif" letterSpacing="2" opacity="0.8">2022 · 2023 · 2024 · 2025</text>
          
          {/* Bottom ribbon text */}
          <text x="200" y="310" textAnchor="middle" fill="#C9A84C" fontSize="9" fontFamily="Georgia, serif" fontStyle="italic" letterSpacing="1" opacity="0.7">Reader&apos;s Choice Award</text>
        </svg>
      </div>
    </div>
  );
}

/* ═══ LeafX Gutter Protection ═══ */
function LeafXLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="w-[110px] h-[55px] md:w-[130px] md:h-[65px] flex items-center justify-center">
        <svg viewBox="0 0 260 120" className="w-full h-auto" role="img" aria-label="LeafX Gutter Guards - Authorized Dealer">
          <rect width="260" height="120" rx="8" fill="#1A5C2A" />
          {/* Leaf icon */}
          <path d="M30,60 Q30,30 55,25 Q45,50 55,70 Q35,65 30,60Z" fill="#39FF14" opacity="0.6" />
          <text x="75" y="52" fill="white" fontSize="30" fontWeight="800" fontFamily="Arial, sans-serif">Leaf</text>
          <text x="170" y="52" fill="#39FF14" fontSize="30" fontWeight="900" fontFamily="Arial, sans-serif">X</text>
          <text x="130" y="78" textAnchor="middle" fill="white" fontSize="11" fontFamily="Arial, sans-serif" letterSpacing="2" opacity="0.9">GUTTER PROTECTION</text>
          <line x1="40" y1="88" x2="220" y2="88" stroke="#39FF14" strokeWidth="0.5" opacity="0.4" />
          <text x="130" y="105" textAnchor="middle" fill="#39FF14" fontSize="9" fontFamily="Arial, sans-serif" letterSpacing="2">AUTHORIZED DEALER</text>
        </svg>
      </div>
      <span className="text-[10px] md:text-xs text-gray-400 mt-1 text-center font-semibold uppercase tracking-wider">
        LeafX Dealer
      </span>
    </div>
  );
}

/* ═══ ProCat ═══ */
function ProCatLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="w-[110px] h-[55px] md:w-[130px] md:h-[65px] flex items-center justify-center">
        <svg viewBox="0 0 260 120" className="w-full h-auto" role="img" aria-label="ProCat Professional Equipment">
          <rect width="260" height="120" rx="8" fill="#1E1E1E" stroke="#333" strokeWidth="1" />
          <text x="130" y="45" textAnchor="middle" fill="#FF6B00" fontSize="32" fontWeight="900" fontFamily="Arial, sans-serif" letterSpacing="2">ProCat</text>
          <line x1="50" y1="58" x2="210" y2="58" stroke="#FF6B00" strokeWidth="0.8" opacity="0.5" />
          <text x="130" y="78" textAnchor="middle" fill="white" fontSize="11" fontFamily="Arial, sans-serif" letterSpacing="3" opacity="0.8">PROFESSIONAL</text>
          <text x="130" y="98" textAnchor="middle" fill="white" fontSize="11" fontFamily="Arial, sans-serif" letterSpacing="3" opacity="0.8">EQUIPMENT</text>
        </svg>
      </div>
      <span className="text-[10px] md:text-xs text-gray-400 mt-1 text-center font-semibold uppercase tracking-wider">
        ProCat
      </span>
    </div>
  );
}

/* ═══ Boral ═══ */
function BoralLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="w-[110px] h-[55px] md:w-[130px] md:h-[65px] flex items-center justify-center">
        <svg viewBox="0 0 260 120" className="w-full h-auto" role="img" aria-label="Boral Roofing Products">
          <rect width="260" height="120" rx="8" fill="#7B1818" />
          <text x="130" y="55" textAnchor="middle" fill="white" fontSize="38" fontWeight="700" fontFamily="Arial, sans-serif" letterSpacing="6">BORAL</text>
          <line x1="60" y1="68" x2="200" y2="68" stroke="white" strokeWidth="0.5" opacity="0.3" />
          <text x="130" y="90" textAnchor="middle" fill="#FFB6B6" fontSize="11" fontFamily="Arial, sans-serif" letterSpacing="3" opacity="0.8">ROOFING PRODUCTS</text>
        </svg>
      </div>
      <span className="text-[10px] md:text-xs text-gray-400 mt-1 text-center font-semibold uppercase tracking-wider">
        Boral
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  Main TrustBadges Component
 * ═══════════════════════════════════════════════════════════════════ */

interface TrustBadgesProps {
  variant?: 'full' | 'compact' | 'footer' | 'hero';
  showAward?: boolean;
  showBBB?: boolean;
  showPartners?: boolean;
  className?: string;
}

export default function TrustBadges({
  variant = 'full',
  showAward = true,
  showBBB = true,
  showPartners = true,
  className = '',
}: TrustBadgesProps) {

  /* ─── Footer: compact horizontal strip ─── */
  if (variant === 'footer') {
    return (
      <div className={className}>
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
          {showBBB && <BBBBadge />}
          <IKOCraftsmanPremier className="scale-75" />
          <OwensCorningPreferred className="scale-90" />
          {showAward && <BestOfBestBadge className="scale-[0.55]" />}
          <BoralLogo />
        </div>
      </div>
    );
  }

  /* ─── Compact: fewer items, inline ─── */
  if (variant === 'compact') {
    return (
      <div className={`flex flex-wrap items-center justify-center gap-6 md:gap-10 ${className}`}>
        <IKOCraftsmanPremier />
        {showBBB && <BBBBadge />}
        <OwensCorningPreferred className="scale-90" />
        {showAward && <BestOfBestBadge className="scale-[0.55]" />}
      </div>
    );
  }

  /* ─── Hero: just the key badges ─── */
  if (variant === 'hero') {
    return (
      <div className={`flex items-center justify-center gap-6 md:gap-8 opacity-90 ${className}`}>
        <BBBBadge />
        <IKOCraftsmanPremier className="scale-75" />
        <BestOfBestBadge className="scale-[0.45]" />
      </div>
    );
  }

  /* ─── Full: complete section with heading ─── */
  return (
    <section className={`py-12 md:py-16 px-6 bg-black/85 backdrop-blur-sm border-t border-neutral-800 ${className}`}>
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-10">
          <span className="text-xs uppercase tracking-widest font-bold text-brand-green">Trusted &amp; Certified</span>
          <h2 className="text-3xl md:text-4xl font-black uppercase tracking-wider mt-2 text-white">
            Our Certifications &amp; Awards
          </h2>
          <p className="text-neutral-400 mt-2 max-w-xl mx-auto">
            Recognized by the industry&apos;s most trusted organizations
          </p>
        </div>

        {/* Award — Featured Center */}
        {showAward && (
          <div className="flex justify-center mb-8">
            <BestOfBestBadge />
          </div>
        )}

        {/* IKO Featured — Main Product */}
        <div className="flex justify-center mb-10">
          <IKOCraftsmanPremier prominent />
        </div>

        {/* Remaining Certifications */}
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14">
          {showBBB && <BBBBadge />}
          <OwensCorningPreferred />
          <LeafXLogo />
          <ProCatLogo />
          <BoralLogo />
        </div>
      </div>
    </section>
  );
}

/* Named exports for individual use */
export { BBBBadge, BestOfBestBadge, IKOCraftsmanPremier, OwensCorningPreferred, LeafXLogo, ProCatLogo, BoralLogo };
