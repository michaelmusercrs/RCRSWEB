# River City Roofing Solutions - Color System Guide

## Primary Brand Colors (Use in order of visual hierarchy)

### 1. BLACK (#000000)
- **Usage**: Headlines, primary text, borders, heavy accents
- **Tailwind**: `text-brand-black`, `bg-brand-black`, `border-brand-black`
- **HTML**: `#000000`
- **When to use**: 
  - Page titles and headers
  - Body copy on light backgrounds
  - Primary text content
  - Strong borders and dividers

### 2. NEON GREEN (#39FF14) - LOGO COLOR
- **Usage**: Accent elements, highlights, call-to-action accents, hover states
- **Tailwind**: `text-brand-green`, `bg-brand-green`, `border-brand-green`
- **HTML**: `#39FF14`
- **When to use**:
  - Small accent borders (left borders, underlines)
  - Icon backgrounds (light 10% opacity: bg-brand-green/10)
  - Checkmarks and badges
  - Hover effects on buttons
  - Service icons
  - Special highlights
  - NOT: Never use as main button background (too bright)

### 3. GREY (#404040 or #666666 variations)
- **Usage**: Secondary text, subtle backgrounds, borders, muted elements
- **Tailwind**: `text-gray-600` for medium grey, `text-gray-700` for dark grey
- **HTML**: 
  - Dark grey: `#404040`
  - Medium grey: `#666666`
  - Light grey: `#F5F5F5` (bg-gray-50)
  - Border grey: `#E0E0E0`
- **When to use**:
  - Secondary text (descriptions, meta info)
  - Card borders
  - Background sections (use light grey)
  - Disabled states
  - Icons on white backgrounds

### 4. WHITE (#FFFFFF)
- **Usage**: Primary background, card surfaces, text on dark
- **Tailwind**: `bg-white`, `text-white`
- **HTML**: `#FFFFFF`
- **When to use**:
  - Main page background
  - Card backgrounds
  - Text on dark backgrounds
  - High contrast areas

### 5. ROYAL BLUE (#0066CC)
- **Usage**: Primary interactive elements, buttons, links, hover states
- **Tailwind**: `text-brand-blue`, `bg-brand-blue`, `border-brand-blue`
- **Also use**: `primary` class for buttons and interactive elements
- **HTML**: `#0066CC`
- **When to use**:
  - Call-to-action buttons
  - Links and navigation
  - Primary section backgrounds (dark sections)
  - Focus rings on form elements
  - Hover states on links
  - Large background sections

## Color Hierarchy for Layout

```
Section 1 (Hero): Black text on white
  ↓ (Image overlay: black/60 opacity)
  
Section 2 (Intro): Black text on white

Section 3 (Services): Black text on light grey (bg-gray-50)
  Cards: White cards with grey borders

Section 4 (Blue section): White text on royal blue (#0066CC)
  Accents: Neon green checkmarks

Section 5 (CTA): Black text on white
  Border accent: Green left border
  Button: Blue background
```

## Component-Specific Colors

### Buttons
- **Primary Button**: `bg-brand-blue text-white` → Hover: `bg-blue-700`
- **Secondary Button**: `border-2 border-brand-black text-brand-black` → Hover: `bg-black text-white`
- **Accent Button**: Don't use green as button background (too bright)

### Cards
- **Default**: `bg-white border border-gray-200`
- **Hover**: Add `hover:border-brand-blue hover:shadow-lg`

### Icons
- **On white**: `text-brand-green` or `text-brand-blue`
- **On blue**: `text-brand-green`
- **Backgrounds**: `bg-brand-green/10` (light green) or `bg-blue-50` (light blue)

### Text
- **Primary**: `text-brand-black`
- **Secondary**: `text-gray-600`
- **Tertiary**: `text-gray-500`
- **On dark backgrounds**: `text-white` or `text-blue-100`

### Borders
- **Default**: `border-gray-200`
- **Accent**: `border-brand-green` (left borders, special borders)
- **Dark**: `border-brand-black`

### Backgrounds - Alternating Pattern
1. White (`bg-white`)
2. Light grey (`bg-gray-50`)
3. Royal blue (`bg-brand-blue`)
4. White (`bg-white`)
5. Repeat...

## Do's and Don'ts

✅ DO:
- Use green as accent/highlight only
- Alternate section backgrounds
- Keep text black on white/light backgrounds
- Use blue for interactive elements
- Use grey for secondary information
- Maintain high contrast for accessibility

❌ DON'T:
- Use green for large background areas
- Use gradients (you specified modern, clean, NO gradients)
- Mix too many colors in one section
- Use light grey text on white
- Use decorative colors without purpose
- Pile too much accent color together

## Tailwind CSS Classes Summary

```tsx
// Text colors
className="text-brand-black"      // Titles, main text
className="text-brand-blue"       // Links, CTAs
className="text-brand-green"      // Accents (rare)
className="text-gray-600"         // Secondary text
className="text-white"            // On dark backgrounds

// Background colors
className="bg-white"              // Default
className="bg-gray-50"            // Alternate sections
className="bg-brand-blue"         // Feature sections
className="bg-brand-green/10"     // Icon backgrounds (light)
className="bg-blue-50"            // Light blue backgrounds

// Borders
className="border border-gray-200"
className="border-l-4 border-brand-green"  // Accent border

// Buttons
className="bg-brand-blue hover:bg-blue-700 text-white"
className="border-2 border-brand-black text-brand-black hover:bg-black hover:text-white"

// Cards
className="border border-gray-200 hover:border-brand-blue hover:shadow-lg transition-all"
```

## Example: Location Page Sections

1. **Hero**: Black text, white text on black overlay
2. **Intro**: Black title, grey body text on white
3. **Services**: Black title, grey descriptions on light grey background
4. **Why Choose**: White text on royal blue background, green checkmarks
5. **CTA**: Black title, grey body on white, blue button, green left border

This creates a professional, modern look with clear visual hierarchy!
