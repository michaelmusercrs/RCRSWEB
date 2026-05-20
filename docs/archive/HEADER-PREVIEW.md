# Header Component - Visual Preview

## Desktop View (Wide Screen)
```
┌────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│  [🟢 LOGO]    Services    Team    About    Contact    📞 (256) 274-8530  [Free Inspection] │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Desktop Features:
- **Logo**: Neon green circle (80x80px) - clickable, goes to homepage
- **Navigation Links**: Centered, hover turns blue (#0066CC)
- **Phone Number**: Clickable tel: link with phone icon
- **CTA Button**: Neon green background, black text, scales on hover
- **Sticky**: Stays at top when scrolling

---

## Mobile View (Phone)
```
┌──────────────────────────────┐
│                               │
│  [🟢]              [☰ MENU]  │
│                               │
└──────────────────────────────┘

When menu is open:
┌──────────────────────────────┐
│                               │
│  [🟢]              [✕ CLOSE] │
│                               │
├───────────────────────────────┤
│                               │
│     Services                  │
│                               │
│     Team                      │
│                               │
│     About                     │
│                               │
│     Contact                   │
│                               │
│  ───────────────────────      │
│                               │
│  📞 (256) 274-8530           │
│                               │
│  [     Free Inspection    ]  │
│                               │
└──────────────────────────────┘
```

### Mobile Features:
- **Hamburger Menu**: Opens full-screen overlay
- **Close Button**: X icon to close menu
- **Full-Screen Navigation**: Large text, easy to tap
- **Phone & CTA**: Included at bottom of mobile menu

---

## Floating Quote Button (All Pages)
```
                                    Bottom Right Corner:
                                    ┌─────────┐
                                    │    💬    │
                                    └─────────┘
```

### Floating Button Features:
- **Position**: Fixed bottom-right (24px from bottom, 24px from right)
- **Design**: Circular, neon green, message icon
- **Size**: 64x64px (4rem)
- **Hover**: Scales to 110%
- **Link**: Goes to /contact

---

## Color Palette Used

- **Neon Green (Primary)**: #39FF14
  - Used for: Logo background, CTA buttons, floating button
  - Hover: #2ecc11 (darker green)

- **Blue (Secondary)**: #0066CC
  - Used for: Link hover states
  - Hover: #0052a3 (darker blue)

- **Dark Text**: #1a1a1a
  - Used for: Body text, navigation text

- **White Background**: #ffffff
  - Used for: Header background

---

## Animations & Interactions

1. **Logo Hover**: Scales to 105% (smooth transform)
2. **Nav Link Hover**: Text changes from dark to blue
3. **CTA Button Hover**: Scales to 105%, slightly darker green
4. **Phone Link Hover**: Text changes from dark to blue
5. **Floating Button Hover**: Scales to 110%
6. **Mobile Menu**: Slides in from right with fade effect
7. **Sticky Header**: Smooth scroll behavior with shadow

---

## Responsive Breakpoints

- **Mobile**: < 1024px (lg breakpoint)
  - Shows: Logo + Hamburger
  - Hides: Desktop navigation

- **Desktop**: ≥ 1024px
  - Shows: Full navigation + Phone + CTA
  - Hides: Hamburger menu

---

## Accessibility Features

- ✅ Semantic HTML (`<header>`, `<nav>`)
- ✅ ARIA labels for buttons
- ✅ Keyboard navigation support
- ✅ Focus states on all interactive elements
- ✅ Click-to-call phone link (tel:)
- ✅ High contrast colors for readability

---

## Files Created

1. `components/Header.tsx` - Main header component
2. `components/ui/button.tsx` - Reusable button
3. `app/layout.tsx` - Root layout with header
4. `app/globals.css` - Global styles + Tailwind
5. `lib/utils.ts` - Utility functions
6. `public/logo.png` - Company logo

---

## Ready for Testing!

Run `npm install && npm run dev` to see the header in action.
