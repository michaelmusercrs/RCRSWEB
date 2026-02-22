/**
 * Inventory Management Service — BACKWARD COMPATIBILITY WRAPPER
 *
 * This file now delegates to unified-inventory-service.ts.
 * All existing imports of inventoryManagementService continue to work.
 * 
 * DO NOT add new features here. Use unified-inventory-service.ts directly.
 */

// Re-export everything from the unified service
export {
  unifiedInventoryService as inventoryManagementService,
  unifiedInventoryService,
  CATEGORY_LABELS,
  resolveProductId,
  getLegacyIds,
} from './unified-inventory-service';

export type {
  InventoryItem,
  InventoryCategory,
  InventoryFilters,
  InventoryTransaction,
  CountSession,
  CountRecord,
  RestockOrder,
  RestockOrderItem,
  RestockOrderStatus,
  PricingRecord,
  PricingReport,
  StockAlert,
  AlertSeverity,
  MaterialHold,
  ReturnTicket,
  ReturnItem,
  ReturnType,
  ReturnStatus,
} from './unified-inventory-service';

// Legacy type aliases for code that imports specific old types
export type DiscrepancyResolution = 'adjust_system' | 'recount' | 'write_off' | 'no_action';
export type DiscrepancyReason = 'damaged' | 'miscount' | 'theft' | 'received_not_logged' | 'used_not_logged' | 'other';

export interface CustomAlertRule {
  ruleId: string;
  productId: string;
  threshold: number;
  notifyRoles: string[];
  createdAt: string;
  active: boolean;
}

export interface StockTrendPoint {
  date: string;
  qty: number;
}

export interface RestockFilters {
  status?: string;
  supplier?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CategoryMargin {
  category: string;
  itemCount: number;
  avgCost: number;
  avgPrice: number;
  avgMarkup: number;
  avgMarginPercent: number;
  totalCostValue: number;
  totalRetailValue: number;
}
