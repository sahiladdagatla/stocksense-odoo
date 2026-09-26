import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  OperationCounts,
  OperationDetail,
  OperationSummary,
  OpStatus,
  OpType,
  Paged,
} from '@/lib/types';

export type OperationFilters = {
  type?: OpType;
  status?: OpStatus[];
  warehouseId?: number | null;
  categoryId?: number;
  search?: string;
  page?: number;
  pageSize?: number;
};

const toQuery = (f: OperationFilters) => ({
  type: f.type,
  status: f.status?.length ? f.status : undefined,
  warehouseId: f.warehouseId ?? undefined,
  categoryId: f.categoryId,
  search: f.search || undefined,
  page: f.page ?? 1,
  pageSize: f.pageSize ?? 10,
});

export const useOperations = (f: OperationFilters, enabled = true) =>
  useQuery({
    queryKey: ['operations', 'list', f],
    queryFn: () => api.get<Paged<OperationSummary>>('/operations', toQuery(f)),
    placeholderData: (prev) => prev,
    enabled,
  });

export const useOperationCounts = (f: Omit<OperationFilters, 'status' | 'page' | 'pageSize'>) =>
  useQuery({
    queryKey: ['operations', 'counts', f],
    queryFn: () => api.get<OperationCounts>('/operations/counts', toQuery(f)),
  });

export const useOperation = (id: number | null) =>
  useQuery({
    queryKey: ['operations', 'detail', id],
    queryFn: () => api.get<OperationDetail>(`/operations/${id}`),
    enabled: !!id,
  });
