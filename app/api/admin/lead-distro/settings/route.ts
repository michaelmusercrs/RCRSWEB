// Lead Distribution Settings API
// GET: Read merged config from lead-distro-config.json + lead-distro-reassignment-config.json
// PUT: Save updated config to both JSON files with validation

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/auth-service';
import { getSalesReps } from '@/lib/team-roles';

const DISTRO_CONFIG_PATH = path.join(process.cwd(), 'data', 'lead-distro-config.json');
const REASSIGN_CONFIG_PATH = path.join(process.cwd(), 'data', 'lead-distro-reassignment-config.json');

interface DistroConfig {
  weights: Record<string, number>;
  thresholds: {
    proximityRadiusMiles: number;
    recentInteractionDays: number;
    staleInteractionDays: number;
    minRepsForDistribution: number;
  };
  responseTimers: {
    reminderMinutes: number;
    warningMinutes: number;
    urgentWarningMinutes: number;
    reassignMinutes: number;
  };
  counties: string[];
  updatedAt: string;
  updatedBy: string;
}

interface ReassignConfig {
  enabled: boolean;
  strategy: string;
  maxReassignments: number;
  cooldownMinutes: number;
  excludeRepSlugs: string[];
  notifyOriginalRep: boolean;
  notifyNewRep: boolean;
  notifyManager: boolean;
  afterMaxReassignments: string;
  warningChannels: {
    groupme: boolean;
    sms: boolean;
    email: boolean;
    inPortal: boolean;
  };
  warningRecipients: string;
  warningMessages: {
    reminder: string;
    warning: string;
    urgentWarning: string;
    reassigned: string;
  };
  soundAlerts: boolean;
  visualAlerts: boolean;
  timerStepsEnabled: {
    reminder: boolean;
    warning: boolean;
    urgentWarning: boolean;
    reassign: boolean;
  };
  updatedAt: string;
  updatedBy: string;
}

function readDistroConfig(): DistroConfig {
  try {
    const raw = readFileSync(DISTRO_CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {
      weights: {
        installProximity: 30,
        contactProximity: 15,
        doorKnockRecency: 10,
        referralBonus: 25,
        meetingAttendance: 10,
        closeRate: 5,
        responseTime: 5,
      },
      thresholds: {
        proximityRadiusMiles: 2.0,
        recentInteractionDays: 90,
        staleInteractionDays: 730,
        minRepsForDistribution: 2,
      },
      responseTimers: {
        reminderMinutes: 5,
        warningMinutes: 20,
        urgentWarningMinutes: 45,
        reassignMinutes: 60,
      },
      counties: ['Madison', 'Limestone', 'Morgan', 'Marshall', 'Jackson', 'DeKalb', 'Lawrence', 'Cullman', 'Blount', 'Etowah', 'Cherokee', 'Colbert', 'Franklin', 'Marion', 'Winston'],
      updatedAt: '',
      updatedBy: '',
    };
  }
}

function readReassignConfig(): ReassignConfig {
  try {
    const raw = readFileSync(REASSIGN_CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {
      enabled: true,
      strategy: 'next_best_score',
      maxReassignments: 3,
      cooldownMinutes: 15,
      excludeRepSlugs: [],
      notifyOriginalRep: true,
      notifyNewRep: true,
      notifyManager: true,
      afterMaxReassignments: 'escalate_manager',
      warningChannels: { groupme: true, sms: false, email: true, inPortal: true },
      warningRecipients: 'rep_and_manager',
      warningMessages: {
        reminder: 'Hey {repName}, you have a new lead from {customerName} at {address}. Please reach out ASAP!',
        warning: 'Reminder: Lead from {customerName} has been waiting {minutes} minutes for contact. Please respond soon.',
        urgentWarning: 'URGENT: Lead from {customerName} has been waiting {minutes} minutes. This lead will be reassigned in {remainingMinutes} minutes if not contacted.',
        reassigned: 'Lead from {customerName} has been reassigned from {originalRep} to {newRep} due to no response after {minutes} minutes.',
      },
      soundAlerts: true,
      visualAlerts: true,
      timerStepsEnabled: { reminder: true, warning: true, urgentWarning: true, reassign: true },
      updatedAt: '',
      updatedBy: '',
    };
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const distroConfig = readDistroConfig();
    const reassignConfig = readReassignConfig();

    // Merge into a single response
    const merged = {
      weights: distroConfig.weights,
      thresholds: distroConfig.thresholds,
      responseTimers: distroConfig.responseTimers,
      counties: distroConfig.counties,
      reassignment: {
        enabled: reassignConfig.enabled,
        strategy: reassignConfig.strategy,
        maxReassignments: reassignConfig.maxReassignments,
        cooldownMinutes: reassignConfig.cooldownMinutes,
        excludeRepSlugs: reassignConfig.excludeRepSlugs,
        notifyOriginalRep: reassignConfig.notifyOriginalRep,
        notifyNewRep: reassignConfig.notifyNewRep,
        notifyManager: reassignConfig.notifyManager,
        afterMaxReassignments: reassignConfig.afterMaxReassignments,
      },
      warningChannels: reassignConfig.warningChannels,
      warningRecipients: reassignConfig.warningRecipients,
      warningMessages: reassignConfig.warningMessages,
      soundAlerts: reassignConfig.soundAlerts,
      visualAlerts: reassignConfig.visualAlerts,
      timerStepsEnabled: reassignConfig.timerStepsEnabled,
      salesReps: getSalesReps().map(r => ({
        slug: r.slug,
        name: r.name,
        isActive: r.isActive,
      })),
      updatedAt: distroConfig.updatedAt || reassignConfig.updatedAt,
      updatedBy: distroConfig.updatedBy || reassignConfig.updatedBy,
    };

    return NextResponse.json({ success: true, config: merged });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to read config' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { config, updatedBy } = body;

    if (!config) {
      return NextResponse.json(
        { success: false, error: 'Config object required' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const user = updatedBy || 'admin';

    // ── Validate weights sum to 100 ────────────────────────────────────────
    if (config.weights) {
      const weightSum = Object.values(config.weights as Record<string, number>).reduce(
        (sum: number, w: number) => sum + Number(w),
        0
      );
      if (Math.abs(weightSum - 100) > 0.5) {
        return NextResponse.json(
          { success: false, error: `Weights must sum to 100, currently ${weightSum.toFixed(1)}` },
          { status: 400 }
        );
      }
    }

    // ── Validate timer values are ascending ────────────────────────────────
    if (config.responseTimers) {
      const t = config.responseTimers;
      if (t.reminderMinutes >= t.warningMinutes) {
        return NextResponse.json(
          { success: false, error: 'Reminder time must be less than warning time' },
          { status: 400 }
        );
      }
      if (t.warningMinutes >= t.urgentWarningMinutes) {
        return NextResponse.json(
          { success: false, error: 'Warning time must be less than urgent warning time' },
          { status: 400 }
        );
      }
      if (t.urgentWarningMinutes >= t.reassignMinutes) {
        return NextResponse.json(
          { success: false, error: 'Urgent warning time must be less than reassignment time' },
          { status: 400 }
        );
      }
      if (t.reminderMinutes < 1) {
        return NextResponse.json(
          { success: false, error: 'Reminder time must be at least 1 minute' },
          { status: 400 }
        );
      }
    }

    // ── Save lead-distro-config.json ───────────────────────────────────────
    const existingDistro = readDistroConfig();
    const updatedDistro: DistroConfig = {
      weights: config.weights || existingDistro.weights,
      thresholds: config.thresholds
        ? { ...existingDistro.thresholds, ...config.thresholds }
        : existingDistro.thresholds,
      responseTimers: config.responseTimers
        ? { ...existingDistro.responseTimers, ...config.responseTimers }
        : existingDistro.responseTimers,
      counties: config.counties || existingDistro.counties,
      updatedAt: now,
      updatedBy: user,
    };
    writeFileSync(DISTRO_CONFIG_PATH, JSON.stringify(updatedDistro, null, 2), 'utf-8');

    // ── Save lead-distro-reassignment-config.json ──────────────────────────
    const existingReassign = readReassignConfig();
    const updatedReassign: ReassignConfig = {
      enabled: config.reassignment?.enabled ?? existingReassign.enabled,
      strategy: config.reassignment?.strategy || existingReassign.strategy,
      maxReassignments: config.reassignment?.maxReassignments ?? existingReassign.maxReassignments,
      cooldownMinutes: config.reassignment?.cooldownMinutes ?? existingReassign.cooldownMinutes,
      excludeRepSlugs: config.reassignment?.excludeRepSlugs ?? existingReassign.excludeRepSlugs,
      notifyOriginalRep: config.reassignment?.notifyOriginalRep ?? existingReassign.notifyOriginalRep,
      notifyNewRep: config.reassignment?.notifyNewRep ?? existingReassign.notifyNewRep,
      notifyManager: config.reassignment?.notifyManager ?? existingReassign.notifyManager,
      afterMaxReassignments: config.reassignment?.afterMaxReassignments || existingReassign.afterMaxReassignments,
      warningChannels: config.warningChannels
        ? { ...existingReassign.warningChannels, ...config.warningChannels }
        : existingReassign.warningChannels,
      warningRecipients: config.warningRecipients || existingReassign.warningRecipients,
      warningMessages: config.warningMessages
        ? { ...existingReassign.warningMessages, ...config.warningMessages }
        : existingReassign.warningMessages,
      soundAlerts: config.soundAlerts ?? existingReassign.soundAlerts,
      visualAlerts: config.visualAlerts ?? existingReassign.visualAlerts,
      timerStepsEnabled: config.timerStepsEnabled
        ? { ...existingReassign.timerStepsEnabled, ...config.timerStepsEnabled }
        : existingReassign.timerStepsEnabled,
      updatedAt: now,
      updatedBy: user,
    };
    writeFileSync(REASSIGN_CONFIG_PATH, JSON.stringify(updatedReassign, null, 2), 'utf-8');

    return NextResponse.json({ success: true, message: 'Settings saved successfully' });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to save config' },
      { status: 500 }
    );
  }
}
