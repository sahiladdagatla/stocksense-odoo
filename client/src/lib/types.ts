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
  createdAt: string;
};
export type AuthResponse = { token: string; user: User };

export type Warehouse = {
  id: number;
  name: string;
  code: string;
  address: string | null;
  createdAt: string;
  _count?: { locations: number };
};
