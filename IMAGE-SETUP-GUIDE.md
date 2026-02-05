# Quick Image Setup for Your Website

## What I Fixed
✅ Created the missing StaticImage component
✅ Set up image mapping system
✅ Copied your existing images (logo.png, BRENDON_TRUCK_1.jpg)

## How to Add Images Now

### Step 1: Put Images in Your Public Folder
Create these folders in your website:
```
public/
  uploads/
    cert-owens-corning.png
    cert-iko.png 
    cert-bbb.png
    michael-chris-owners.jpg
    decatur-bridge.jpg
    huntsville-skyline.jpg
    ... (and more)
```

### Step 2: Upload Your Images
Put your images in the `/public/uploads/` folder with these names:

**For Certifications:**
- cert-owens-corning.png
- cert-iko.png
- cert-iko-codeplus.png
- cert-bbb.png
- cert-google.png
- cert-boral.png
- cert-procat.png

**For Location Pages:**
- decatur-bridge.jpg
- huntsville-skyline.jpg
- madison-suburb.jpg
- athens-courthouse.jpg
- birmingham-city.jpg
- nashville-skyline.jpg

**For Services:**
- service-residential.jpg
- service-commercial.jpg
- service-storm-damage.jpg
- service-chimney.jpg
- service-leafx-gutters.jpg

**For About Page:**
- michael-chris-owners.jpg (photo of Michael & Chris)

### Step 3: Copy the StaticImage Component
Copy the `StaticImage.tsx` file to your `components/` folder

### Step 4: Test Your Images
Your images should now show up on your website!

## Need to Add More Images?
Edit the `imageMap` in StaticImage.tsx:
```typescript
const imageMap: Record<string, string> = {
  'your-new-image-slot': '/uploads/your-image.jpg',
  // ... other images
};
```

## Missing Images
Right now you'll see placeholder boxes that say "Missing: image-name" - just upload those images to fix them!
