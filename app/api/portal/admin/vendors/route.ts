/**
 * Vendor & Supplier Master API
 *
 * Admin-only CRUD for suppliers and subcontractors stored in
 * data/breakdown-dropdowns.json. Lets owners/admins manage the vendor
 * master list without hand-editing JSON.
 *
 * All mutations go through saveDropdownConfig() from
 * customer-breakdown-service so the breakdown portal cache stays in sync.
 *
 * Delete is HARD delete — the config is user-managed and Michael wants
 * bad entries gone, not soft-flagged. Use the PATCH active:false toggle
 * for temporary deactivation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import {
  loadDropdownConfig,
  saveDropdownConfig,
  clearDropdownConfigCache,
  type BreakdownDropdownConfig,
} from '@/lib/customer-breakdown-service';

// ─── Types ───────────────────────────────────────────────────────────────

type VendorType = 'supplier' | 'subcontractor';

interface PostBody {
  type?: VendorType;
  name?: string;
  category?: string;
  trade?: string;
  active?: boolean;
}

interface PatchBody {
  type?: VendorType;
  oldName?: string;
  updates?: {
    name?: string;
    category?: string;
    trade?: string;
    active?: boolean;
  };
}

interface DeleteBody {
  type?: VendorType;
  name?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

const VALID_SUPPLIER_CATEGORIES = new Set([
  'roofing_materials',
  'hardware',
  'metal_specialty',
  'measurement_service',
  'misc',
  'other',
]);

const VALID_SUBCONTRACTOR_TRADES = new Set([
  'install_crew',
  'gutter_crew',
  'cleanup_crew',
  'specialty',
  'other',
]);

function normalize(name: string): string {
  return name.toLowerCase().trim();
}

function isValidType(t: unknown): t is VendorType {
  return t === 'supplier' || t === 'subcontractor';
}

function successPayload(config: BreakdownDropdownConfig) {
  return {
    success: true as const,
    suppliers: config.suppliers,
    subcontractors: config.subcontractors,
  };
}

// ─── GET — list all suppliers + subcontractors (including inactive) ──────

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    // Always read fresh so admin sees latest state even if another admin
    // just changed something
    clearDropdownConfigCache();
    const config = await loadDropdownConfig();

    return NextResponse.json(successPayload(config));
  } catch (err) {
    console.error('[admin/vendors GET] failed:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to load vendor config',
      },
      { status: 500 }
    );
  }
}

// ─── POST — add a new supplier or subcontractor ──────────────────────────

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = (await request.json()) as PostBody;
    const { type, name, category, trade } = body;
    const active = body.active ?? true;

    if (!isValidType(type)) {
      return NextResponse.json(
        { success: false, error: 'type must be "supplier" or "subcontractor"' },
        { status: 400 }
      );
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'name is required' },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();

    clearDropdownConfigCache();
    const config = await loadDropdownConfig();

    if (type === 'supplier') {
      const dup = config.suppliers.find(s => normalize(s.name) === normalize(trimmedName));
      if (dup) {
        return NextResponse.json(
          { success: false, error: `Supplier "${trimmedName}" already exists` },
          { status: 400 }
        );
      }

      const cat = (category || 'misc').trim();
      if (!VALID_SUPPLIER_CATEGORIES.has(cat)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid supplier category "${cat}". Must be one of: ${Array.from(
              VALID_SUPPLIER_CATEGORIES
            ).join(', ')}`,
          },
          { status: 400 }
        );
      }

      config.suppliers = [
        ...config.suppliers,
        { name: trimmedName, category: cat, active },
      ];
    } else {
      const dup = config.subcontractors.find(
        s => normalize(s.name) === normalize(trimmedName)
      );
      if (dup) {
        return NextResponse.json(
          { success: false, error: `Subcontractor "${trimmedName}" already exists` },
          { status: 400 }
        );
      }

      const tr = (trade || 'install_crew').trim();
      if (!VALID_SUBCONTRACTOR_TRADES.has(tr)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid subcontractor trade "${tr}". Must be one of: ${Array.from(
              VALID_SUBCONTRACTOR_TRADES
            ).join(', ')}`,
          },
          { status: 400 }
        );
      }

      config.subcontractors = [
        ...config.subcontractors,
        { name: trimmedName, trade: tr, active },
      ];
    }

    await saveDropdownConfig(config);
    return NextResponse.json(successPayload(config));
  } catch (err) {
    console.error('[admin/vendors POST] failed:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to add vendor',
      },
      { status: 500 }
    );
  }
}

// ─── PATCH — edit an existing supplier or subcontractor ──────────────────

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = (await request.json()) as PatchBody;
    const { type, oldName, updates } = body;

    if (!isValidType(type)) {
      return NextResponse.json(
        { success: false, error: 'type must be "supplier" or "subcontractor"' },
        { status: 400 }
      );
    }

    if (!oldName || typeof oldName !== 'string') {
      return NextResponse.json(
        { success: false, error: 'oldName is required' },
        { status: 400 }
      );
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json(
        { success: false, error: 'updates object is required' },
        { status: 400 }
      );
    }

    clearDropdownConfigCache();
    const config = await loadDropdownConfig();

    const key = normalize(oldName);

    if (type === 'supplier') {
      const idx = config.suppliers.findIndex(s => normalize(s.name) === key);
      if (idx === -1) {
        return NextResponse.json(
          { success: false, error: `Supplier "${oldName}" not found` },
          { status: 404 }
        );
      }

      const current = config.suppliers[idx];
      const nextName = updates.name?.trim() || current.name;

      // If renaming, ensure no duplicate (other than self)
      if (normalize(nextName) !== key) {
        const dup = config.suppliers.find(
          (s, i) => i !== idx && normalize(s.name) === normalize(nextName)
        );
        if (dup) {
          return NextResponse.json(
            { success: false, error: `Supplier "${nextName}" already exists` },
            { status: 400 }
          );
        }
      }

      let nextCategory = current.category;
      if (updates.category !== undefined) {
        const cat = updates.category.trim();
        if (!VALID_SUPPLIER_CATEGORIES.has(cat)) {
          return NextResponse.json(
            {
              success: false,
              error: `Invalid supplier category "${cat}"`,
            },
            { status: 400 }
          );
        }
        nextCategory = cat;
      }

      config.suppliers[idx] = {
        name: nextName,
        category: nextCategory,
        active: updates.active !== undefined ? !!updates.active : current.active,
      };
    } else {
      const idx = config.subcontractors.findIndex(s => normalize(s.name) === key);
      if (idx === -1) {
        return NextResponse.json(
          { success: false, error: `Subcontractor "${oldName}" not found` },
          { status: 404 }
        );
      }

      const current = config.subcontractors[idx];
      const nextName = updates.name?.trim() || current.name;

      if (normalize(nextName) !== key) {
        const dup = config.subcontractors.find(
          (s, i) => i !== idx && normalize(s.name) === normalize(nextName)
        );
        if (dup) {
          return NextResponse.json(
            { success: false, error: `Subcontractor "${nextName}" already exists` },
            { status: 400 }
          );
        }
      }

      let nextTrade = current.trade;
      if (updates.trade !== undefined) {
        const tr = updates.trade.trim();
        if (!VALID_SUBCONTRACTOR_TRADES.has(tr)) {
          return NextResponse.json(
            {
              success: false,
              error: `Invalid subcontractor trade "${tr}"`,
            },
            { status: 400 }
          );
        }
        nextTrade = tr;
      }

      config.subcontractors[idx] = {
        name: nextName,
        trade: nextTrade,
        active: updates.active !== undefined ? !!updates.active : current.active,
      };
    }

    await saveDropdownConfig(config);
    return NextResponse.json(successPayload(config));
  } catch (err) {
    console.error('[admin/vendors PATCH] failed:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update vendor',
      },
      { status: 500 }
    );
  }
}

// ─── DELETE — hard-remove a supplier or subcontractor ────────────────────

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = (await request.json()) as DeleteBody;
    const { type, name } = body;

    if (!isValidType(type)) {
      return NextResponse.json(
        { success: false, error: 'type must be "supplier" or "subcontractor"' },
        { status: 400 }
      );
    }

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { success: false, error: 'name is required' },
        { status: 400 }
      );
    }

    clearDropdownConfigCache();
    const config = await loadDropdownConfig();

    const key = normalize(name);

    if (type === 'supplier') {
      const before = config.suppliers.length;
      config.suppliers = config.suppliers.filter(s => normalize(s.name) !== key);
      if (config.suppliers.length === before) {
        return NextResponse.json(
          { success: false, error: `Supplier "${name}" not found` },
          { status: 404 }
        );
      }
    } else {
      const before = config.subcontractors.length;
      config.subcontractors = config.subcontractors.filter(
        s => normalize(s.name) !== key
      );
      if (config.subcontractors.length === before) {
        return NextResponse.json(
          { success: false, error: `Subcontractor "${name}" not found` },
          { status: 404 }
        );
      }
    }

    await saveDropdownConfig(config);
    return NextResponse.json(successPayload(config));
  } catch (err) {
    console.error('[admin/vendors DELETE] failed:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete vendor',
      },
      { status: 500 }
    );
  }
}
