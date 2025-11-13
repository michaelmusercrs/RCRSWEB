# STEP-BY-STEP: Implement New Color System + Build Location Pages

## STEP 1: Update Tailwind Configuration

**File:** `tailwind.config.ts` (in your Next.js project root)

Replace with the content from `tailwind-config-NEW.ts` created above.

This adds:
- `brand-black`, `brand-green`, `brand-grey`, `brand-blue` color utilities
- Proper semantic color mapping for Tailwind components
- Font family configuration

✅ Once done: All your existing pages should still work, but now you have new color utilities available.

---

## STEP 2: Create Location Pages

You already have these partially done:
- Decatur (page (11).tsx)
- Huntsville (page (12).tsx)
- Madison (page (14).tsx)
- Athens (page (5).tsx)
- Owens Crossroads (page (16).tsx)

**What to do:**

For each location, update the page using the `LocationPageTemplate-NEW.tsx` as a reference.

Key changes from old pages:
1. **Hero section**: Keep the overlay effect
2. **Services section**: Add icons with `text-brand-green` color
3. **Contact info section**: NEW - Add phone, hours, location cards with icons
4. **Why Choose Us section**: NEW - Add the blue background section with green checkmarks
5. **CTA section**: Update button colors to use new brand colors

### Example For Decatur:

```tsx
// page (11).tsx - UPDATE IT WITH NEW COLORS
// Location: /decatur or /locations/decatur

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Home, Wrench, ShieldCheck, Wind, MapPin, Phone, Clock } from 'lucide-react';

export default function DecaturPage() {
  return (
    <div className="bg-white">
      {/* Hero - Your existing image hero, update overlay to bg-black/50 */}
      <section className="relative w-full h-[60vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-black/50 z-10" />
        {/* Your StaticImage component */}
        <div className="z-20 container mx-auto px-4 text-center">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-4">
            Decatur Roofing Experts
          </h1>
          <p className="text-xl md:text-2xl text-white">
            Professional roofing solutions for your home
          </p>
        </div>
      </section>

      {/* Intro - WHITE BG */}
      <section className="py-16 md:py-24 bg-white">
        {/* BLACK headline, GREY body text */}
      </section>

      {/* Services - LIGHT GREY BG (bg-gray-50) */}
      <section className="py-16 md:py-24 bg-gray-50">
        {/* Use text-brand-green for icons */}
      </section>

      {/* Contact Info - WHITE BG */}
      <section className="py-16 md:py-24 bg-white">
        {/* NEW section with phone/hours/location */}
      </section>

      {/* Why Choose - ROYAL BLUE BG (bg-brand-blue) */}
      <section className="py-16 md:py-24 bg-brand-blue">
        {/* WHITE text, GREEN checkmarks */}
      </section>

      {/* CTA - WHITE BG */}
      <section className="py-16 md:py-24 bg-white">
        {/* GREEN left border, BLUE button */}
      </section>
    </div>
  );
}
```

---

## STEP 3: Copy/Customize For Each Location

### For DECATUR:
- Title: "Decatur Roofing Experts"
- Tagline: "Professional roofing solutions for your home"
- Hero image: location-decatur
- Main intro: "River City Roofing Solutions serves Decatur..."

### For HUNTSVILLE:
- Title: "Huntsville Roofing Contractor"
- Tagline: "Your Trusted Local Experts for Roof Repair & Replacement"
- Hero image: location-huntsville
- Update all Decatur references to Huntsville

### For MADISON:
- Title: "Madison Roofing Contractor"
- Tagline: "Community-Trusted Roofing for Madison Families & Businesses"
- Hero image: location-madison
- Update all Decatur references to Madison

### For ATHENS:
- Title: "Athens, AL Roofing Experts"
- Tagline: "Dependable Roofing Services for the Athens Community"
- Hero image: location-athens
- Update all Decatur references to Athens

### For OWENS CROSSROADS:
- Title: "Owens Crossroads Roofing"
- Tagline: "Professional Roofing for a Picturesque Community"
- Hero image: location-owens-crossroads
- Update all Decatur references to Owens Crossroads

---

## STEP 4: Update Contact Info For Each City

Change these based on service area (but keep main contact):
- Phone: (256) 274-8530 (SAME for all)
- Email: office@rcrsal.com (SAME for all)
- Hours: 24/7 Available (SAME for all)
- Base Location: 3325 Central Pkwy SW, Decatur, AL 35603 (SAME for all, but mention local service)

---

## COLOR REFERENCE - QUICK LOOKUP

```tsx
// TEXT
text-brand-black      // Main headlines, strong text
text-brand-blue       // Links, CTAs, interactive
text-gray-600         // Secondary text, descriptions
text-white            // On dark/blue backgrounds
text-brand-green      // Rare - only for special accents

// BACKGROUNDS
bg-white              // Default, cards
bg-gray-50            // Light grey sections
bg-brand-blue         // Feature sections (Why Choose)
bg-brand-green/10     // Light green icon backgrounds
bg-black/50           // Dark overlay on images

// BORDERS
border border-gray-200                        // Default
border-l-4 border-brand-green                 // Accent left
border-2 border-brand-black                   // Strong
hover:border-brand-blue hover:shadow-lg       // Card hover

// BUTTONS
bg-brand-blue hover:bg-blue-700 text-white font-bold              // Primary
border-2 border-brand-black text-brand-black hover:bg-black hover:text-white font-bold  // Secondary

// ICONS
text-brand-green        // On white/light backgrounds
text-white              // On blue backgrounds
bg-brand-green/10       // Light background around icon
```

---

## SECTION STRUCTURE CHECKLIST

For each location page:

- [ ] Hero section (image + black overlay + white text)
- [ ] Intro section (white bg, black headline, grey text)
- [ ] Services section (light grey bg, black headline, white cards with green icon bg)
- [ ] Contact info (white bg, 3 columns: phone, hours, location with icons)
- [ ] Why Choose Us (royal blue bg, white headline, green checkmarks, white text)
- [ ] CTA (white bg, green left border, black headline, blue + black buttons)

---

## TESTING CHECKLIST

After building each page:

- [ ] Mobile responsive (test on phone size)
- [ ] Colors match brand guide
- [ ] Text is readable (high contrast)
- [ ] Buttons are clickable and hover state works
- [ ] Icons display correctly
- [ ] Section backgrounds alternate properly
- [ ] No gradients (all solid colors)
- [ ] Images load correctly

---

## READY TO START?

1. Copy `tailwind-config-NEW.ts` → Replace `tailwind.config.ts`
2. Use `LocationPageTemplate-NEW.tsx` as your template
3. Update each location page one at a time
4. Reference `COLOR-SCHEME-GUIDE.md` when unsure about colors
5. Run `npm run dev` and preview in browser

You'll have:
✅ Professional, modern location pages
✅ Consistent brand identity
✅ All locations SEO-optimized
✅ Clean, high-contrast design
✅ Mobile responsive
✅ Ready for Vercel deployment

Let me know when you're ready to start building!
