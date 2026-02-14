# River City Roofing - New Color Scheme Visual Reference

## Color Palette

```
┌─────────────────────────────────────────────────────────────┐
│ PRIMARY BRAND COLORS (In Order of Use)                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ██████████ BLACK (#000000)                   Headlines      │
│  ██████████ NEON GREEN (#39FF14)              Accents        │
│  ██████████ GREY (#666666)                    Secondary      │
│  ██████████ WHITE (#FFFFFF)                   Background     │
│  ██████████ ROYAL BLUE (#0066CC)              Interactive    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Page Section Layout Example

```
═══════════════════════════════════════════════════════════════
                    SECTION 1: HERO
─────────────────────────────────────────────────────────────
  [BACKGROUND IMAGE with BLACK/60 OVERLAY]
  
  WHITE TEXT
  "Decatur Roofing Experts"
  
═══════════════════════════════════════════════════════════════
                    SECTION 2: INTRO
─────────────────────────────────────────────────────────────
  WHITE BACKGROUND
  
  BLACK HEADLINE
  "Trusted Roofing in Your Community"
  
  GREY BODY TEXT
  Professional roofing services description...
  
═══════════════════════════════════════════════════════════════
                    SECTION 3: SERVICES
─────────────────────────────────────────────────────────────
  LIGHT GREY BACKGROUND (#F5F5F5)
  
  BLACK HEADLINE
  "Our Services in Decatur"
  
  ┌──────────────────────┐  ┌──────────────────────┐
  │ [GREEN ICON BG]      │  │ [GREEN ICON BG]      │
  │    🏠                │  │    🔧                │
  │                      │  │                      │
  │ Roof Replacement     │  │ Roof Repair          │
  │ Grey description     │  │ Grey description     │
  │ (White card)         │  │ (White card)         │
  └──────────────────────┘  └──────────────────────┘
  
  ┌──────────────────────┐  ┌──────────────────────┐
  │ [GREEN ICON BG]      │  │ [GREEN ICON BG]      │
  │    ✓                 │  │    💨                │
  │                      │  │                      │
  │ Gutter Services      │  │ Insurance Claims     │
  │ Grey description     │  │ Grey description     │
  │ (White card)         │  │ (White card)         │
  └──────────────────────┘  └──────────────────────┘
  
═══════════════════════════════════════════════════════════════
                    SECTION 4: WHY CHOOSE US
─────────────────────────────────────────────────────────────
  ROYAL BLUE BACKGROUND (#0066CC)
  
  WHITE HEADLINE
  "Why Choose River City?"
  
  ✓ GREEN CHECKMARK  WHITE TEXT
  ✓ GREEN CHECKMARK  WHITE TEXT
  ✓ GREEN CHECKMARK  WHITE TEXT
  ✓ GREEN CHECKMARK  WHITE TEXT
  
═══════════════════════════════════════════════════════════════
                    SECTION 5: CTA
─────────────────────────────────────────────────────────────
  WHITE BACKGROUND
  
  ██ GREEN LEFT BORDER ACCENT
  BLACK HEADLINE
  "Ready to Get Started?"
  
  GREY BODY TEXT
  Request your free inspection today...
  
  [BLUE BUTTON] [BLACK OUTLINE BUTTON]
  Get Free     Call Us
  Inspection   Now
  
═══════════════════════════════════════════════════════════════
```

## Before vs After Comparison

### BEFORE (Mixed Colors)
- Inconsistent color application
- Some green on backgrounds (too bright)
- Unclear visual hierarchy
- No defined brand voice

### AFTER (Professional & Clean)
✅ Clear hierarchy: Black > Green > Blue > Grey > White
✅ Black text on white/light backgrounds (readable)
✅ Green used strategically (accents only)
✅ Blue for all interactive elements (buttons, links)
✅ Grey for secondary information
✅ Alternating section backgrounds for rhythm
✅ Modern, professional appearance
✅ Strong brand identity
✅ No gradients (clean lines)

## Button States

```
PRIMARY BUTTON
┌─────────────────────────────────────┐
│  NORMAL STATE: Blue background      │
│  Get Free Inspection                │
│  bg-brand-blue text-white           │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│  HOVER STATE: Darker blue           │
│  Get Free Inspection                │
│  bg-blue-700 text-white             │
└─────────────────────────────────────┘

SECONDARY BUTTON
┌─────────────────────────────────────┐
│  NORMAL STATE: Black border         │
│  Call Us Now                        │
│  border-2 border-brand-black        │
│  text-brand-black                   │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│  HOVER STATE: Inverse               │
│  Call Us Now                        │
│  bg-black text-white                │
└─────────────────────────────────────┘
```

## Icon Usage

```
ICON ON WHITE BACKGROUND
┌──────────┐
│ 🏠      │  Use: text-brand-green or text-brand-blue
│ Home     │  Optional background: bg-brand-green/10
└──────────┘

ICON ON GREY BACKGROUND  
┌──────────┐
│ 🔧      │  Use: text-brand-green or text-brand-blue
│ Repair   │  Optional background: bg-white/50 or bg-white
└──────────┘

ICON ON BLUE BACKGROUND
┌──────────┐
│ ✓       │  Use: text-brand-green (contrast!)
│ Benefit  │  Background: bg-brand-green (neon against blue)
└──────────┘
```

## Text Hierarchy

```
LEVEL 1 - PRIMARY HEADLINE
Black, Large, Bold, Headline Font
"Decatur Roofing Experts"
text-brand-black text-4xl md:text-5xl font-bold font-headline

LEVEL 2 - SUBHEADING
Black, Medium, Bold, Headline Font
"Trusted Roofing in Your Community"
text-brand-black text-2xl font-bold font-headline

LEVEL 3 - BODY TEXT
Grey, Regular, Body Font
"River City Roofing Solutions serves Decatur..."
text-gray-600 text-lg font-body

LEVEL 4 - SECONDARY/META
Lighter Grey, Small, Body Font
"2024 • ★★★★★ Reviews"
text-gray-500 text-sm font-body
```

## Accessibility Notes

✅ HIGH CONTRAST
- Black on white: WCAG AAA compliant
- White on blue: WCAG AA compliant
- All text readable and accessible

✅ COLOR BLIND FRIENDLY
- Don't rely solely on green for meaning
- Use checkmarks ✓, X, or other symbols
- Text labels always present

✅ NO GRADIENTS
- Solid colors only
- Cleaner, more modern
- Better readability

## Conversion Tips

When updating existing pages from OLD to NEW style:

1. Change all `text-primary` → Check context (usually `text-brand-blue` or `text-brand-black`)
2. Change all `bg-muted` → `bg-gray-50`
3. Change all `text-muted-foreground` → `text-gray-600`
4. Update button styles to use new brand colors
5. Ensure section backgrounds alternate: white → grey → blue → white
6. Add green accents strategically (left borders, icon backgrounds)
7. Test contrast ratios for accessibility

## Implementation Order

1. Update `tailwind.config.ts` with new color scheme
2. Create color utility classes for brand colors
3. Build location pages using new template
4. Update existing pages gradually
5. Test on mobile and desktop
6. Test with accessibility tools
