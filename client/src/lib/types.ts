/** API response shapes (mirrors the server). Quantities arrive as JSON numbers. */

export type Role = 'MANAGER' | 'STAFF';
export type LocType = 'INTERNAL' | 'VENDOR' | 'CUSTOMER' | 'LOSS';
export type OpType = 'RECEIPT' | 'DELIVERY' | 'INTERNAL' | 'ADJUSTMENT';
export type OpStatus = 'DRAFT' | 'WAITING' | 'READY' | 'DONE' | 'CANCELED';
export type StockStatus = 'IN_STOCK' | 'LOW' | 'OUT';

export type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };

export type User = {
  id: number;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
};
export type OrgUser = User & { movesRecorded: number; lastActivityAt: string | null };
export type AuthResponse = { token: string; user: User };
export type UserStats = {
  operationsValidated: number;
  adjustmentsLogged: number;
  lastActivityAt: string | null;
};

export type Warehouse = {
  id: number;
  name: string;
  code: string;
  address: string | null;
  createdAt: string;
  _count?: { locations: number };
};

export type Location = {
  id: number;
  name: string;
  fullName: string;
  type: LocType;
  warehouseId: number | null;
  parentId: number | null;
  warehouse?: { id: number; code: string; name: string } | null;
};

export type LocationNode = Location & { onHand: number; children: LocationNode[] };
export type WarehouseTree = Warehouse & { locations: LocationNode[] };

export type Category = { id: number; name: string; _count?: { products: number } };

export type Product = {
  id: number;
  name: string;
  sku: string;
  uom: string;
  categoryId: number;
  category: { id: number; name: string };
  reorderMin: number;
  reorderQty: number;
  createdAt: string;
  onHand: number;
  stockStatus: StockStatus;
};

export type ProductStock = {
  product: Product;
  total: number;
  locations: {
    location: {
      id: number;
      name: string;
      fullName: string;
      warehouse: { id: number; code: string; name: string } | null;
    };
    quantity: number;
  }[];
  avgDailyOut: number;
  daysLeft: number | null;
};

export type LocRef = { id: number; fullName: string; type: LocType };

export type Move = {
  id: number;
  productId: number;
  quantity: number;
  createdAt: string;
  product: { id: number; name: string; sku: string; uom: string };
  fromLoc: LocRef;
  toLoc: LocRef;
  operation: {
    id: number;
    reference: string;
    type: OpType;
    partner: string | null;
    notes: string | null;
  } | null;
  user: { id: number; name: string };
};

export type OpLoc = {
  id: number;
  name: string;
  fullName: string;
  type: LocType;
  warehouseId: number | null;
};

export type OperationSummary = {
  id: number;
  reference: string;
  type: OpType;
  status: OpStatus;
  partner: string | null;
  sourceLocId: number;
  destLocId: number;
  sourceLoc: OpLoc;
  destLoc: OpLoc;
  scheduledDate: string;
  validatedAt: string | null;
  notes: string | null;
  createdAt: string;
  createdBy: { id: number; name: string };
  _count: { lines: number };
};

export type OperationLine = {
  id: number;
  productId: number;
  demandQty: number;
  doneQty: number;
  availableQty: number | null;
  product: { id: number; name: string; sku: string; uom: string };
};

export type OpLink = { id: number; reference: string; status: OpStatus };

export type OperationDetail = Omit<OperationSummary, '_count' | 'createdBy'> & {
  createdBy: { id: number; name: string; role: Role };
  lines: OperationLine[];
  /** Set when this document holds the remainder of a partially validated one. */
  backorderOf: OpLink | null;
  backorders: OpLink[];
};

export type OperationCounts = Record<OpStatus, number> & { total: number };
