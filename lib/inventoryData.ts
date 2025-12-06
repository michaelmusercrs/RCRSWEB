// Inventory Data - Source: items for web.pdf
// Last Updated: December 2025

export interface InventoryProduct {
  productId: string;
  productName: string;
  description: string;
  imageUrl: string;
  cost: number;
  price: number;
  category: string;
  unit: string;
  minQty: number;
  maxQty: number;
  currentQty: number;
  supplier: string;
  location: string;
}

// 11 Inventory Items from PDF
export const inventoryProducts: InventoryProduct[] = [
  {
    productId: 'item-123',
    productName: '1 1/4 EG Nails',
    description: 'Electro-galvanized roofing nails, 1-1/4 inch length for shingle installation',
    imageUrl: '/uploads/inventory/nails-eg.jpg',
    cost: 27.50,
    price: 64.90,
    category: 'Fasteners',
    unit: 'box',
    minQty: 10,
    maxQty: 100,
    currentQty: 45,
    supplier: 'ABC Supply',
    location: 'Warehouse A'
  },
  {
    productId: 'item-124',
    productName: 'Bottom Caps (plastic)',
    description: 'Plastic cap nails for underlayment and felt installation',
    imageUrl: '/uploads/inventory/bottom-caps.jpg',
    cost: 16.50,
    price: 29.15,
    category: 'Fasteners',
    unit: 'bag',
    minQty: 20,
    maxQty: 200,
    currentQty: 85,
    supplier: 'ABC Supply',
    location: 'Warehouse A'
  },
  {
    productId: 'item-125',
    productName: 'RCRS Syn Felt',
    description: 'River City Roofing Solutions synthetic underlayment felt',
    imageUrl: '/uploads/inventory/syn-felt.jpg',
    cost: 66.00,
    price: 79.86,
    category: 'Underlayment',
    unit: 'roll',
    minQty: 15,
    maxQty: 150,
    currentQty: 62,
    supplier: 'IKO Industries',
    location: 'Warehouse B'
  },
  {
    productId: 'item-126',
    productName: 'Ice & Water Shield',
    description: 'Self-adhering ice and water barrier membrane for roof protection',
    imageUrl: '/uploads/inventory/ice-water-shield.jpg',
    cost: 62.70,
    price: 114.22,
    category: 'Underlayment',
    unit: 'roll',
    minQty: 10,
    maxQty: 100,
    currentQty: 38,
    supplier: 'GAF Materials',
    location: 'Warehouse B'
  },
  {
    productId: 'item-127',
    productName: 'Ridge Vent 4LF',
    description: '4 linear feet ridge vent for attic ventilation',
    imageUrl: '/uploads/inventory/ridge-vent.jpg',
    cost: 7.15,
    price: 10.20,
    category: 'Ventilation',
    unit: 'piece',
    minQty: 50,
    maxQty: 500,
    currentQty: 220,
    supplier: 'Air Vent Inc',
    location: 'Warehouse A'
  },
  {
    productId: 'item-128',
    productName: '1 1/2" Black Bullet Boot',
    description: '1.5 inch black EPDM pipe boot flashing',
    imageUrl: '/uploads/inventory/bullet-boot-1-5.jpg',
    cost: 16.67,
    price: 20.89,
    category: 'Flashing',
    unit: 'each',
    minQty: 25,
    maxQty: 250,
    currentQty: 95,
    supplier: 'Oatey',
    location: 'Warehouse A'
  },
  {
    productId: 'item-129',
    productName: '2" Black Bullet Boot',
    description: '2 inch black EPDM pipe boot flashing',
    imageUrl: '/uploads/inventory/bullet-boot-2.jpg',
    cost: 17.77,
    price: 22.54,
    category: 'Flashing',
    unit: 'each',
    minQty: 25,
    maxQty: 250,
    currentQty: 88,
    supplier: 'Oatey',
    location: 'Warehouse A'
  },
  {
    productId: 'item-130',
    productName: '3" Black Bullet Boot',
    description: '3 inch black EPDM pipe boot flashing',
    imageUrl: '/uploads/inventory/bullet-boot-3.jpg',
    cost: 20.19,
    price: 38.29,
    category: 'Flashing',
    unit: 'each',
    minQty: 20,
    maxQty: 200,
    currentQty: 72,
    supplier: 'Oatey',
    location: 'Warehouse A'
  },
  {
    productId: 'item-131',
    productName: '4" Black Bullet Boot',
    description: '4 inch black EPDM pipe boot flashing',
    imageUrl: '/uploads/inventory/bullet-boot-4.jpg',
    cost: 37.48,
    price: 42.50,
    category: 'Flashing',
    unit: 'each',
    minQty: 15,
    maxQty: 150,
    currentQty: 55,
    supplier: 'Oatey',
    location: 'Warehouse A'
  },
  {
    productId: 'item-132',
    productName: 'Sealant',
    description: 'Roofing sealant for flashing and repairs',
    imageUrl: '/uploads/inventory/sealant.jpg',
    cost: 9.35,
    price: 10.00,
    category: 'Sealants',
    unit: 'tube',
    minQty: 50,
    maxQty: 500,
    currentQty: 180,
    supplier: 'Geocel',
    location: 'Warehouse A'
  },
  {
    productId: 'item-133',
    productName: 'Zipper Boot',
    description: 'Split boot pipe flashing for retrofit installations',
    imageUrl: '/uploads/inventory/zipper-boot.jpg',
    cost: 37.40,
    price: 48.00,
    category: 'Flashing',
    unit: 'each',
    minQty: 10,
    maxQty: 100,
    currentQty: 42,
    supplier: 'Oatey',
    location: 'Warehouse A'
  }
];

// Get all inventory categories
export function getInventoryCategories(): string[] {
  return [...new Set(inventoryProducts.map(p => p.category))];
}

// Get product by ID
export function getProductById(productId: string): InventoryProduct | undefined {
  return inventoryProducts.find(p => p.productId === productId);
}

// Get products by category
export function getProductsByCategory(category: string): InventoryProduct[] {
  return inventoryProducts.filter(p => p.category === category);
}

// Get low stock items
export function getLowStockItems(): InventoryProduct[] {
  return inventoryProducts.filter(p => p.currentQty <= p.minQty);
}

// Calculate total inventory value
export function getTotalInventoryValue(): { cost: number; retail: number } {
  return inventoryProducts.reduce((acc, p) => ({
    cost: acc.cost + (p.currentQty * p.cost),
    retail: acc.retail + (p.currentQty * p.price)
  }), { cost: 0, retail: 0 });
}

// Calculate profit margin
export function getProductMargin(productId: string): number {
  const product = getProductById(productId);
  if (!product) return 0;
  return ((product.price - product.cost) / product.price) * 100;
}

// Update product stock (add or subtract)
export function updateProductStock(productId: string, quantity: number, operation: 'add' | 'subtract'): boolean {
  const product = inventoryProducts.find(p => p.productId === productId);
  if (!product) return false;

  if (operation === 'add') {
    product.currentQty += quantity;
  } else {
    product.currentQty = Math.max(0, product.currentQty - quantity);
  }

  return true;
}

// Get reorder point for a product (uses minQty as reorder point)
export function getReorderPoint(productId: string): number {
  const product = getProductById(productId);
  return product?.minQty || 10;
}
