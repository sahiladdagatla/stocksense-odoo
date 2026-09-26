import { useEffect, useState } from 'react';

// Phase 0 shell: confirms client ↔ API wiring. Replaced by the router in Phase 7.
export default function App() {
  const [api, setApi] = useState<'checking' | 'ok' | 'down'>('checking');

  useEffect(() => {
    fetch('/api/health')
      .then((r) => setApi(r.ok ? 'ok' : 'down'))
      .catch(() => setApi('down'));
  }, []);

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">StockSense</h1>
        <p className="mt-1 text-sm text-muted-foreground">Inventory Management System</p>
        <p className="mt-4 text-sm">
          API status: <span className="font-medium">{api}</span>
        </p>
      </div>
    </main>
  );
}
