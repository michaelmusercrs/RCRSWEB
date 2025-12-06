// Billing Pricing Data - Integrated with inventory pricing from PDF
// Last Updated: December 2025

import { inventoryProducts } from './inventoryData';

export interface PricingRule {
  ruleId: string;
  name: string;
  description: string;
  type: 'markup' | 'discount' | 'fixed' | 'tiered';
  applicableTo: 'all' | 'category' | 'product' | 'customer';
  categoryFilter?: string;
  productFilter?: string[];
  customerType?: 'residential' | 'commercial' | 'contractor' | 'insurance';
  value: number; // percentage for markup/discount, fixed amount for fixed
  minOrderAmount?: number;
  maxOrderAmount?: number;
  startDate?: string;
  endDate?: string;
  active: boolean;
}

export interface PriceTier {
  minQty: number;
  maxQty: number;
  pricePerUnit: number;
  discountPercent: number;
}

// Default pricing rules
export const pricingRules: PricingRule[] = [
  {
    ruleId: 'RULE-001',
    name: 'Standard Markup',
    description: 'Default markup for all materials',
    type: 'markup',
    applicableTo: 'all',
    value: 25, // 25% markup
    active: true
  },
  {
    ruleId: 'RULE-002',
    name: 'Contractor Discount',
    description: 'Discount for contractor customers',
    type: 'discount',
    applicableTo: 'customer',
    customerType: 'contractor',
    value: 10, // 10% discount
    active: true
  },
  {
    ruleId: 'RULE-003',
    name: 'Commercial Markup',
    description: 'Higher markup for commercial jobs',
    type: 'markup',
    applicableTo: 'customer',
    customerType: 'commercial',
    value: 35, // 35% markup
    active: true
  },
  {
    ruleId: 'RULE-004',
    name: 'Insurance Claim Pricing',
    description: 'Pricing for insurance covered jobs',
    type: 'markup',
    applicableTo: 'customer',
    customerType: 'insurance',
    value: 30, // 30% markup
    active: true
  },
  {
    ruleId: 'RULE-005',
    name: 'Bulk Order Discount',
    description: 'Discount for orders over $5000',
    type: 'discount',
    applicableTo: 'all',
    minOrderAmount: 5000,
    value: 5, // 5% discount
    active: true
  },
  {
    ruleId: 'RULE-006',
    name: 'Flashing Premium',
    description: 'Additional markup for flashing products',
    type: 'markup',
    applicableTo: 'category',
    categoryFilter: 'Flashing',
    value: 40, // 40% markup
    active: true
  }
];

// Volume pricing tiers for specific products
export const volumePricing: Record<string, PriceTier[]> = {
  'item-123': [ // 1 1/4 EG Nails
    { minQty: 1, maxQty: 10, pricePerUnit: 64.90, discountPercent: 0 },
    { minQty: 11, maxQty: 25, pricePerUnit: 61.65, discountPercent: 5 },
    { minQty: 26, maxQty: 50, pricePerUnit: 58.41, discountPercent: 10 },
    { minQty: 51, maxQty: 999, pricePerUnit: 55.16, discountPercent: 15 }
  ],
  'item-125': [ // RCRS Syn Felt
    { minQty: 1, maxQty: 10, pricePerUnit: 79.86, discountPercent: 0 },
    { minQty: 11, maxQty: 30, pricePerUnit: 75.87, discountPercent: 5 },
    { minQty: 31, maxQty: 60, pricePerUnit: 71.87, discountPercent: 10 },
    { minQty: 61, maxQty: 999, pricePerUnit: 67.88, discountPercent: 15 }
  ],
  'item-126': [ // Ice & Water Shield
    { minQty: 1, maxQty: 5, pricePerUnit: 114.22, discountPercent: 0 },
    { minQty: 6, maxQty: 15, pricePerUnit: 108.51, discountPercent: 5 },
    { minQty: 16, maxQty: 30, pricePerUnit: 102.80, discountPercent: 10 },
    { minQty: 31, maxQty: 999, pricePerUnit: 97.09, discountPercent: 15 }
  ],
  'item-127': [ // Ridge Vent 4LF
    { minQty: 1, maxQty: 50, pricePerUnit: 10.20, discountPercent: 0 },
    { minQty: 51, maxQty: 100, pricePerUnit: 9.69, discountPercent: 5 },
    { minQty: 101, maxQty: 200, pricePerUnit: 9.18, discountPercent: 10 },
    { minQty: 201, maxQty: 999, pricePerUnit: 8.67, discountPercent: 15 }
  ]
};

// Calculate price for a product with quantity and customer type
export function calculatePrice(
  productId: string,
  quantity: number,
  customerType: 'residential' | 'commercial' | 'contractor' | 'insurance' = 'residential'
): {
  unitPrice: number;
  totalPrice: number;
  unitCost: number;
  totalCost: number;
  markup: number;
  appliedRules: string[];
} {
  const product = inventoryProducts.find(p => p.productId === productId);
  if (!product) {
    throw new Error(`Product ${productId} not found`);
  }

  let unitPrice = product.price;
  const unitCost = product.cost;
  const appliedRules: string[] = [];

  // Check for volume pricing
  const volumeTiers = volumePricing[productId];
  if (volumeTiers) {
    const applicableTier = volumeTiers.find(t => quantity >= t.minQty && quantity <= t.maxQty);
    if (applicableTier) {
      unitPrice = applicableTier.pricePerUnit;
      if (applicableTier.discountPercent > 0) {
        appliedRules.push(`Volume discount: ${applicableTier.discountPercent}%`);
      }
    }
  }

  // Apply category-specific rules
  const categoryRules = pricingRules.filter(r =>
    r.active &&
    r.applicableTo === 'category' &&
    r.categoryFilter === product.category
  );

  categoryRules.forEach(rule => {
    if (rule.type === 'markup') {
      const basePrice = product.cost * (1 + rule.value / 100);
      if (basePrice > unitPrice) {
        unitPrice = basePrice;
        appliedRules.push(`${rule.name}: +${rule.value}%`);
      }
    }
  });

  // Apply customer-type specific rules
  const customerRules = pricingRules.filter(r =>
    r.active &&
    r.applicableTo === 'customer' &&
    r.customerType === customerType
  );

  customerRules.forEach(rule => {
    if (rule.type === 'markup') {
      unitPrice = product.cost * (1 + rule.value / 100);
      appliedRules.push(`${rule.name}: +${rule.value}%`);
    } else if (rule.type === 'discount') {
      unitPrice = unitPrice * (1 - rule.value / 100);
      appliedRules.push(`${rule.name}: -${rule.value}%`);
    }
  });

  const totalPrice = unitPrice * quantity;
  const totalCost = unitCost * quantity;

  // Check for bulk discount
  const bulkRules = pricingRules.filter(r =>
    r.active &&
    r.type === 'discount' &&
    r.minOrderAmount &&
    totalPrice >= r.minOrderAmount
  );

  let finalTotal = totalPrice;
  bulkRules.forEach(rule => {
    finalTotal = finalTotal * (1 - rule.value / 100);
    appliedRules.push(`${rule.name}: -${rule.value}%`);
  });

  const finalUnitPrice = finalTotal / quantity;
  const markup = ((finalUnitPrice - unitCost) / unitCost) * 100;

  return {
    unitPrice: Math.round(finalUnitPrice * 100) / 100,
    totalPrice: Math.round(finalTotal * 100) / 100,
    unitCost,
    totalCost,
    markup: Math.round(markup * 10) / 10,
    appliedRules
  };
}

// Get all products with their current pricing
export function getProductPricingList(customerType: 'residential' | 'commercial' | 'contractor' | 'insurance' = 'residential') {
  return inventoryProducts.map(product => {
    const pricing = calculatePrice(product.productId, 1, customerType);
    return {
      productId: product.productId,
      productName: product.productName,
      category: product.category,
      description: product.description,
      unitCost: product.cost,
      basePrice: product.price,
      customerPrice: pricing.unitPrice,
      markup: pricing.markup,
      appliedRules: pricing.appliedRules,
      imageUrl: product.imageUrl,
      inStock: product.currentQty > 0,
      stockQty: product.currentQty
    };
  });
}

// Calculate order total with all applicable discounts
export function calculateOrderTotal(
  items: { productId: string; quantity: number }[],
  customerType: 'residential' | 'commercial' | 'contractor' | 'insurance' = 'residential'
): {
  items: { productId: string; productName: string; quantity: number; unitPrice: number; totalPrice: number; unitCost: number; totalCost: number }[];
  subtotal: number;
  totalCost: number;
  discount: number;
  finalTotal: number;
  margin: number;
  appliedRules: string[];
} {
  let allAppliedRules = new Set<string>();

  const calculatedItems = items.map(item => {
    const product = inventoryProducts.find(p => p.productId === item.productId);
    if (!product) {
      throw new Error(`Product ${item.productId} not found`);
    }

    const pricing = calculatePrice(item.productId, item.quantity, customerType);
    pricing.appliedRules.forEach(r => allAppliedRules.add(r));

    return {
      productId: item.productId,
      productName: product.productName,
      quantity: item.quantity,
      unitPrice: pricing.unitPrice,
      totalPrice: pricing.totalPrice,
      unitCost: pricing.unitCost,
      totalCost: pricing.totalCost
    };
  });

  const subtotal = calculatedItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const totalCost = calculatedItems.reduce((sum, item) => sum + item.totalCost, 0);

  // Check for order-level bulk discount
  let finalTotal = subtotal;
  const bulkRules = pricingRules.filter(r =>
    r.active &&
    r.type === 'discount' &&
    r.applicableTo === 'all' &&
    r.minOrderAmount &&
    subtotal >= r.minOrderAmount
  );

  bulkRules.forEach(rule => {
    finalTotal = finalTotal * (1 - rule.value / 100);
    allAppliedRules.add(`${rule.name}: -${rule.value}%`);
  });

  const discount = subtotal - finalTotal;
  const margin = ((finalTotal - totalCost) / finalTotal) * 100;

  return {
    items: calculatedItems,
    subtotal: Math.round(subtotal * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    finalTotal: Math.round(finalTotal * 100) / 100,
    margin: Math.round(margin * 10) / 10,
    appliedRules: Array.from(allAppliedRules)
  };
}

// Margin analysis for inventory
export function getMarginAnalysis() {
  return inventoryProducts.map(product => ({
    productId: product.productId,
    productName: product.productName,
    category: product.category,
    cost: product.cost,
    price: product.price,
    margin: ((product.price - product.cost) / product.price) * 100,
    marginDollars: product.price - product.cost,
    stockValue: product.currentQty * product.cost,
    potentialRevenue: product.currentQty * product.price,
    potentialProfit: product.currentQty * (product.price - product.cost)
  })).sort((a, b) => b.margin - a.margin);
}
