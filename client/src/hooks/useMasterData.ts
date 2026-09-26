import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import type {
  OrgUser,
  Category,
  Location,
  Move,
  Paged,
  Product,
  ProductStock,
  WarehouseTree,
} from '@/lib/types';

export const useUsers = () =>
  useQuery({ queryKey: ['users'], queryFn: () => api.get<OrgUser[]>('/users') });

export const useCategories = () =>
  useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/categories') });

/** Internal locations (virtual ones only when asked). */
export const useLocations = (
  opts: { warehouseId?: number | null; includeVirtual?: boolean } = {},
) =>
  useQuery({
    queryKey: ['locations', opts.warehouseId ?? null, !!opts.includeVirtual],
    queryFn: () =>
      api.get<Location[]>('/locations', {
        warehouseId: opts.warehouseId ?? undefined,
        includeVirtual: opts.includeVirtual ? 'true' : undefined,
      }),
  });

export const useLocationTree = () =>
  useQuery({
    queryKey: ['locations', 'tree'],
    queryFn: () => api.get<WarehouseTree[]>('/locations/tree'),
  });

export type ProductFilters = {
  search?: string;
  categoryId?: number;
  warehouseId?: number | null;
  stockStatus?: string;
  page: number;
  pageSize?: number;
};

export const useProducts = (f: ProductFilters) =>
  useQuery({
    queryKey: ['products', f],
    queryFn: () =>
      api.get<Paged<Product>>('/products', {
        search: f.search,
        categoryId: f.categoryId,
        warehouseId: f.warehouseId ?? undefined,
        stockStatus: f.stockStatus,
        page: f.page,
        pageSize: f.pageSize ?? 12,
      }),
    placeholderData: (prev) => prev,
  });

export const useProduct = (id: number, enabled = true) =>
  useQuery({
    queryKey: ['products', id],
    queryFn: () => api.get<Product>(`/products/${id}`),
    enabled: enabled && id > 0,
  });

export const useProductStock = (id: number) =>
  useQuery({
    queryKey: ['products', id, 'stock'],
    queryFn: () => api.get<ProductStock>(`/products/${id}/stock`),
  });

export const useMoves = (params: Record<string, string | number | undefined>) =>
  useQuery({
    queryKey: ['moves', params],
    queryFn: () => api.get<Paged<Move>>('/moves', params),
    placeholderData: (prev) => prev,
  });

/**
 * Mutation with the app's conventions: success toast, error toast with the API message, and
 * invalidation of the given query roots.
 */
export function useApiMutation<TVars, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  opts: { success?: string | ((r: TResult) => string); invalidate?: string[] } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (result) => {
      if (opts.success) {
        toast.success(typeof opts.success === 'function' ? opts.success(result) : opts.success);
      }
      await Promise.all(
        (opts.invalidate ?? []).map((k) => qc.invalidateQueries({ queryKey: [k] })),
      );
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}
