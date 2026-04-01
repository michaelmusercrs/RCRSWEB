/**
 * RCRS Voicemail Management Service
 *
 * Complete voicemail management with:
 * - Storage/retrieval from data/voicemails.json
 * - Transcription (placeholder for AI integration)
 * - Sharing, notes, and job linking
 * - Read/unread tracking
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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
// DATA PATH
// =============================================================================

const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'voicemails.json');

// =============================================================================
// SERVICE CLASS
// =============================================================================

class VoicemailService {
  /**
   * Read voicemail data from file
   */
  private readData(): VoicemailData {
    try {
      if (fs.existsSync(DATA_FILE_PATH)) {
        const content = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('Error reading voicemail data:', error);
    }

    return {
      voicemails: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Write voicemail data to file
   */
  private writeData(data: VoicemailData): void {
    try {
      const dir = path.dirname(DATA_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      data.lastUpdated = new Date().toISOString();
      fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error writing voicemail data:', error);
      throw error;
    }
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
  getAll(filter?: VoicemailFilter): VoicemailMessage[] {
    const data = this.readData();
    let voicemails = [...data.voicemails];

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
  getByExtension(extension: string): VoicemailMessage[] {
    return this.getAll({ extension });
  }

  /**
   * Get a single voicemail by ID
   */
  getById(id: string): VoicemailMessage | null {
    const data = this.readData();
    return data.voicemails.find(vm => vm.id === id) || null;
  }

  /**
   * Create a new voicemail record
   */
  create(voicemailData: Partial<VoicemailMessage>): VoicemailMessage {
    const data = this.readData();
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

    data.voicemails.unshift(newVoicemail);
    this.writeData(data);

    return newVoicemail;
  }

  /**
   * Mark a voicemail as read
   */
  markAsRead(id: string): VoicemailMessage | null {
    const data = this.readData();
    const index = data.voicemails.findIndex(vm => vm.id === id);
    if (index < 0) return null;

    data.voicemails[index].isRead = true;
    data.voicemails[index].updatedAt = new Date().toISOString();
    this.writeData(data);

    return data.voicemails[index];
  }

  /**
   * Mark a voicemail as unread
   */
  markAsUnread(id: string): VoicemailMessage | null {
    const data = this.readData();
    const index = data.voicemails.findIndex(vm => vm.id === id);
    if (index < 0) return null;

    data.voicemails[index].isRead = false;
    data.voicemails[index].updatedAt = new Date().toISOString();
    this.writeData(data);

    return data.voicemails[index];
  }

  /**
   * Mark all voicemails as read, optionally filtered by extension
   */
  markAllRead(extension?: string): number {
    const data = this.readData();
    const now = new Date().toISOString();
    let count = 0;

    data.voicemails.forEach(vm => {
      if (!vm.isRead && (!extension || vm.extension === extension)) {
        vm.isRead = true;
        vm.updatedAt = now;
        count++;
      }
    });

    if (count > 0) {
      this.writeData(data);
    }

    return count;
  }

  /**
   * Delete a voicemail
   */
  deleteVoicemail(id: string): boolean {
    const data = this.readData();
    const initialLength = data.voicemails.length;
    data.voicemails = data.voicemails.filter(vm => vm.id !== id);

    if (data.voicemails.length < initialLength) {
      this.writeData(data);
      return true;
    }

    return false;
  }

  /**
   * Add a note to a voicemail
   */
  addNote(id: string, note: string): VoicemailMessage | null {
    const data = this.readData();
    const index = data.voicemails.findIndex(vm => vm.id === id);
    if (index < 0) return null;

    const now = new Date().toISOString();
    // Append note with timestamp
    const existingNotes = data.voicemails[index].notes;
    const formattedNote = `[${now}] ${note}`;
    data.voicemails[index].notes = existingNotes
      ? `${existingNotes}\n${formattedNote}`
      : formattedNote;
    data.voicemails[index].updatedAt = now;
    this.writeData(data);

    return data.voicemails[index];
  }

  /**
   * Share a voicemail with team members
   */
  shareWithTeam(id: string, userIds: string[]): VoicemailMessage | null {
    const data = this.readData();
    const index = data.voicemails.findIndex(vm => vm.id === id);
    if (index < 0) return null;

    const existing = data.voicemails[index].sharedWith || [];
    data.voicemails[index].sharedWith = [...new Set([...existing, ...userIds])];
    data.voicemails[index].updatedAt = new Date().toISOString();
    this.writeData(data);

    return data.voicemails[index];
  }

  /**
   * Link a voicemail to a JobNimbus job
   */
  linkToJob(id: string, jobId: string, contactId?: string): VoicemailMessage | null {
    const data = this.readData();
    const index = data.voicemails.findIndex(vm => vm.id === id);
    if (index < 0) return null;

    data.voicemails[index].linkedJobId = jobId;
    if (contactId) {
      data.voicemails[index].linkedContactId = contactId;
    }
    data.voicemails[index].updatedAt = new Date().toISOString();
    this.writeData(data);

    return data.voicemails[index];
  }

  /**
   * Get total unread count across all extensions
   */
  getUnreadCount(): number {
    const data = this.readData();
    return data.voicemails.filter(vm => !vm.isRead).length;
  }

  /**
   * Get unread count for a specific extension
   */
  getUnreadByExtension(extension: string): number {
    const data = this.readData();
    return data.voicemails.filter(vm => !vm.isRead && vm.extension === extension).length;
  }

  /**
   * Update a voicemail record with partial fields
   */
  update(id: string, updates: Partial<VoicemailMessage>): VoicemailMessage | null {
    const data = this.readData();
    const index = data.voicemails.findIndex(vm => vm.id === id);
    if (index < 0) return null;

    data.voicemails[index] = {
      ...data.voicemails[index],
      ...updates,
      id, // Prevent ID changes
      updatedAt: new Date().toISOString(),
    };
    this.writeData(data);

    return data.voicemails[index];
  }

  /**
   * Transcribe a voicemail using AI
   *
   * Uses OpenAI Whisper API for transcription when OPENAI_API_KEY is set.
   * Falls back to a placeholder message when the API key is not configured.
   */
  async transcribeVoicemail(id: string): Promise<VoicemailMessage | null> {
    const data = this.readData();
    const index = data.voicemails.findIndex(vm => vm.id === id);
    if (index < 0) return null;

    const voicemail = data.voicemails[index];

    const openaiKey = process.env.OPENAI_API_KEY;

    if (openaiKey && voicemail.audioUrl) {
      try {
        // Fetch the audio file
        const audioResponse = await fetch(voicemail.audioUrl);
        if (!audioResponse.ok) {
          throw new Error(`Failed to fetch audio: HTTP ${audioResponse.status}`);
        }
        const audioBlob = await audioResponse.blob();

        // Build multipart form data for Whisper API
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

    this.writeData(data);

    return voicemail;
  }

  /**
   * Get voicemail statistics
   */
  getStats(): {
    total: number;
    unread: number;
    urgent: number;
    avgDuration: number;
    byExtension: { extension: string; total: number; unread: number }[];
  } {
    const data = this.readData();
    const voicemails = data.voicemails;

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
