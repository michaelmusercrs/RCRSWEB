import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Use the same spreadsheet as the main site
const SHEETS_ID = process.env.GOOGLE_SHEETS_ID!;

// Sheet names for CMS
const SHEETS = {
  BLOG_POSTS: 'blog-posts',
  TEAM_MEMBERS: 'team-members-import',
  IMAGES: 'images',
  SETTINGS: 'settings',
  PAGE_VIEWS: 'page-views',
  PROFILE_VIEWS: 'profile-views',
};

// Types
export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  date: string;
  author: string;
  image: string;
  keywords: string;
  excerpt: string;
  content: string;
  published: boolean;
}

export interface TeamMember {
  slug: string;
  name: string;
  company: string;
  category: string;
  position: string;
  phone: string;
  email: string;
  altEmail: string;
  displayOrder: number;
  tagline: string;
  bio: string;
  region: string;
  launchDate: string;
  profileImage: string;
  truckImage: string;
  facebook: string;
  instagram: string;
  x: string;
  tiktok: string;
  linkedin: string;
}

export interface ImageRecord {
  id: string;
  filename: string;
  path: string;
  category: string;
  uploadedBy: string;
  uploadedAt: string;
  altText: string;
}

export interface PageView {
  id: string;
  path: string;
  timestamp: string;
  referrer: string;
}

export interface ProfileView {
  id: string;
  slug: string;
  teamMemberName: string;
  timestamp: string;
  source: string;
}

class CMSSheetsService {
  private doc: GoogleSpreadsheet | null = null;
  private initialized = false;

  private async getDoc(): Promise<GoogleSpreadsheet> {
    if (!this.doc) {
      this.doc = new GoogleSpreadsheet(SHEETS_ID, serviceAccountAuth);
    }
    if (!this.initialized) {
      await this.doc.loadInfo();
      this.initialized = true;
    }
    return this.doc;
  }

  private async getOrCreateSheet(name: string, headers: string[]) {
    const doc = await this.getDoc();
    let sheet = doc.sheetsByTitle[name];

    if (!sheet) {
      sheet = await doc.addSheet({ title: name, headerValues: headers });
    }

    return sheet;
  }

  // ============================================
  // BLOG POSTS
  // ============================================

  async getBlogPosts(): Promise<BlogPost[]> {
    const sheet = await this.getOrCreateSheet(SHEETS.BLOG_POSTS, [
      'id', 'slug', 'title', 'date', 'author', 'image', 'keywords', 'excerpt', 'content', 'published'
    ]);

    const rows = await sheet.getRows();
    return rows.map(row => ({
      id: row.get('id') || '',
      slug: row.get('slug') || '',
      title: row.get('title') || '',
      date: row.get('date') || '',
      author: row.get('author') || '',
      image: row.get('image') || '',
      keywords: row.get('keywords') || '',
      excerpt: row.get('excerpt') || '',
      content: row.get('content') || '',
      published: row.get('published') === 'true',
    }));
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
    const posts = await this.getBlogPosts();
    return posts.find(p => p.slug === slug) || null;
  }

  async createBlogPost(post: Omit<BlogPost, 'id'>): Promise<BlogPost> {
    const sheet = await this.getOrCreateSheet(SHEETS.BLOG_POSTS, [
      'id', 'slug', 'title', 'date', 'author', 'image', 'keywords', 'excerpt', 'content', 'published'
    ]);

    const id = 'post-' + Date.now();
    const newPost: BlogPost = { ...post, id };

    await sheet.addRow({
      id: newPost.id,
      slug: newPost.slug,
      title: newPost.title,
      date: newPost.date,
      author: newPost.author,
      image: newPost.image,
      keywords: newPost.keywords,
      excerpt: newPost.excerpt,
      content: newPost.content,
      published: newPost.published ? 'true' : 'false',
    });

    return newPost;
  }

  async updateBlogPost(slug: string, updates: Partial<BlogPost>): Promise<BlogPost | null> {
    const sheet = await this.getOrCreateSheet(SHEETS.BLOG_POSTS, []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('slug') === slug);

    if (!row) return null;

    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'published') {
        row.set(key, value ? 'true' : 'false');
      } else if (value !== undefined) {
        row.set(key, String(value));
      }
    });

    await row.save();

    return {
      id: row.get('id'),
      slug: row.get('slug'),
      title: row.get('title'),
      date: row.get('date'),
      author: row.get('author'),
      image: row.get('image'),
      keywords: row.get('keywords'),
      excerpt: row.get('excerpt'),
      content: row.get('content'),
      published: row.get('published') === 'true',
    };
  }

  async deleteBlogPost(slug: string): Promise<boolean> {
    const sheet = await this.getOrCreateSheet(SHEETS.BLOG_POSTS, []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('slug') === slug);

    if (row) {
      await row.delete();
      return true;
    }
    return false;
  }

  // ============================================
  // TEAM MEMBERS
  // ============================================

  async getTeamMembers(): Promise<TeamMember[]> {
    const sheet = await this.getOrCreateSheet(SHEETS.TEAM_MEMBERS, [
      'slug', 'name', 'company', 'category', 'position', 'phone', 'email', 'altEmail',
      'displayOrder', 'tagline', 'bio', 'region', 'launchDate', 'profileImage',
      'truckImage', 'facebook', 'instagram', 'x', 'tiktok', 'linkedin'
    ]);

    const rows = await sheet.getRows();
    return rows.map(row => ({
      slug: row.get('slug') || '',
      name: row.get('name') || '',
      company: row.get('company') || 'River City Roofing Solutions',
      category: row.get('category') || '',
      position: row.get('position') || '',
      phone: row.get('phone') || '',
      email: row.get('email') || '',
      altEmail: row.get('altEmail') || '',
      displayOrder: parseInt(row.get('displayOrder')) || 0,
      tagline: row.get('tagline') || '',
      bio: row.get('bio') || '',
      region: row.get('region') || '',
      launchDate: row.get('launchDate') || '',
      profileImage: row.get('profileImage') || '',
      truckImage: row.get('truckImage') || '',
      facebook: row.get('facebook') || '',
      instagram: row.get('instagram') || '',
      x: row.get('x') || '',
      tiktok: row.get('tiktok') || '',
      linkedin: row.get('linkedin') || '',
    })).sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async getTeamMemberBySlug(slug: string): Promise<TeamMember | null> {
    const members = await this.getTeamMembers();
    return members.find(m => m.slug === slug) || null;
  }

  async createTeamMember(member: TeamMember): Promise<TeamMember> {
    const sheet = await this.getOrCreateSheet(SHEETS.TEAM_MEMBERS, [
      'slug', 'name', 'company', 'category', 'position', 'phone', 'email', 'altEmail',
      'displayOrder', 'tagline', 'bio', 'region', 'launchDate', 'profileImage',
      'truckImage', 'facebook', 'instagram', 'x', 'tiktok', 'linkedin'
    ]);

    await sheet.addRow({
      slug: member.slug,
      name: member.name,
      company: member.company,
      category: member.category,
      position: member.position,
      phone: member.phone,
      email: member.email,
      altEmail: member.altEmail,
      displayOrder: member.displayOrder.toString(),
      tagline: member.tagline,
      bio: member.bio,
      region: member.region,
      launchDate: member.launchDate,
      profileImage: member.profileImage,
      truckImage: member.truckImage,
      facebook: member.facebook,
      instagram: member.instagram,
      x: member.x,
      tiktok: member.tiktok,
      linkedin: member.linkedin,
    });

    return member;
  }

  async updateTeamMember(slug: string, updates: Partial<TeamMember>): Promise<TeamMember | null> {
    const sheet = await this.getOrCreateSheet(SHEETS.TEAM_MEMBERS, []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('slug') === slug);

    if (!row) return null;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        row.set(key, String(value));
      }
    });

    await row.save();

    return {
      slug: row.get('slug'),
      name: row.get('name'),
      company: row.get('company'),
      category: row.get('category'),
      position: row.get('position'),
      phone: row.get('phone'),
      email: row.get('email'),
      altEmail: row.get('altEmail'),
      displayOrder: parseInt(row.get('displayOrder')) || 0,
      tagline: row.get('tagline'),
      bio: row.get('bio'),
      region: row.get('region'),
      launchDate: row.get('launchDate'),
      profileImage: row.get('profileImage'),
      truckImage: row.get('truckImage'),
      facebook: row.get('facebook'),
      instagram: row.get('instagram'),
      x: row.get('x'),
      tiktok: row.get('tiktok'),
      linkedin: row.get('linkedin'),
    };
  }

  async deleteTeamMember(slug: string): Promise<boolean> {
    const sheet = await this.getOrCreateSheet(SHEETS.TEAM_MEMBERS, []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('slug') === slug);

    if (row) {
      await row.delete();
      return true;
    }
    return false;
  }

  // ============================================
  // IMAGES
  // ============================================

  async getImages(): Promise<ImageRecord[]> {
    const sheet = await this.getOrCreateSheet(SHEETS.IMAGES, [
      'id', 'filename', 'path', 'category', 'uploadedBy', 'uploadedAt', 'altText'
    ]);

    const rows = await sheet.getRows();
    return rows.map(row => ({
      id: row.get('id') || '',
      filename: row.get('filename') || '',
      path: row.get('path') || '',
      category: row.get('category') || '',
      uploadedBy: row.get('uploadedBy') || '',
      uploadedAt: row.get('uploadedAt') || '',
      altText: row.get('altText') || '',
    }));
  }

  async addImage(image: Omit<ImageRecord, 'id' | 'uploadedAt'>): Promise<ImageRecord> {
    const sheet = await this.getOrCreateSheet(SHEETS.IMAGES, [
      'id', 'filename', 'path', 'category', 'uploadedBy', 'uploadedAt', 'altText'
    ]);

    const newImage: ImageRecord = {
      ...image,
      id: 'img-' + Date.now(),
      uploadedAt: new Date().toISOString(),
    };

    await sheet.addRow(newImage as unknown as Record<string, string>);
    return newImage;
  }

  async deleteImage(id: string): Promise<boolean> {
    const sheet = await this.getOrCreateSheet(SHEETS.IMAGES, []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('id') === id);

    if (row) {
      await row.delete();
      return true;
    }
    return false;
  }

  // ============================================
  // SETUP - Initialize sheets with default data
  // ============================================

  async setupBlogPostsSheet(): Promise<void> {
    const sheet = await this.getOrCreateSheet(SHEETS.BLOG_POSTS, [
      'id', 'slug', 'title', 'date', 'author', 'image', 'keywords', 'excerpt', 'content', 'published'
    ]);

    // Check if already has data
    const rows = await sheet.getRows();
    if (rows.length > 0) {
      console.log('Blog posts sheet already has data');
      return;
    }

    // Import from blogData.ts
    const { blogPosts } = await import('./blogData');

    for (const post of blogPosts) {
      await sheet.addRow({
        id: 'post-' + post.id,
        slug: post.slug,
        title: post.title,
        date: post.date,
        author: post.author,
        image: post.image,
        keywords: post.keywords.join(', '),
        excerpt: post.excerpt,
        content: post.content,
        published: 'true',
      });
    }

    console.log(`Imported ${blogPosts.length} blog posts to sheet`);
  }

  async setupImagesSheet(): Promise<void> {
    const sheet = await this.getOrCreateSheet(SHEETS.IMAGES, [
      'id', 'filename', 'path', 'category', 'uploadedBy', 'uploadedAt', 'altText'
    ]);

    // Check if already has data
    const rows = await sheet.getRows();
    if (rows.length > 0) {
      console.log('Images sheet already has data');
      return;
    }

    // Add default images
    const defaultImages = [
      { filename: 'chris-muse.png', path: '/uploads/chris-muse.png', category: 'Team' },
      { filename: 'michael-muse.png', path: '/uploads/michael-muse.png', category: 'Team' },
      { filename: 'service-residential.png', path: '/uploads/service-residential.png', category: 'Services' },
      { filename: 'service-commercial.png', path: '/uploads/service-commercial.png', category: 'Services' },
      { filename: 'service-storm.jpg', path: '/uploads/service-storm.jpg', category: 'Services' },
      { filename: 'cert-iko.png', path: '/uploads/cert-iko.png', category: 'Certifications' },
      { filename: 'cert-owens-corning.png', path: '/uploads/cert-owens-corning.png', category: 'Certifications' },
    ];

    for (const img of defaultImages) {
      await sheet.addRow({
        id: 'img-' + Date.now() + Math.random().toString(36).substring(2, 6),
        filename: img.filename,
        path: img.path,
        category: img.category,
        uploadedBy: 'System',
        uploadedAt: new Date().toISOString(),
        altText: img.filename.replace(/\.[^/.]+$/, '').replace(/-/g, ' '),
      });
    }

    console.log('Imported default images to sheet');
  }

  // ============================================
  // PAGE VIEWS ANALYTICS
  // ============================================

  async getPageViews(): Promise<PageView[]> {
    const sheet = await this.getOrCreateSheet(SHEETS.PAGE_VIEWS, [
      'id', 'path', 'timestamp', 'referrer'
    ]);

    const rows = await sheet.getRows();
    return rows.map(row => ({
      id: row.get('id') || '',
      path: row.get('path') || '',
      timestamp: row.get('timestamp') || '',
      referrer: row.get('referrer') || '',
    }));
  }

  async addPageView(view: { path: string; referrer?: string }): Promise<PageView> {
    const sheet = await this.getOrCreateSheet(SHEETS.PAGE_VIEWS, [
      'id', 'path', 'timestamp', 'referrer'
    ]);

    const newView: PageView = {
      id: 'pv-' + Date.now(),
      path: view.path,
      timestamp: new Date().toISOString(),
      referrer: view.referrer || '',
    };

    await sheet.addRow(newView as unknown as Record<string, string>);

    // Keep only last 10,000 views to prevent sheet from growing too large
    const rows = await sheet.getRows();
    if (rows.length > 10000) {
      const toDelete = rows.slice(0, rows.length - 10000);
      for (const row of toDelete) {
        await row.delete();
      }
    }

    return newView;
  }

  async getPageViewStats(filterPath?: string) {
    const views = await this.getPageViews();
    const filtered = filterPath ? views.filter(v => v.path === filterPath) : views;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Views by day (last 30 days)
    const viewsByDay: Record<string, number> = {};
    filtered.forEach(view => {
      const viewDate = new Date(view.timestamp);
      if (viewDate >= thirtyDaysAgo) {
        const dateKey = viewDate.toISOString().split('T')[0];
        viewsByDay[dateKey] = (viewsByDay[dateKey] || 0) + 1;
      }
    });

    // Top pages (last 30 days)
    const pageCounts: Record<string, number> = {};
    filtered
      .filter(v => new Date(v.timestamp) >= thirtyDaysAgo)
      .forEach(view => {
        pageCounts[view.path] = (pageCounts[view.path] || 0) + 1;
      });

    const topPages = Object.entries(pageCounts)
      .map(([path, viewCount]) => ({ path, views: viewCount }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    // Recent views
    const recentViews = filtered.slice(-20).reverse();

    return {
      totalViews: filtered.length,
      uniqueViews: filtered.length,
      viewsByDay,
      topPages,
      recentViews,
    };
  }

  // ============================================
  // PROFILE VIEWS ANALYTICS
  // ============================================

  async getProfileViews(): Promise<ProfileView[]> {
    const sheet = await this.getOrCreateSheet(SHEETS.PROFILE_VIEWS, [
      'id', 'slug', 'teamMemberName', 'timestamp', 'source'
    ]);

    const rows = await sheet.getRows();
    return rows.map(row => ({
      id: row.get('id') || '',
      slug: row.get('slug') || '',
      teamMemberName: row.get('teamMemberName') || '',
      timestamp: row.get('timestamp') || '',
      source: row.get('source') || '',
    }));
  }

  async addProfileView(view: { slug: string; teamMemberName: string; source?: string }): Promise<ProfileView> {
    const sheet = await this.getOrCreateSheet(SHEETS.PROFILE_VIEWS, [
      'id', 'slug', 'teamMemberName', 'timestamp', 'source'
    ]);

    const newView: ProfileView = {
      id: 'prf-' + Date.now(),
      slug: view.slug,
      teamMemberName: view.teamMemberName,
      timestamp: new Date().toISOString(),
      source: view.source || '',
    };

    await sheet.addRow(newView as unknown as Record<string, string>);

    // Keep only last 10,000 views
    const rows = await sheet.getRows();
    if (rows.length > 10000) {
      const toDelete = rows.slice(0, rows.length - 10000);
      for (const row of toDelete) {
        await row.delete();
      }
    }

    return newView;
  }

  async getProfileViewStats(slug?: string) {
    const views = await this.getProfileViews();

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (!slug) {
      // Return stats for all profiles
      const profileGroups: Record<string, ProfileView[]> = {};
      views.forEach(view => {
        if (!profileGroups[view.slug]) {
          profileGroups[view.slug] = [];
        }
        profileGroups[view.slug].push(view);
      });

      return Object.entries(profileGroups).map(([profileSlug, profileViews]) => {
        const viewsThisWeek = profileViews.filter(v => new Date(v.timestamp) >= oneWeekAgo).length;
        const viewsThisMonth = profileViews.filter(v => new Date(v.timestamp) >= oneMonthAgo).length;

        return {
          slug: profileSlug,
          name: profileViews[0]?.teamMemberName || profileSlug,
          totalViews: profileViews.length,
          viewsThisWeek,
          viewsThisMonth,
          recentViews: profileViews.slice(-10).reverse(),
        };
      });
    }

    // Stats for specific profile
    const filtered = views.filter(v => v.slug === slug);
    const viewsThisWeek = filtered.filter(v => new Date(v.timestamp) >= oneWeekAgo).length;
    const viewsThisMonth = filtered.filter(v => new Date(v.timestamp) >= oneMonthAgo).length;

    return {
      slug,
      name: filtered[0]?.teamMemberName || '',
      totalViews: filtered.length,
      viewsThisWeek,
      viewsThisMonth,
      recentViews: filtered.slice(-20).reverse(),
    };
  }
}

export const cmsSheetsService = new CMSSheetsService();
