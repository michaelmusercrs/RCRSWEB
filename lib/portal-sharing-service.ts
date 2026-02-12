// Portal Sharing Service
// Controls which document categories and items are shared with customers
// Three levels: admin (global defaults) -> rep (per-customer refinement) -> customer (view only)

export interface SharingSettings {
  customerId: string;
  repSlug: string;
  categories: {
    estimate: boolean;
    checklist: boolean;
    invoice: boolean;
    photos: boolean;
    insuranceSummary: boolean;
    warranty: boolean;
    contract: boolean;
    inspection: boolean;
  };
  updatedAt: string;
  updatedBy: string;
}

const DEFAULT_SHARING: SharingSettings['categories'] = {
  estimate: true,
  checklist: true,
  invoice: true,
  photos: true,
  insuranceSummary: false,
  warranty: true,
  contract: true,
  inspection: true,
};

// In-memory cache of sharing settings (would normally be in a database)
const sharingCache = new Map<string, SharingSettings>();

class PortalSharingService {
  // Get sharing settings for a customer
  getSettings(customerId: string): SharingSettings {
    const cached = sharingCache.get(customerId);
    if (cached) return cached;

    // Return defaults if no custom settings
    return {
      customerId,
      repSlug: '',
      categories: { ...DEFAULT_SHARING },
      updatedAt: '',
      updatedBy: '',
    };
  }

  // Update sharing settings (rep or admin)
  updateSettings(
    customerId: string,
    categories: Partial<SharingSettings['categories']>,
    updatedBy: string,
    repSlug?: string
  ): SharingSettings {
    const current = this.getSettings(customerId);
    const updated: SharingSettings = {
      ...current,
      repSlug: repSlug || current.repSlug,
      categories: { ...current.categories, ...categories },
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    sharingCache.set(customerId, updated);
    return updated;
  }

  // Check if a specific category is shared for a customer
  isCategoryShared(customerId: string, category: keyof SharingSettings['categories']): boolean {
    const settings = this.getSettings(customerId);
    return settings.categories[category] ?? false;
  }

  // Get all shared categories for a customer
  getSharedCategories(customerId: string): string[] {
    const settings = this.getSettings(customerId);
    return Object.entries(settings.categories)
      .filter(([, enabled]) => enabled)
      .map(([category]) => category);
  }

  // Set admin-level global defaults
  setGlobalDefaults(categories: Partial<SharingSettings['categories']>): void {
    Object.assign(DEFAULT_SHARING, categories);
  }

  // Get global defaults
  getGlobalDefaults(): SharingSettings['categories'] {
    return { ...DEFAULT_SHARING };
  }

  // Get category display names
  getCategoryLabels(): Record<keyof SharingSettings['categories'], string> {
    return {
      estimate: 'Estimates',
      checklist: 'Pre-Install Checklist',
      invoice: 'Invoices',
      photos: 'Job Photos',
      insuranceSummary: 'Insurance Summary',
      warranty: 'Warranty Documents',
      contract: 'Contracts',
      inspection: 'Inspection Reports',
    };
  }
}

export const portalSharingService = new PortalSharingService();
