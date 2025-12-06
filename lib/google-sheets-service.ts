import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// Handle private key - works with both escaped \n and actual newlines
const privateKey = process.env.GOOGLE_PRIVATE_KEY
  ?.replace(/\\n/g, '\n')  // Handle escaped \n from env files
  ?.replace(/\r\n/g, '\n'); // Normalize Windows line endings

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: privateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID!, serviceAccountAuth);

interface TeamMember {
  slug: string;
  name: string;
  company: string;
  category: string;
  position: string;
  phone: string;
  email: string;
  altEmail: string;
  displayOrder: number;
  tagline?: string;
  bio: string;
  region?: string;
  launchDate?: string;
  profileImage?: string;
  truckImage?: string;
  facebook?: string;
  instagram?: string;
  x?: string;
}

class GoogleSheetsService {
  private initialized = false;

  async init() {
    if (!this.initialized) {
      await doc.loadInfo();
      this.initialized = true;
    }
  }

  private convertDriveLink(shareLink: string): string {
    if (!shareLink || !shareLink.includes('drive.google.com')) {
      return shareLink;
    }

    // Extract file ID from various Google Drive URL formats
    let fileId = null;

    // Format: /d/FILE_ID/
    const fileIdMatch = shareLink.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (fileIdMatch) {
      fileId = fileIdMatch[1];
    }

    // Format: id=FILE_ID
    const idMatch = shareLink.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (!fileId && idMatch) {
      fileId = idMatch[1];
    }

    if (fileId) {
      // Use thumbnail API for better compatibility (size=s400 for 400px width)
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
    }

    return shareLink;
  }

  async getTeamMembers(): Promise<TeamMember[]> {
    await this.init();
    const sheet = doc.sheetsByTitle['team-members-import'];
    if (!sheet) throw new Error('team-members-import sheet not found');
    
    const rows = await sheet.getRows();
    
    return rows.map(row => ({
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
      profileImage: this.convertDriveLink(row.get('profileImage')),
      truckImage: this.convertDriveLink(row.get('truckImage')),
      facebook: row.get('facebook'),
      instagram: row.get('instagram'),
      x: row.get('x'),
    })).sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async updateTeamMember(member: TeamMember): Promise<void> {
    await this.init();
    const sheet = doc.sheetsByTitle['team-members-import'];
    if (!sheet) throw new Error('team-members-import sheet not found');
    
    const rows = await sheet.getRows();
    const existingRow = rows.find(row => row.get('slug') === member.slug);
    
    if (existingRow) {
      Object.keys(member).forEach(key => {
        existingRow.set(key, (member as any)[key]);
      });
      await existingRow.save();
    } else {
      await sheet.addRow(member as unknown as Record<string, string | number | boolean>);
    }
  }

  async deleteTeamMember(slug: string): Promise<void> {
    await this.init();
    const sheet = doc.sheetsByTitle['team-members-import'];
    if (!sheet) throw new Error('team-members-import sheet not found');
    
    const rows = await sheet.getRows();
    const rowToDelete = rows.find(row => row.get('slug') === slug);
    
    if (rowToDelete) {
      await rowToDelete.delete();
    }
  }
}

export const googleSheetsService = new GoogleSheetsService();
export type { TeamMember };
