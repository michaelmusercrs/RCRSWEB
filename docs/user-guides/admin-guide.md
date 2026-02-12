# Admin Portal User Guide

## Overview

The Admin Portal provides comprehensive management tools for River City Roofing Solutions administrators. Access the portal at `/admin` after authentication.

---

## Getting Started

### Accessing the Admin Portal

1. Navigate to `/admin` in your browser
2. The admin portal uses a light theme for desktop use
3. You must have `admin` or `owner` role to access all features

### Dashboard Overview

The main dashboard displays:
- **Total Images**: Count of uploaded media
- **Blog Posts**: Number of published articles
- **Team Members**: Active team count
- **Page Views**: Website analytics

---

## Quick Actions

### Manage Inventory
Access inventory management at `/admin/inventory`:
- View all inventory items
- Check stock levels
- See low stock alerts
- Update quantities

### Upload Image
Navigate to `/admin/upload` to:
- Upload images for blog posts
- Add team member photos
- Upload project images
- Store documents

Supported formats: JPEG, PNG, WebP
Storage: Vercel Blob

### Create Blog Post
Visit `/admin/blog` to:
- Write new articles
- Edit existing posts
- Set publish status
- Add featured images
- Manage categories

### Add Team Member
Go to `/admin/team` to:
- Add new team members
- Edit profiles
- Set roles and permissions
- Upload profile photos
- Manage contact information

---

## Feature Sections

### Inventory Management (`/admin/inventory`)

The inventory section allows complete control over stock:

**Viewing Inventory:**
- See all items in a searchable table
- Filter by category
- Sort by various columns
- View low stock items highlighted

**Managing Items:**
- Add new inventory items
- Edit existing items (SKU, name, price, quantity)
- Set reorder points
- Track suppliers

**Stock Alerts:**
- Items below minimum threshold shown in alerts
- Configure minimum stock levels per item

### Team Management (`/admin/team`)

Manage all team member profiles:

**Team Member Fields:**
- Name and slug (URL identifier)
- Email and phone
- Position and category
- Bio and tagline
- Profile and truck images
- Social media links
- Display order

**Actions:**
- Add new team member
- Edit existing profiles
- Deactivate members
- Reorder display sequence

### Marketing Tools (`/admin/marketing`)

Marketing campaign management:

- View active campaigns
- Track campaign performance
- Manage ad creatives
- Monitor leads by source

### Social Ads (`/admin/social-ads`)

Social media advertising tools:

- Facebook/Instagram ad management
- Campaign creation
- Budget tracking
- Performance metrics

### JobNimbus Integration (`/admin/jobnimbus`)

CRM integration settings:

**Connection Status:**
- View API connection status
- Test connection
- See sync statistics

**Data Sync:**
- View contacts count
- View jobs count
- Trigger manual sync
- Review sync history

**Actions:**
- Sync contacts from JobNimbus
- Push updates to CRM
- View sync errors

---

## Settings & Configuration

### System Status

The admin dashboard shows system health:
- Green indicator: All systems operational
- Yellow indicator: Some features degraded
- Red indicator: Critical issues

### Upload Settings

Configure upload behavior:
- Maximum file size
- Allowed file types
- Storage location

---

## Common Tasks

### Adding a New Team Member

1. Go to `/admin/team`
2. Click "Add Team Member"
3. Fill in required fields:
   - Name
   - Email
   - Position
   - Role
4. Upload profile photo
5. Click Save

### Publishing a Blog Post

1. Navigate to `/admin/blog`
2. Click "Create New Post"
3. Enter title and content
4. Add featured image
5. Set category and tags
6. Click "Publish"

### Checking Low Stock

1. Go to `/admin/inventory`
2. Look for items with warning badges
3. Note items below minimum threshold
4. Place orders as needed

### Syncing with JobNimbus

1. Visit `/admin/jobnimbus`
2. Verify connection status is green
3. Click "Sync Now" to pull latest data
4. Check for any sync errors

---

## Troubleshooting

### Images Not Uploading

- Check file size (max 10MB)
- Verify file format (JPEG, PNG, WebP)
- Ensure BLOB_READ_WRITE_TOKEN is configured

### JobNimbus Connection Failed

- Verify JOBNIMBUS_API_KEY is set
- Check API rate limits
- Review server logs for details

### Changes Not Saving

- Refresh the page
- Check browser console for errors
- Verify network connectivity

---

## Best Practices

1. **Regular Syncs**: Sync with JobNimbus daily
2. **Image Optimization**: Compress images before upload
3. **Inventory Checks**: Review low stock alerts weekly
4. **Content Updates**: Keep blog posts current
5. **Team Profiles**: Ensure all team info is accurate

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Save | Ctrl+S |
| Cancel | Escape |
| Search | Ctrl+K |

---

## Related Guides

- [Manager Guide](./manager-guide.md) - For management tasks
- [Inventory Guide](./admin-guide.md#inventory-management) - Detailed inventory help
- [API Reference](../API-REFERENCE.md) - Technical documentation
