import { useState, type FormEvent } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { Category } from '@/lib/types';
import { useApiMutation, useCategories } from '@/hooks/useMasterData';

function Row({ c }: { c: Category }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(c.name);
  const rename = useApiMutation((n: string) => api.patch(`/categories/${c.id}`, { name: n }), {
    success: 'Category renamed',
    invalidate: ['categories', 'products'],
  });
  const remove = useApiMutation(() => api.delete(`/categories/${c.id}`), {
    success: 'Category deleted',
    invalidate: ['categories'],
  });
  const count = c._count?.products ?? 0;

  if (editing) {
    return (
      <li className="flex items-center gap-2 py-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus className="h-9" />
        <Button
          size="icon-sm"
          aria-label="Save"
          disabled={!name.trim() || rename.isPending}
          onClick={() => rename.mutate(name.trim(), { onSuccess: () => setEditing(false) })}
        >
          <Check />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Cancel"
          onClick={() => setEditing(false)}
        >
          <X />
        </Button>
      </li>
    );
  }
  return (
    <li className="flex items-center gap-2 py-2">
      <span className="flex-1 text-sm text-ink">{c.name}</span>
      <span className="text-xs text-muted-foreground">
        {count} product{count === 1 ? '' : 's'}
      </span>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={`Rename ${c.name}`}
        onClick={() => setEditing(true)}
      >
        <Pencil />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost-danger"
        aria-label={`Delete ${c.name}`}
        title={count ? 'Move its products to another category first' : 'Delete'}
        disabled={count > 0 || remove.isPending}
        onClick={() => remove.mutate(undefined)}
      >
        <Trash2 />
      </Button>
    </li>
  );
}

export function CategoriesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data, isLoading } = useCategories();
  const [name, setName] = useState('');
  const create = useApiMutation((n: string) => api.post('/categories', { name: n }), {
    success: 'Category added',
    invalidate: ['categories'],
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) create.mutate(name.trim(), { onSuccess: () => setName('') });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Product categories</DialogTitle>
          <DialogDescription>Group products for filtering and reporting.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex gap-2">
          <Input
            placeholder="New category name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="New category name"
          />
          <Button type="submit" disabled={!name.trim() || create.isPending}>
            <Plus /> Add
          </Button>
        </form>
        <ul className="max-h-80 divide-y divide-divider overflow-y-auto">
          {isLoading && [1, 2, 3].map((i) => <Skeleton key={i} className="my-3 h-5" />)}
          {data?.map((c) => (
            <Row key={c.id} c={c} />
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
