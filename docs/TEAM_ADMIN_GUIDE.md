# Team Admin Dashboard Guide

Complete guide to managing team members through the admin panel.

---

## 🎉 What's Been Built

A complete team member management system with:

✅ **List all team members** - See all 17 team members at a glance
✅ **Search & filter** - Find members by name, position, email, or category
✅ **Add new members** - Create new team member profiles
✅ **Edit existing** - Update any team member information
✅ **Delete members** - Remove team members (with confirmation)
✅ **Reorder members** - Change display order with up/down buttons
✅ **Image upload** - Upload profile and truck images
✅ **Categories** - Filter by Leadership, Office, Production, etc.
✅ **Full profiles** - Name, position, email, phone, bio, social media, images

---

## 🚀 Quick Start

### Access the Dashboard

1. **Navigate to:**
   ```
   http://localhost:3000/admin/team
   ```

2. **Login** with admin password (default: `admin123`)

3. **You'll see** all 17 current team members

---

## 📋 Features Breakdown

### 1. **View Team Members**

**What you see:**
- Profile image (or placeholder)
- Name and position
- Email and phone
- Category badge
- Display order number

**Sorting:**
- Automatically sorted by `displayOrder`
- Lower numbers appear first

---

### 2. **Search**

**Search bar** at the top searches:
- ✅ Member name
- ✅ Position/title
- ✅ Email address

**Example:** Type "inspector" to find all Sales Inspectors

---

### 3. **Filter by Category**

**Dropdown** to filter by:
- Leadership
- Regional Partner
- Office
- Production
- Partners & Advisors
- In Loving Memory
- All Categories (shows everyone)

---

### 4. **Add New Member**

**Steps:**

1. Click **"Add Member"** button (green, top right)
2. Fill in the form:

**Required fields:**
- ✅ Name
- ✅ Position
- ✅ Email
- ✅ Category

**Optional fields:**
- Phone
- Region
- Tagline (one-liner)
- Bio (full description)
- Profile image URL
- Truck image URL
- Social media links (Facebook, Instagram, X)

3. Click **"Save"**
4. New member appears in list

**Auto-generated:**
- Slug (from name, e.g., "John Doe" → "john-doe")
- Display order (auto-assigned to end)

---

### 5. **Edit Existing Member**

**Steps:**

1. Find the member in list
2. Click blue **Edit** button (pencil icon)
3. Modal opens with all current data
4. Change any fields
5. Click **"Save"**
6. Changes appear immediately

**Note:** Slug cannot be changed (it's the unique identifier)

---

### 6. **Delete Member**

**Steps:**

1. Find the member
2. Click red **Delete** button (trash icon)
3. Confirm deletion
4. Member removed from list

**Warning:** This is permanent! (for now, no undo)

---

### 7. **Reorder Members**

**Display order** determines how members appear on the public team page.

**To reorder:**

1. Find member to move
2. Click **up arrow** (↑) or **down arrow** (↓)
3. Member swaps position with neighbor
4. Order saved automatically

**Notes:**
- Can't move first member up
- Can't move last member down
- Only works within filtered view

---

### 8. **Upload Images**

**Two image fields:**
- Profile image (headshot)
- Truck image (if applicable)

**Option A: Paste URL**
- If image already uploaded, paste URL directly
- Format: `/uploads/filename.jpg`

**Option B: Upload Button**
- Click **Upload** button (cloud icon)
- Opens upload page in new window
- Upload image
- URL auto-fills when done

**Image requirements:**
- Formats: JPG, PNG, WebP, GIF
- Max size: 10MB
- Recommended: 800x800px for profiles

---

## 🗂️ Data Storage

### How It Works

**Initial load:**
- Copies team data from `lib/teamData.ts`
- Creates `data/team-members.json`

**All changes:**
- Saved to `data/team-members.json`
- Original `teamData.ts` unchanged (backup)

**To reset:**
- Delete `data/team-members.json`
- Refresh page
- Will recreate from `teamData.ts`

---

## 🔌 API Endpoints

### 1. List/Create Members

**GET** `/api/admin/team-members`
- Returns all team members
- Query params: `?category=Production&search=john`

**POST** `/api/admin/team-members`
- Creates new member
- Body: Team member object

**PUT** `/api/admin/team-members`
- Bulk reorder
- Body: `{ members: [{ slug, displayOrder }] }`

### 2. Individual Member

**GET** `/api/admin/team-members/[slug]`
- Returns single member

**PUT** `/api/admin/team-members/[slug]`
- Updates member
- Body: Updated fields

**DELETE** `/api/admin/team-members/[slug]`
- Deletes member

---

## 📊 Team Data Structure

```typescript
interface TeamMember {
  slug: string;                    // Unique identifier
  name: string;                    // Full name
  company: string;                 // Company name
  category: string;                // Leadership, Office, etc.
  position: string;                // Job title
  phone: string;                   // Phone number
  email: string;                   // Primary email
  altEmail: string;                // Alternate email
  displayOrder: number;            // Sort order
  bio: string;                     // Full biography
  tagline?: string;                // One-liner
  region?: string;                 // Geographic region
  launchDate?: string;             // Launch date
  profileImage?: string;           // Profile photo URL
  truckImage?: string;             // Truck photo URL
  facebook?: string;               // Facebook URL
  instagram?: string;              // Instagram URL
  x?: string;                      // X/Twitter URL
  keyStrengths?: string[];         // Array of strengths
  responsibilities?: string[];     // Array of duties
}
```

---

## 🎨 UI Components

### Search Bar
- Real-time search as you type
- Searches: name, position, email
- Clear with X button

### Category Filter
- Dropdown menu
- Shows all categories
- "All Categories" shows everyone

### Member Cards
- Clean card layout
- Profile image on left
- Details in center
- Actions on right

### Add/Edit Modal
- Full-screen overlay
- Scrollable form
- Cancel or Save
- Real-time preview for images

### Reorder Buttons
- Up/down arrows
- Disabled at top/bottom
- Instant feedback

---

## 💡 Tips & Best Practices

### Images
- **Upload first** to admin/upload
- **Then copy URL** to team form
- Use consistent image sizes
- Optimize images before upload
- Name files clearly (e.g., `john-doe-profile.jpg`)

### Display Order
- Lower numbers = higher priority
- Leadership usually 1-5
- Office staff 6-10
- Production 10-20
- Keep related roles together

### Categories
- Use existing categories
- Be consistent
- "Regional Partner" for area leads
- "Partners & Advisors" for external
- "In Loving Memory" for remembrance

### Bios
- **Tagline:** 1 sentence
- **Bio:** 2-3 paragraphs
- Include:
  - Role/responsibilities
  - Experience/background
  - Personal interests
  - Family info (if applicable)

### Email
- Use company email
- Format: `firstname@rcrsal.com`
- Alt email same unless has multiple

---

## 🐛 Troubleshooting

### Members not loading

**Check:**
1. `npm run dev` is running
2. No console errors (F12)
3. `data/` directory exists
4. API routes working

**Fix:**
```bash
# Create data directory
mkdir data

# Restart server
npm run dev
```

---

### Can't save changes

**Check:**
1. Required fields filled (Name, Email, Position, Category)
2. Email format valid
3. No console errors

**Fix:**
- Fill all required fields (marked with *)
- Check email is `name@domain.com` format
- Check browser console for errors

---

### Images not showing

**Check:**
1. URL format: `/uploads/filename.jpg`
2. Image file exists in `public/uploads/`
3. Image uploaded successfully
4. No typos in URL

**Fix:**
- Use absolute path starting with `/`
- Upload image first via admin/upload
- Copy exact URL from upload page
- Check file actually in public/uploads

---

### Display order not changing

**Check:**
1. Using up/down arrows (not editing displayOrder directly)
2. Not at top/bottom of list
3. Filter not hiding other members

**Fix:**
- Use arrow buttons only
- Can't move first member up or last down
- Clear filters to see full list

---

### Slug already exists error

**Cause:** Name generates duplicate slug

**Fix:**
1. Change name slightly (add middle initial)
2. Or delete old member first
3. Or edit existing instead of creating new

---

## 🔐 Security Notes

### Current Setup

✅ **Admin panel** - Password protected
✅ **API routes** - Server-side only
✅ **Data file** - Not in public folder
❌ **No user roles** - Single admin password

### For Production

**Recommended:**
1. Use proper auth (NextAuth, Clerk, Auth0)
2. Add role-based access control
3. Add audit logging
4. Validate all inputs server-side
5. Add rate limiting
6. Use database instead of JSON file

---

## 📈 Future Enhancements

### Possible Additions

- **Drag-and-drop reordering** (instead of up/down buttons)
- **Bulk operations** (delete multiple, bulk edit)
- **Image cropping** (built into upload)
- **Undo/redo** (restore deleted members)
- **History/versions** (see past changes)
- **Duplicate member** (copy to create similar)
- **Export** (download team data as CSV)
- **Import** (bulk upload via CSV)
- **Search by multiple fields** (advanced filters)
- **Sort options** (by name, date added, etc.)

---

## 📁 File Structure

```
app/
├── admin/
│   ├── team/
│   │   ├── page.tsx                 ← Team admin page
│   │   └── TeamManageClient.tsx     ← Main component
│   └── layout.tsx                   ← Admin layout (has team link)
└── api/
    └── admin/
        ├── team-members/
        │   ├── route.ts              ← List/create/reorder
        │   └── [slug]/
        │       └── route.ts          ← Get/update/delete
        └── upload/
            └── route.ts              ← Image upload (already exists)

lib/
└── teamData.ts                       ← Original team data (backup)

data/
└── team-members.json                 ← Live data (auto-created)

docs/
└── TEAM_ADMIN_GUIDE.md              ← This file
```

---

## ✅ Testing Checklist

Before going live:

- [ ] Can view all 17 members
- [ ] Search works (try "inspector")
- [ ] Filter works (try "Office")
- [ ] Can add new member
- [ ] Can edit existing member
- [ ] Can delete member (test with dummy)
- [ ] Can reorder with up/down
- [ ] Can upload profile image
- [ ] Can upload truck image
- [ ] Social media links save
- [ ] Changes persist after refresh
- [ ] Mobile responsive
- [ ] No console errors

---

## 🎊 You're Done!

Your team admin dashboard is fully functional!

**Access it at:** http://localhost:3000/admin/team

**Questions?** Check troubleshooting section above.

**Need more features?** See "Future Enhancements" for ideas.

---

_Created: November 13, 2025 for River City Roofing Solutions_
