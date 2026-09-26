import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Warehouse } from '@/lib/types';
import { useAuth } from './auth';

const KEY = 'stocksense-warehouse';

type Ctx = {
  warehouses: Warehouse[];
  /** null = all warehouses */
  warehouseId: number | null;
  current: Warehouse | null;
  setWarehouseId: (id: number | null) => void;
};

const WarehouseContext = createContext<Ctx | null>(null);

/** Global warehouse scope chosen in the top bar; pages use it as their default filter. */
export function WarehouseProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get<Warehouse[]>('/warehouses'),
    enabled: status === 'authenticated',
  });
  const [warehouseId, setId] = useState<number | null>(() => {
    try {
      const v = Number(localStorage.getItem(KEY));
      return Number.isInteger(v) && v > 0 ? v : null;
    } catch {
      return null;
    }
  });

  const setWarehouseId = useCallback((id: number | null) => {
    setId(id);
    try {
      if (id) localStorage.setItem(KEY, String(id));
      else localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => {
    // Ignore a remembered warehouse that no longer exists.
    const current = warehouses.find((w) => w.id === warehouseId) ?? null;
    return {
      warehouses,
      warehouseId: current ? current.id : null,
      current,
      setWarehouseId,
    };
  }, [warehouses, warehouseId, setWarehouseId]);

  return <WarehouseContext.Provider value={value}>{children}</WarehouseContext.Provider>;
}

export function useWarehouse() {
  const ctx = useContext(WarehouseContext);
  if (!ctx) throw new Error('useWarehouse must be used inside <WarehouseProvider>');
  return ctx;
}
