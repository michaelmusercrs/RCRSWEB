/**
 * Credential Service — Server-Side Authentication Credential Management
 *
 * Stores and verifies user credentials (passwords, PINs, picture passwords)
 * in a dedicated Google Sheets tab "UserCredentials". All hashing uses
 * PBKDF2 with random salts (Node.js crypto, 100k iterations, SHA-512).
 *
 * Auto-migrates existing users from team-roles.ts on first lookup.
 */

import crypto from 'crypto';
import { TEAM_MEMBERS, getTeamMemberByEmail, TeamRole } from './team-roles';

// ============================================
// TYPES
// ============================================

export type LoginMethod = 'password' | 'pin' | 'picture';

export interface UserCredentialRecord {
  userId: string;
  email: string;
  loginMethod: LoginMethod;
  pinHash: string;
  picturePointsJson: string; // JSON: [{x: number, y: number}, ...]
  passwordHash: string;
  staySignedIn: string; // "true" or "false"
  loginSetupComplete: string; // "true" or "false"
  resetBy: string;
  resetAt: string;
  lastLogin: string;
  createdAt: string;
  updatedAt: string;
}

export interface PicturePoint {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
}

// ============================================
// HASHING (PBKDF2)
// ============================================

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEY_LENGTH = 64;
const PBKDF2_DIGEST = 'sha512';
const SALT_LENGTH = 32;

function hashCredential(value: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
  const hash = crypto.pbkdf2Sync(value, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, PBKDF2_DIGEST).toString('hex');
  return `${salt}:${hash}`;
}

function verifyCredentialHash(value: string, stored: string): boolean {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const computed = crypto.pbkdf2Sync(value, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, PBKDF2_DIGEST).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computed, 'hex'));
}

// ============================================
// PICTURE PASSWORD VALIDATION
// ============================================

const PICTURE_TOLERANCE = 15; // percentage points — generous for fat fingers

function validatePicturePoints(submitted: PicturePoint[], stored: PicturePoint[]): boolean {
  if (submitted.length !== stored.length || submitted.length !== 3) return false;

  for (let i = 0; i < 3; i++) {
    const dx = submitted[i].x - stored[i].x;
    const dy = submitted[i].y - stored[i].y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > PICTURE_TOLERANCE) return false;
  }
  return true;
}

// ============================================
// GOOGLE SHEETS CREDENTIAL SERVICE
// ============================================

const TAB_NAME = 'UserCredentials';
const HEADERS = [
  'userId', 'email', 'loginMethod', 'pinHash', 'picturePointsJson',
  'passwordHash', 'staySignedIn', 'loginSetupComplete', 'resetBy',
  'resetAt', 'lastLogin', 'createdAt', 'updatedAt',
];

// In-memory cache to reduce Google Sheets reads
let credentialCache = new Map<string, { record: UserCredentialRecord; fetchedAt: number }>();
const CACHE_TTL = 60000; // 60 seconds

class CredentialService {
  private doc: any = null;
  private initialized = false;
  private lastInitAttempt = 0;
  private initCooldown = 5000;

  private async init(): Promise<boolean> {
    if (this.initialized && this.doc) return true;

    const now = Date.now();
    if (now - this.lastInitAttempt < this.initCooldown) return false;
    this.lastInitAttempt = now;

    if (!process.env.GOOGLE_SHEETS_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      console.warn('[CredentialService] Google Sheets not configured');
      return false;
    }

    try {
      const { GoogleSpreadsheet } = await import('google-spreadsheet');
      const { JWT } = await import('google-auth-library');

      const auth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/\r\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      this.doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, auth);
      await this.doc.loadInfo();
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('[CredentialService] Init failed:', error);
      this.doc = null;
      this.initialized = false;
      return false;
    }
  }

  private async getSheet() {
    if (!this.doc) throw new Error('Not initialized');

    let sheet = this.doc.sheetsByTitle[TAB_NAME];
    if (!sheet) {
      sheet = await this.doc.addSheet({
        title: TAB_NAME,
        headerValues: HEADERS,
        gridProperties: { columnCount: Math.max(HEADERS.length + 5, 26) },
      });
    } else {
      try {
        await sheet.loadHeaderRow();
      } catch {
        await sheet.setHeaderRow(HEADERS);
      }
    }
    return sheet;
  }

  // ── READ ───────────────────────────────────────────

  async getUserCredentials(email: string): Promise<UserCredentialRecord | null> {
    // Check cache first
    const cached = credentialCache.get(email.toLowerCase());
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
      return cached.record;
    }

    const ready = await this.init();
    if (!ready) return null;

    try {
      const sheet = await this.getSheet();
      const rows = await sheet.getRows({ limit: 100000 });
      const row = rows.find((r: any) => r.get('email')?.toLowerCase() === email.toLowerCase());

      if (row) {
        const record = this.rowToRecord(row);
        credentialCache.set(email.toLowerCase(), { record, fetchedAt: Date.now() });
        return record;
      }

      // Auto-migrate from team-roles.ts if user exists but has no credentials row
      const member = getTeamMemberByEmail(email);
      if (member && member.isActive) {
        return await this.migrateFromTeamRoles(member.id, member.email, member.password);
      }

      return null;
    } catch (error) {
      console.error('[CredentialService] getUserCredentials error:', error);
      return null;
    }
  }

  async getUserCredentialsById(userId: string): Promise<UserCredentialRecord | null> {
    const member = TEAM_MEMBERS.find(m => m.id === userId);
    if (!member) return null;
    return this.getUserCredentials(member.email);
  }

  // ── AUTO-MIGRATION ─────────────────────────────────

  private async migrateFromTeamRoles(userId: string, email: string, plainPassword: string): Promise<UserCredentialRecord> {
    const now = new Date().toISOString();
    const record: UserCredentialRecord = {
      userId,
      email,
      loginMethod: 'password',
      pinHash: '',
      picturePointsJson: '',
      passwordHash: hashCredential(plainPassword),
      staySignedIn: 'false',
      loginSetupComplete: 'false',
      resetBy: '',
      resetAt: '',
      lastLogin: '',
      createdAt: now,
      updatedAt: now,
    };

    try {
      const sheet = await this.getSheet();
      await sheet.addRow(record as any);
      credentialCache.set(email.toLowerCase(), { record, fetchedAt: Date.now() });
    } catch (error) {
      console.error('[CredentialService] Migration write failed:', error);
      // Still return the record so login works even if sheet write fails
    }

    return record;
  }

  // ── VERIFY CREDENTIALS ─────────────────────────────

  async verifyPassword(email: string, password: string): Promise<boolean> {
    const creds = await this.getUserCredentials(email);
    if (!creds || !creds.passwordHash) {
      // Fallback: check against team-roles.ts default password
      const member = getTeamMemberByEmail(email);
      if (member && member.isActive && password === member.password) {
        return true;
      }
      return false;
    }

    // Check hashed password
    if (verifyCredentialHash(password, creds.passwordHash)) return true;

    // Also accept the default team-roles.ts password (acts as admin reset)
    const member = getTeamMemberByEmail(email);
    if (member && password === member.password) return true;

    return false;
  }

  async verifyPin(email: string, pin: string): Promise<boolean> {
    const creds = await this.getUserCredentials(email);
    if (!creds || !creds.pinHash) return false;
    return verifyCredentialHash(pin, creds.pinHash);
  }

  async verifyPicturePoints(email: string, points: PicturePoint[]): Promise<boolean> {
    const creds = await this.getUserCredentials(email);
    if (!creds || !creds.picturePointsJson) return false;

    try {
      const stored: PicturePoint[] = JSON.parse(creds.picturePointsJson);
      return validatePicturePoints(points, stored);
    } catch {
      return false;
    }
  }

  // ── WRITE OPERATIONS ───────────────────────────────

  async setPassword(userId: string, newPassword: string): Promise<boolean> {
    return this.updateField(userId, {
      passwordHash: hashCredential(newPassword),
      updatedAt: new Date().toISOString(),
    });
  }

  async setPin(userId: string, pin: string): Promise<boolean> {
    if (pin.length < 4 || pin.length > 8 || !/^\d+$/.test(pin)) {
      return false;
    }
    return this.updateField(userId, {
      pinHash: hashCredential(pin),
      loginMethod: 'pin',
      updatedAt: new Date().toISOString(),
    });
  }

  async setPicturePoints(userId: string, points: PicturePoint[]): Promise<boolean> {
    if (points.length !== 3) return false;
    // Validate all points are valid percentages
    for (const p of points) {
      if (p.x < 0 || p.x > 100 || p.y < 0 || p.y > 100) return false;
    }
    return this.updateField(userId, {
      picturePointsJson: JSON.stringify(points),
      loginMethod: 'picture',
      updatedAt: new Date().toISOString(),
    });
  }

  async setLoginMethod(userId: string, method: LoginMethod): Promise<boolean> {
    return this.updateField(userId, {
      loginMethod: method,
      updatedAt: new Date().toISOString(),
    });
  }

  async completeLoginSetup(userId: string): Promise<boolean> {
    return this.updateField(userId, {
      loginSetupComplete: 'true',
      updatedAt: new Date().toISOString(),
    });
  }

  async recordLogin(userId: string): Promise<boolean> {
    return this.updateField(userId, {
      lastLogin: new Date().toISOString(),
    });
  }

  async setStaySignedIn(userId: string, value: boolean): Promise<boolean> {
    return this.updateField(userId, {
      staySignedIn: value ? 'true' : 'false',
      updatedAt: new Date().toISOString(),
    });
  }

  // ── ADMIN RESET ────────────────────────────────────

  async resetCredentials(
    userId: string,
    resetType: 'password' | 'login-method' | 'both',
    resetByEmail: string
  ): Promise<boolean> {
    const now = new Date().toISOString();
    const member = TEAM_MEMBERS.find(m => m.id === userId);
    if (!member) return false;

    const updates: Partial<UserCredentialRecord> = {
      resetBy: resetByEmail,
      resetAt: now,
      updatedAt: now,
    };

    if (resetType === 'password' || resetType === 'both') {
      updates.passwordHash = hashCredential('ChangeMe123!');
      updates.loginSetupComplete = 'false';
    }

    if (resetType === 'login-method' || resetType === 'both') {
      updates.pinHash = '';
      updates.picturePointsJson = '';
      updates.loginMethod = 'password';
      updates.loginSetupComplete = 'false';
    }

    return this.updateField(userId, updates);
  }

  // ── INTERNAL HELPERS ───────────────────────────────

  private async updateField(userId: string, updates: Partial<UserCredentialRecord>): Promise<boolean> {
    const ready = await this.init();
    if (!ready) return false;

    try {
      const sheet = await this.getSheet();
      const rows = await sheet.getRows({ limit: 100000 });
      const row = rows.find((r: any) => r.get('userId') === userId);

      if (row) {
        for (const [key, value] of Object.entries(updates)) {
          row.set(key, String(value ?? ''));
        }
        await row.save();
      } else {
        // User has no row yet — create one via migration, then update
        const member = TEAM_MEMBERS.find(m => m.id === userId);
        if (!member) return false;

        await this.migrateFromTeamRoles(member.id, member.email, member.password);
        // Re-fetch and update
        const rows2 = await sheet.getRows({ limit: 100000 });
        const newRow = rows2.find((r: any) => r.get('userId') === userId);
        if (newRow) {
          for (const [key, value] of Object.entries(updates)) {
            newRow.set(key, String(value ?? ''));
          }
          await newRow.save();
        }
      }

      // Invalidate cache
      const member = TEAM_MEMBERS.find(m => m.id === userId);
      if (member) {
        credentialCache.delete(member.email.toLowerCase());
      }

      return true;
    } catch (error) {
      console.error('[CredentialService] updateField error:', error);
      return false;
    }
  }

  private rowToRecord(row: any): UserCredentialRecord {
    return {
      userId: row.get('userId') || '',
      email: row.get('email') || '',
      loginMethod: (row.get('loginMethod') as LoginMethod) || 'password',
      pinHash: row.get('pinHash') || '',
      picturePointsJson: row.get('picturePointsJson') || '',
      passwordHash: row.get('passwordHash') || '',
      staySignedIn: row.get('staySignedIn') || 'false',
      loginSetupComplete: row.get('loginSetupComplete') || 'false',
      resetBy: row.get('resetBy') || '',
      resetAt: row.get('resetAt') || '',
      lastLogin: row.get('lastLogin') || '',
      createdAt: row.get('createdAt') || '',
      updatedAt: row.get('updatedAt') || '',
    };
  }

  /** Clear the in-memory cache (useful after admin resets) */
  clearCache(): void {
    credentialCache.clear();
  }
}

export const credentialService = new CredentialService();
