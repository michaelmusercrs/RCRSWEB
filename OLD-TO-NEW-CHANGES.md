# Converting Old Pages to New Color System

## Quick Reference: What Changes

### Text Colors
```
OLD                          NEW
text-primary          →      text-brand-blue (interactive) OR text-brand-black (text)
text-foreground       →      text-brand-black
text-muted-foreground →      text-gray-600
text-card-foreground  →      text-brand-black
```

### Background Colors
```
OLD                  NEW
bg-card       →      bg-white
bg-muted      →      bg-gray-50
bg-background →      bg-white
```

### Icon Colors
```
OLD                          NEW
icon className="text-primary" → className="text-brand-green" (on white)
                              → className="text-brand-blue" (alternative)
                              → className="text-white" (on dark backgrounds)
```

### Button Styles
```
OLD:
<Button className="bg-primary text-white">Click Me</Button>

NEW PRIMARY:
<Button className="bg-brand-blue hover:bg-blue-700 text-white font-bold">Click Me</Button>

NEW SECONDARY:
<Button className="border-2 border-brand-black text-brand-black hover:bg-black hover:text-white font-bold">Click Me</Button>
```

### Card Styling
```
OLD:
<Card className="bg-card border">

NEW:
<Card className="bg-white border border-gray-200 hover:border-brand-blue hover:shadow-lg transition-all">
```

---

## Example: Converting Decatur Page

### BEFORE (Old Colors)
```tsx
// page (11).tsx - ORIGINAL
export default function DecaturPage() {
  return (
    <div>
      <section className="relative h-[50vh] ... overflow-hidden">
        <div className="absolute inset-0 bg-black/60 z-10" />
        <div className="z-20 container mx-auto px-4">
          <h1 className="text-4xl md:text-6xl font-bold">Decatur's Premier Roofer</h1>
        </div>
      </section>

      <section className="py-16 bg-muted">
        <h2 className="text-3xl font-bold text-foreground">Services</h2>
        <p className="text-muted-foreground">Description...</p>
        {services.map(service => (
          <Card className="bg-card">
            <Icon className="text-primary" />
            <p className="text-muted-foreground">{service.description}</p>
          </Card>
        ))}
      </section>

      <Button className="bg-primary text-white">Get Inspection</Button>
    </div>
  );
}
```

### AFTER (New Colors)
```tsx
// page (11).tsx - UPDATED
export default function DecaturPage() {
  return (
    <div className="bg-white">
      {/* Hero section - keep same, just ensure text is white */}
      <section className="relative w-full h-[60vh] ... overflow-hidden">
        <div className="absolute inset-0 bg-black/50 z-10" />
        <div className="z-20 container mx-auto px-4">
          <h1 className="text-5xl md:text-6xl font-bold text-white">
            Decatur Roofing Experts
          </h1>
        </div>
      </section>

      {/* Intro - white bg */}
      <section className="py-16 md:py-24 bg-white">
        <h2 className="text-3xl md:text-4xl font-bold text-brand-black">
          Trusted Roofing in Your Community
        </h2>
        <p className="text-lg text-gray-600">Description...</p>
      </section>

      {/* Services - LIGHT GREY BG (key change!) */}
      <section className="py-16 md:py-24 bg-gray-50">
        <h2 className="text-3xl md:text-4xl font-bold text-brand-black">
          Our Services
        </h2>
        {services.map(service => (
          <Card className="border border-gray-200 hover:border-brand-blue hover:shadow-lg transition-all">
            <div className="bg-brand-green/10">
              <Icon className="text-brand-green" />
            </div>
            <p className="text-gray-600">{service.description}</p>
          </Card>
        ))}
      </section>

      {/* NEW: Contact Info Section - white bg */}
      <section className="py-16 md:py-24 bg-white">
        {/* 3 columns: phone, hours, location */}
      </section>

      {/* NEW: Why Choose - ROYAL BLUE BG (key change!) */}
      <section className="py-16 md:py-24 bg-brand-blue">
        <h2 className="text-3xl md:text-4xl font-bold text-white">
          Why Choose River City?
        </h2>
        <div className="flex gap-4">
          <div className="bg-brand-green rounded-full">✓</div>
          <div>
            <h3 className="text-white">Benefit</h3>
            <p className="text-blue-100">Description...</p>
          </div>
        </div>
      </section>

      {/* CTA - white bg */}
      <section className="py-16 md:py-24 bg-white">
        <div className="border-l-4 border-brand-green pl-8">
          <h2 className="text-3xl font-bold text-brand-black">Ready?</h2>
          <Button className="bg-brand-blue hover:bg-blue-700 text-white font-bold">
            Get Free Inspection
          </Button>
          <Button className="border-2 border-brand-black text-brand-black hover:bg-black hover:text-white font-bold">
            Call Us Now
          </Button>
        </div>
      </section>
    </div>
  );
}
```

---

## Color Change Summary

| Element | Old | New | Notes |
|---------|-----|-----|-------|
| Headlines | foreground | text-brand-black | Darker for emphasis |
| Body text | muted-foreground | text-gray-600 | Lighter for readability |
| Links | primary | text-brand-blue | Keep interactive blue |
| Icons | primary | text-brand-green | Your accent color |
| Button BG | primary (varies) | bg-brand-blue | Consistent interactive |
| Card BG | card | bg-white | Cleaner look |
| Section BG 1 | muted | bg-gray-50 | Light grey alternate |
| Section BG 2 | (not used) | bg-brand-blue | New feature section |
| Borders | border | border-gray-200 | Subtle, clean |

---

## Pattern for Each Section

### White Background Sections
```tsx
<section className="py-16 md:py-24 bg-white">
  <h2 className="text-3xl md:text-4xl font-bold text-brand-black">Headline</h2>
  <p className="text-lg text-gray-600">Body text...</p>
</section>
```

### Light Grey Background Sections
```tsx
<section className="py-16 md:py-24 bg-gray-50">
  <h2 className="text-3xl md:text-4xl font-bold text-brand-black">Headline</h2>
  {items.map(item => (
    <Card className="border border-gray-200 hover:border-brand-blue hover:shadow-lg">
      {/* content */}
    </Card>
  ))}
</section>
```

### Blue Background Sections
```tsx
<section className="py-16 md:py-24 bg-brand-blue">
  <h2 className="text-3xl md:text-4xl font-bold text-white">Headline</h2>
  <p className="text-blue-100">Body text...</p>
  <Icon className="text-brand-green" /> {/* Contrast! */}
</section>
```

---

## Icon Background Pattern

```tsx
// Before
<div className="bg-muted p-4 rounded-full">
  <Icon className="text-primary" />
</div>

// After
<div className="bg-brand-green/10 p-4 rounded-full">
  <Icon className="text-brand-green" />
</div>
```

This gives a light green background with green icon (subtle, professional).

---

## Button Patterns

### Primary Button
```tsx
<Button className="bg-brand-blue hover:bg-blue-700 text-white font-bold">
  Action
</Button>
```

### Secondary Button
```tsx
<Button className="border-2 border-brand-black text-brand-black hover:bg-black hover:text-white font-bold">
  Alternative Action
</Button>
```

### Link Button
```tsx
<a href="#" className="text-brand-blue hover:underline">Link Text</a>
```

---

## All Done? Test This

After converting a page:

1. ✅ Headlines are black
2. ✅ Body text is grey
3. ✅ Buttons are blue (with hover state)
4. ✅ Icons are green (or blue on white, green on blue)
5. ✅ Section backgrounds alternate: white → grey → blue → white
6. ✅ Borders are subtle grey
7. ✅ Cards have hover effect (border + shadow)
8. ✅ No gradients (all solid colors)
9. ✅ Mobile responsive
10. ✅ All text readable

---

## Quick Checklist for Each Page

- [ ] Updated headline colors (text-brand-black)
- [ ] Updated body text colors (text-gray-600)
- [ ] Updated button colors (bg-brand-blue)
- [ ] Updated icon colors (text-brand-green)
- [ ] Added section background alternation
- [ ] Added card hover effects
- [ ] Removed any gradients
- [ ] Checked mobile responsive
- [ ] Verified text contrast
- [ ] Tested on different browsers

