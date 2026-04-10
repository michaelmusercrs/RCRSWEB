/**
 * RCRS Voicemail Management Service
 *
 * Complete voicemail management with:
 * - Storage/retrieval in Google Sheets (Voicemails tab)
 * - Transcription (OpenAI Whisper)
 * - Sharing, notes, and job linking
 * - Read/unread tracking
 *
 * @author RCRS Development Team
 * @version 2.0.0
 */

import crypto from 'crypto';
import { googleSheetsService, SHEET_NAMES } from './google-sheets-service';

// =============================================================================
// TYPES
// =============================================================================

export interface VoicemailMessage {
  /** Unique voicemail identifier */
  id: string;
  /** Associated call ID (if available) */
  callId: string;
  /** Caller's phone number */
  callerPhone: string;
  /** Caller's name (from caller ID or lookup) */
  callerName: string;
  /** Extension that received the voicemail */
  extension: string;
  /** Timestamp when voicemail was left (ISO string) */
  timestamp: string;
  /** Duration of voicemail in seconds */
  duration: number;
  /** URL to the audio file */
  audioUrl: string;
  /** AI-generated transcription text */
  transcription: string;
  /** Whether the voicemail has been listened to / read */
  isRead: boolean;
  /** Whether this voicemail is flagged as urgent */
  isUrgent: boolean;
  /** Linked JobNimbus job ID */
  linkedJobId: string;
  /** Linked JobNimbus contact ID */
  linkedContactId: string;
  /** User IDs this voicemail has been shared with */
  sharedWith: string[];
  /** Notes added by team members */
  notes: string;
  /** Record creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

export interface VoicemailData {
  voicemails: VoicemailMessage[];
  lastUpdated: string;
}

export interface VoicemailFilter {
  extension?: string;
  isRead?: boolean;
  isUrgent?: boolean;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
  linkedJobId?: string;
}

// =============================================================================
// SHEET SCHEMA
// =============================================================================

const VOICEMAIL_HEADERS: string[] = [
  'id',
  'callId',
  'callerPhone',
  'callerName',
  'extension',
  'timestamp',
  'duration',
  'audioUrl',
  'transcription',
  'isRead',
  'isUrgent',
  'linkedJobId',
  'linkedContactId',
  'sharedWith',
  'notes',
  'createdAt',
  'updatedAt',
];

// =============================================================================
// SERVICE CLASS
// =============================================================================

class VoicemailService {
  private cache: VoicemailMessage[] | null = null;
  private cacheExpiresAt = 0;
  private readonly CACHE_TTL_MS = 60_000;

  // ---------------------------------------------------------------------------
  // Sheet I/O
  // ---------------------------------------------------------------------------

  private parseRow(row: Record<string, string>): VoicemailMessage {
    let sharedWith: string[] = [];
    try {
      sharedWith = row.sharedWith ? JSON.parse(row.sharedWith) : [];
      if (!Array.isArray(sharedWith)) sharedWith = [];
    } catch {
      sharedWith = row.sharedWith ? row.sharedWith.split(',').map(s => s.trim()).filter(Boolean) : [];
    }

    return {
      id: row.id || '',
      callId: row.callId || '',
      callerPhone: row.callerPhone || '',
      callerName: row.callerName || '',
      extension: row.extension || '',
      timestamp: row.timestamp || '',
      duration: Number(row.duration) || 0,
      audioUrl: row.audioUrl || '',
      transcription: row.transcription || '',
      isRead: row.isRead === 'true',
      isUrgent: row.isUrgent === 'true',
      linkedJobId: row.linkedJobId || '',
      linkedContactId: row.linkedContactId || '',
      sharedWith,
      notes: row.notes || '',
      createdAt: row.createdAt || '',
      updatedAt: row.updatedAt || '',
    };
  }

  private async loadFromSheet(): Promise<VoicemailMessage[]> {
    const rows = await googleSheetsService.getGenericRows(
      SHEET_NAMES.VOICEMAILS,
      VOICEMAIL_HEADERS,
    );
    return rows.map(r => this.parseRow(r));
  }

  private async loadCached(): Promise<VoicemailMessage[]> {
    if (this.cache && Date.now() < this.cacheExpiresAt) return this.cache;
    this.cache = await this.loadFromSheet();
    this.cacheExpiresAt = Date.now() + this.CACHE_TTL_MS;
    return this.cache;
  }

  private invalidateCache(): void {
    this.cache = null;
    this.cacheExpiresAt = 0;
  }

  private async upsert(vm: VoicemailMessage): Promise<void> {
    await googleSheetsService.upsertGenericRow(
      SHEET_NAMES.VOICEMAILS,
      VOICEMAIL_HEADERS,
      'id',
      vm as unknown as Record<string, unknown>,
    );
    this.invalidateCache();
  }

  /**
   * Generate a unique voicemail ID
   */
  private generateId(): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `VM-${timestamp}-${random}`;
  }

  // ===========================================================================
  // PUBLIC METHODS
  // ===========================================================================

  /**
   * Get all voicemails with optional filtering
   */
  async getAll(filter?: VoicemailFilter): Promise<VoicemailMessage[]> {
    const all = await this.loadCached();
    let voicemails = [...all];

    if (filter) {
      if (filter.extension) {
        voicemails = voicemails.filter(vm => vm.extension === filter.extension);
      }
      if (filter.isRead !== undefined) {
        voicemails = voicemails.filter(vm => vm.isRead === filter.isRead);
      }
      if (filter.isUrgent !== undefined) {
        voicemails = voicemails.filter(vm => vm.isUrgent === filter.isUrgent);
      }
      if (filter.startDate) {
        const start = new Date(filter.startDate);
        voicemails = voicemails.filter(vm => new Date(vm.timestamp) >= start);
      }
      if (filter.endDate) {
        const end = new Date(filter.endDate);
        voicemails = voicemails.filter(vm => new Date(vm.timestamp) <= end);
      }
      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        voicemails = voicemails.filter(vm =>
          vm.callerName.toLowerCase().includes(query) ||
          vm.callerPhone.includes(query) ||
          vm.transcription.toLowerCase().includes(query) ||
          vm.notes.toLowerCase().includes(query)
        );
      }
      if (filter.linkedJobId) {
        voicemails = voicemails.filter(vm => vm.linkedJobId === filter.linkedJobId);
      }
    }

    // Sort by timestamp descending (newest first)
    voicemails.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return voicemails;
  }

  /**
   * Get voicemails for a specific extension
   */
  async getByExtension(extension: string): Promise<VoicemailMessage[]> {
    return this.getAll({ extension });
  }

  /**
   * Get a single voicemail by ID
   */
  async getById(id: string): Promise<VoicemailMessage | null> {
    const all = await this.loadCached();
    return all.find(vm => vm.id === id) || null;
  }

  /**
   * Create a new voicemail record
   */
  async create(voicemailData: Partial<VoicemailMessage>): Promise<VoicemailMessage> {
    const now = new Date().toISOString();

    const newVoicemail: VoicemailMessage = {
      id: this.generateId(),
      callId: voicemailData.callId || '',
      callerPhone: voicemailData.callerPhone || '',
      callerName: voicemailData.callerName || 'Unknown Caller',
      extension: voicemailData.extension || '',
      timestamp: voicemailData.timestamp || now,
      duration: voicemailData.duration || 0,
      audioUrl: voicemailData.audioUrl || '',
      transcription: voicemailData.transcription || '',
      isRead: false,
      isUrgent: voicemailData.isUrgent || false,
      linkedJobId: voicemailData.linkedJobId || '',
      linkedContactId: voicemailData.linkedContactId || '',
      sharedWith: voicemailData.sharedWith || [],
      notes: voicemailData.notes || '',
      createdAt: now,
      updatedAt: now,
    };

    await this.upsert(newVoicemail);
    return newVoicemail;
  }

  /**
   * Mark a voicemail as read
   */
  async markAsRead(id: string): Promise<VoicemailMessage | null> {
    const vm = await this.getById(id);
    if (!vm) return null;
    vm.isRead = true;
    vm.updatedAt = new Date().toISOString();
    await this.upsert(vm);
    return vm;
  }

  /**
   * Mark a voicemail as unread
   */
  async markAsUnread(id: string): Promise<VoicemailMessage | null> {
    const vm = await this.getById(id);
    if (!vm) return null;
    vm.isRead = false;
    vm.updatedAt = new Date().toISOString();
    await this.upsert(vm);
    return vm;
  }

  /**
   * Mark all voicemails as read, optionally filtered by extension
   */
  async markAllRead(extension?: string): Promise<number> {
    const all = await this.loadCached();
    const now = new Date().toISOString();
    let count = 0;

    for (const vm of all) {
      if (!vm.isRead && (!extension || vm.extension === extension)) {
        vm.isRead = true;
        vm.updatedAt = now;
        await this.upsert(vm);
        count++;
      }
    }

    return count;
  }

  /**
   * Delete a voicemail
   */
  async deleteVoicemail(id: string): Promise<boolean> {
    const deleted = await googleSheetsService.deleteGenericRow(
      SHEET_NAMES.VOICEMAILS,
      'id',
      id,
    );
    if (deleted) this.invalidateCache();
    return deleted;
  }

  /**
   * Add a note to a voicemail
   */
  async addNote(id: string, note: string): Promise<VoicemailMessage | null> {
    const vm = await this.getById(id);
    if (!vm) return null;

    const now = new Date().toISOString();
    const formattedNote = `[${now}] ${note}`;
    vm.notes = vm.notes ? `${vm.notes}\n${formattedNote}` : formattedNote;
    vm.updatedAt = now;
    await this.upsert(vm);
    return vm;
  }

  /**
   * Share a voicemail with team members
   */
  async shareWithTeam(id: string, userIds: string[]): Promise<VoicemailMessage | null> {
    const vm = await this.getById(id);
    if (!vm) return null;

    vm.sharedWith = [...new Set([...(vm.sharedWith || []), ...userIds])];
    vm.updatedAt = new Date().toISOString();
    await this.upsert(vm);
    return vm;
  }

  /**
   * Link a voicemail to a JobNimbus job
   */
  async linkToJob(id: string, jobId: string, contactId?: string): Promise<VoicemailMessage | null> {
    const vm = await this.getById(id);
    if (!vm) return null;

    vm.linkedJobId = jobId;
    if (contactId) vm.linkedContactId = contactId;
    vm.updatedAt = new Date().toISOString();
    await this.upsert(vm);
    return vm;
  }

  /**
   * Get total unread count across all extensions
   */
  async getUnreadCount(): Promise<number> {
    const all = await this.loadCached();
    return all.filter(vm => !vm.isRead).length;
  }

  /**
   * Get unread count for a specific extension
   */
  async getUnreadByExtension(extension: string): Promise<number> {
    const all = await this.loadCached();
    return all.filter(vm => !vm.isRead && vm.extension === extension).length;
  }

  /**
   * Update a voicemail record with partial fields
   */
  async update(id: string, updates: Partial<VoicemailMessage>): Promise<VoicemailMessage | null> {
    const vm = await this.getById(id);
    if (!vm) return null;

    const updated: VoicemailMessage = {
      ...vm,
      ...updates,
      id, // Prevent ID changes
      updatedAt: new Date().toISOString(),
    };
    await this.upsert(updated);
    return updated;
  }

  /**
   * Transcribe a voicemail using AI
   *
   * Uses OpenAI Whisper API for transcription when OPENAI_API_KEY is set.
   * Falls back to a placeholder message when the API key is not configured.
   */
  async transcribeVoicemail(id: string): Promise<VoicemailMessage | null> {
    const voicemail = await this.getById(id);
    if (!voicemail) return null;

    const openaiKey = process.env.OPENAI_API_KEY;

    if (openaiKey && voicemail.audioUrl) {
      try {
        const audioResponse = await fetch(voicemail.audioUrl);
        if (!audioResponse.ok) {
          throw new Error(`Failed to fetch audio: HTTP ${audioResponse.status}`);
        }
        const audioBlob = await audioResponse.blob();

        const formData = new FormData();
        formData.append('file', audioBlob, 'voicemail.wav');
        formData.append('model', 'whisper-1');

        const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
          },
          body: formData,
        });

        if (!whisperResponse.ok) {
          const errorBody = await whisperResponse.text();
          throw new Error(`Whisper API error: HTTP ${whisperResponse.status} - ${errorBody}`);
        }

        const result = await whisperResponse.json();
        voicemail.transcription = result.text || 'Transcription returned empty result';
      } catch (error) {
        console.error('OpenAI Whisper transcription failed:', error);
        voicemail.transcription = `Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    } else {
      voicemail.transcription = 'Transcription unavailable - configure OPENAI_API_KEY';
    }
    voicemail.updatedAt = new Date().toISOString();

    await this.upsert(voicemail);
    return voicemail;
  }

  /**
   * Get voicemail statistics
   */
  async getStats(): Promise<{
    total: number;
    unread: number;
    urgent: number;
    avgDuration: number;
    byExtension: { extension: string; total: number; unread: number }[];
  }> {
    const voicemails = await this.loadCached();

    const extensionMap = new Map<string, { total: number; unread: number }>();
    voicemails.forEach(vm => {
      const ext = vm.extension || 'unassigned';
      const existing = extensionMap.get(ext) || { total: 0, unread: 0 };
      extensionMap.set(ext, {
        total: existing.total + 1,
        unread: existing.unread + (vm.isRead ? 0 : 1),
      });
    });

    const totalDuration = voicemails.reduce((sum, vm) => sum + vm.duration, 0);

    return {
      total: voicemails.length,
      unread: voicemails.filter(vm => !vm.isRead).length,
      urgent: voicemails.filter(vm => vm.isUrgent).length,
      avgDuration: voicemails.length > 0 ? Math.round(totalDuration / voicemails.length) : 0,
      byExtension: Array.from(extensionMap.entries()).map(([extension, stats]) => ({
        extension,
        ...stats,
      })),
    };
  }
}

// Export singleton instance
export const voicemailService = new VoicemailService();
