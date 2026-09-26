import type { LocType, Role } from '@prisma/client';

export const USERS: { name: string; email: string; password: string; role: Role }[] = [
  {
    name: 'Maya Manager',
    email: 'manager@stocksense.dev',
    password: 'Manager@123',
    role: 'MANAGER',
  },
  { name: 'Sam Staff', email: 'staff@stocksense.dev', password: 'Staff@123', role: 'STAFF' },
];

export const WAREHOUSES = [
  { code: 'WH1', name: 'Main Warehouse', address: '12 Industrial Estate, Pune 411019' },
  { code: 'WH2', name: 'Secondary Warehouse', address: '48 Logistics Park, Mumbai 400072' },
];

export const VIRTUAL_LOCATIONS: { name: string; fullName: string; type: LocType }[] = [
  { name: 'Vendors', fullName: 'Virtual/Vendors', type: 'VENDOR' },
  { name: 'Customers', fullName: 'Virtual/Customers', type: 'CUSTOMER' },
  { name: 'Inventory Loss', fullName: 'Virtual/Inventory Loss', type: 'LOSS' },
];

/** Internal locations. `parent` refers to another entry's fullName and must appear earlier. */
export const INTERNAL_LOCATIONS: { warehouse: string; name: string; parent?: string }[] = [
  { warehouse: 'WH1', name: 'Stock' },
  { warehouse: 'WH1', name: 'Rack A', parent: 'WH1/Stock' },
  { warehouse: 'WH1', name: 'Rack B', parent: 'WH1/Stock' },
  { warehouse: 'WH1', name: 'Production Floor' },
  { warehouse: 'WH2', name: 'Stock' },
  { warehouse: 'WH2', name: 'Rack A', parent: 'WH2/Stock' },
];

export const CATEGORIES = [
  'Raw Materials',
  'Furniture',
  'Electronics',
  'Office Supplies',
  'Packaging',
];

export type SeedProduct = {
  sku: string;
  name: string;
  uom: string;
  category: string;
  reorderMin: number;
  reorderQty: number;
};

export const PRODUCTS: SeedProduct[] = [
  // Raw Materials
  {
    sku: 'RM-STL-001',
    name: 'Steel Rods',
    uom: 'kg',
    category: 'Raw Materials',
    reorderMin: 200,
    reorderQty: 500,
  },
  {
    sku: 'RM-ALU-002',
    name: 'Aluminium Sheets',
    uom: 'kg',
    category: 'Raw Materials',
    reorderMin: 100,
    reorderQty: 250,
  },
  {
    sku: 'RM-CPR-003',
    name: 'Copper Wire 2.5mm',
    uom: 'm',
    category: 'Raw Materials',
    reorderMin: 300,
    reorderQty: 1000,
  },
  {
    sku: 'RM-PLY-004',
    name: 'Plywood Board 18mm',
    uom: 'pcs',
    category: 'Raw Materials',
    reorderMin: 40,
    reorderQty: 100,
  },
  {
    sku: 'RM-PVC-005',
    name: 'PVC Pipe 2 inch',
    uom: 'm',
    category: 'Raw Materials',
    reorderMin: 150,
    reorderQty: 400,
  },
  // Furniture
  {
    sku: 'FU-CHR-001',
    name: 'Office Chair',
    uom: 'pcs',
    category: 'Furniture',
    reorderMin: 15,
    reorderQty: 40,
  },
  {
    sku: 'FU-DSK-002',
    name: 'Standing Desk',
    uom: 'pcs',
    category: 'Furniture',
    reorderMin: 8,
    reorderQty: 20,
  },
  {
    sku: 'FU-CAB-003',
    name: 'Filing Cabinet',
    uom: 'pcs',
    category: 'Furniture',
    reorderMin: 5,
    reorderQty: 12,
  },
  {
    sku: 'FU-TBL-004',
    name: 'Conference Table',
    uom: 'pcs',
    category: 'Furniture',
    reorderMin: 2,
    reorderQty: 5,
  },
  {
    sku: 'FU-SHF-005',
    name: 'Bookshelf',
    uom: 'pcs',
    category: 'Furniture',
    reorderMin: 6,
    reorderQty: 15,
  },
  // Electronics
  {
    sku: 'EL-MOU-001',
    name: 'Wireless Mouse',
    uom: 'pcs',
    category: 'Electronics',
    reorderMin: 30,
    reorderQty: 100,
  },
  {
    sku: 'EL-HUB-002',
    name: 'USB-C Hub',
    uom: 'pcs',
    category: 'Electronics',
    reorderMin: 20,
    reorderQty: 60,
  },
  {
    sku: 'EL-MON-003',
    name: '27" Monitor',
    uom: 'pcs',
    category: 'Electronics',
    reorderMin: 10,
    reorderQty: 25,
  },
  {
    sku: 'EL-KBD-004',
    name: 'Mechanical Keyboard',
    uom: 'pcs',
    category: 'Electronics',
    reorderMin: 15,
    reorderQty: 50,
  },
  {
    sku: 'EL-LED-005',
    name: 'LED Bulb 9W',
    uom: 'pcs',
    category: 'Electronics',
    reorderMin: 100,
    reorderQty: 300,
  },
  // Office Supplies
  {
    sku: 'OS-PAP-001',
    name: 'A4 Paper Ream',
    uom: 'ream',
    category: 'Office Supplies',
    reorderMin: 50,
    reorderQty: 200,
  },
  {
    sku: 'OS-PEN-002',
    name: 'Ballpoint Pens (Box of 50)',
    uom: 'box',
    category: 'Office Supplies',
    reorderMin: 10,
    reorderQty: 30,
  },
  {
    sku: 'OS-STP-003',
    name: 'Heavy Duty Stapler',
    uom: 'pcs',
    category: 'Office Supplies',
    reorderMin: 10,
    reorderQty: 25,
  },
  {
    sku: 'OS-NOT-004',
    name: 'Sticky Notes Pack',
    uom: 'pack',
    category: 'Office Supplies',
    reorderMin: 40,
    reorderQty: 120,
  },
  {
    sku: 'OS-MRK-005',
    name: 'Whiteboard Markers (Box of 12)',
    uom: 'box',
    category: 'Office Supplies',
    reorderMin: 8,
    reorderQty: 24,
  },
  // Packaging
  {
    sku: 'PK-BOX-001',
    name: 'Cardboard Box Large',
    uom: 'pcs',
    category: 'Packaging',
    reorderMin: 200,
    reorderQty: 500,
  },
  {
    sku: 'PK-BUB-002',
    name: 'Bubble Wrap Roll',
    uom: 'roll',
    category: 'Packaging',
    reorderMin: 20,
    reorderQty: 50,
  },
  {
    sku: 'PK-TAP-003',
    name: 'Packing Tape',
    uom: 'roll',
    category: 'Packaging',
    reorderMin: 60,
    reorderQty: 150,
  },
  {
    sku: 'PK-PAL-004',
    name: 'Wooden Pallet',
    uom: 'pcs',
    category: 'Packaging',
    reorderMin: 25,
    reorderQty: 60,
  },
  {
    sku: 'PK-STR-005',
    name: 'Stretch Film Roll',
    uom: 'roll',
    category: 'Packaging',
    reorderMin: 15,
    reorderQty: 40,
  },
];
