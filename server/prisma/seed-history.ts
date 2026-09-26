/**
 * ~40 historical operations over the last 14 days, created through the real services so the ledger,
 * quants and statuses are exactly what the app itself would produce.
 */
import { prisma } from '../src/lib/prisma.js';
import {
  cancelOperation,
  confirmOperation,
  createOperation,
} from '../src/services/operation.service.js';
import { adjustStock, validateOperation } from '../src/services/stock.service.js';

const DAY = 86_400_000;
const OUT_OF_STOCK = 'FU-DSK-002'; // Standing Desk
const LOW_STOCK = ['RM-CPR-003', 'PK-STR-005', 'FU-CHR-001', 'PK-TAP-003'];
const VENDORS = [
  'Tata Steel Ltd',
  'Hindalco Industries',
  'Godrej Interio',
  'Logitech India',
  'Classmate Stationers',
  'Uflex Packaging',
];
const CUSTOMERS = [
  'Lodha Developers',
  'Kalpataru Interiors',
  'Oberoi Realty',
  'WeWork India',
  'Infosys Pune Campus',
  'Bosch Nashik Plant',
];

/** Deterministic PRNG (mulberry32) so every seed run produces the same data. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function seedHistory() {
  const rand = rng(42);
  const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)]!;
  const now = Date.now();
  /** A timestamp `daysAgo` days back, during working hours. */
  const day = (daysAgo: number) => {
    const d = new Date(now - daysAgo * DAY);
    d.setHours(9 + Math.floor(rand() * 8), Math.floor(rand() * 60), 0, 0);
    return d.getTime() > now ? new Date(now - 60_000) : d;
  };

  const [manager, staff] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: 'manager@stocksense.dev' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'staff@stocksense.dev' } }),
  ]);
  const user = () => (rand() < 0.6 ? manager.id : staff.id);

  const products = await prisma.product.findMany({
    include: { category: true },
    orderBy: { id: 'asc' },
  });
  const bySku = new Map(products.map((p) => [p.sku, p]));
  const sku = (s: string) => bySku.get(s)!;
  const locs = new Map((await prisma.location.findMany()).map((l) => [l.fullName, l.id]));
  const loc = (name: string) => locs.get(name)!;
  const S1 = loc('WH1/Stock');
  const S2 = loc('WH2/Stock');
  const min = (p: (typeof products)[number]) => p.reorderMin.toNumber();

  const onHand = async (productId: number, locationId: number) =>
    (
      await prisma.stockQuant.findUnique({
        where: { productId_locationId: { productId, locationId } },
      })
    )?.quantity.toNumber() ?? 0;

  type Line = { productId: number; demandQty: number };
  const done = async (
    type: 'RECEIPT' | 'DELIVERY' | 'INTERNAL',
    at: Date,
    lines: Line[],
    o: { from?: number; to?: number; partner?: string },
  ) => {
    if (lines.length === 0) return;
    const by = user();
    const op = await createOperation(
      { type, sourceLocId: o.from, destLocId: o.to, partner: o.partner, scheduledDate: at, lines },
      by,
      { at: new Date(at.getTime() - 2 * 3600_000) },
    );
    await confirmOperation(op.id);
    await validateOperation(op.id, by, { at });
  };
  const pending = async (
    type: 'RECEIPT' | 'DELIVERY' | 'INTERNAL',
    createdDaysAgo: number,
    scheduleInHours: number,
    lines: Line[],
    o: { from?: number; to?: number; partner?: string; confirm?: boolean; cancel?: boolean },
  ) => {
    const op = await createOperation(
      {
        type,
        sourceLocId: o.from,
        destLocId: o.to,
        partner: o.partner,
        scheduledDate: new Date(now + scheduleInHours * 3600_000),
        lines,
      },
      user(),
      { at: day(createdDaysAgo) },
    );
    if (o.confirm !== false) await confirmOperation(op.id);
    if (o.cancel) await cancelOperation(op.id);
  };

  // 1) Opening receipts (day -14): 3x reorder minimum of everything into WH1/Stock, per category.
  const categories = [...new Set(products.map((p) => p.category.name))];
  for (const [i, cat] of categories.entries()) {
    const lines = products
      .filter((p) => p.category.name === cat)
      .map((p) => ({ productId: p.id, demandQty: Math.max(5, min(p) * 3) }));
    await done('RECEIPT', day(14), lines, { to: S1, partner: VENDORS[i] });
  }
  const wh2Opening = products
    .filter((p) => ['Electronics', 'Office Supplies'].includes(p.category.name))
    .slice(0, 6);
  await done(
    'RECEIPT',
    day(14),
    wh2Opening.map((p) => ({ productId: p.id, demandQty: Math.max(5, min(p)) })),
    { to: S2, partner: VENDORS[3] },
  );

  // 2) Transfers out of WH1/Stock to racks, the production floor and WH2 (days -12..-3).
  const regular = products.filter((p) => p.sku !== OUT_OF_STOCK && !LOW_STOCK.includes(p.sku));
  const transferTargets = [
    'WH1/Stock/Rack A',
    'WH1/Stock/Rack B',
    'WH1/Production Floor',
    'WH2/Stock',
    'WH1/Stock/Rack A',
  ];
  for (const [i, target] of transferTargets.entries()) {
    const chosen =
      i === 2 ? [sku('RM-STL-001'), sku('RM-ALU-002')] : [pick(regular), pick(regular)];
    const lines = [...new Map(chosen.map((p) => [p.id, p])).values()].map((p) => ({
      productId: p.id,
      demandQty: Math.max(1, Math.round(min(p) * 0.5)),
    }));
    await done('INTERNAL', day(12 - i * 2), lines, { from: S1, to: loc(target) });
  }

  // 3) Regular customer deliveries from WH1/Stock (days -13..-1).
  const deliverable = regular;
  for (let i = 0; i < 10; i++) {
    const at = day(13 - Math.floor((i * 13) / 10));
    const chosen = new Map<number, (typeof products)[number]>();
    for (let n = 1 + Math.floor(rand() * 3); n > 0; n--) {
      const p = pick(deliverable);
      chosen.set(p.id, p);
    }
    const lines: Line[] = [];
    for (const p of chosen.values()) {
      const q = Math.max(1, Math.round(min(p) * (0.15 + rand() * 0.2)));
      if ((await onHand(p.id, S1)) >= q) lines.push({ productId: p.id, demandQty: q });
    }
    await done('DELIVERY', at, lines, { from: S1, partner: pick(CUSTOMERS) });
  }

  // 4) One product sold out, a few pushed below their reorder minimum.
  const desk = sku(OUT_OF_STOCK);
  await done('DELIVERY', day(3), [{ productId: desk.id, demandQty: await onHand(desk.id, S1) }], {
    from: S1,
    partner: 'WeWork India',
  });
  const lowLines: Line[] = [];
  for (const s of LOW_STOCK) {
    const p = sku(s);
    const q = (await onHand(p.id, S1)) - Math.round(min(p) * 0.45);
    if (q > 0) lowLines.push({ productId: p.id, demandQty: q });
  }
  await done('DELIVERY', day(10), lowLines, { from: S1, partner: 'Infosys Pune Campus' });

  // Replenishment receipts during the last week, so the movement chart shows both directions.
  for (let i = 0; i < 5; i++) {
    const chosen = [...new Map([pick(regular), pick(regular)].map((p) => [p.id, p])).values()];
    await done(
      'RECEIPT',
      day(6 - i),
      chosen.map((p) => ({ productId: p.id, demandQty: Math.max(2, Math.round(min(p) * 0.6)) })),
      { to: S1, partner: pick(VENDORS) },
    );
  }

  // 5) Cycle counts (adjustments in both directions).
  await adjustStock(
    {
      productId: sku('RM-STL-001').id,
      locationId: loc('WH1/Production Floor'),
      countedQty: (await onHand(sku('RM-STL-001').id, loc('WH1/Production Floor'))) - 1.5,
      reason: 'Offcuts scrapped',
    },
    manager.id,
    { at: day(9) },
  );
  await adjustStock(
    {
      productId: sku('OS-PAP-001').id,
      locationId: S1,
      countedQty: (await onHand(sku('OS-PAP-001').id, S1)) + 3,
      reason: 'Found during cycle count',
    },
    staff.id,
    { at: day(6) },
  );
  await adjustStock(
    {
      productId: sku('EL-MOU-001').id,
      locationId: S1,
      countedQty: (await onHand(sku('EL-MOU-001').id, S1)) - 2,
      reason: 'Damaged in storage',
    },
    manager.id,
    { at: day(1) },
  );

  // 6) Open documents: ready, waiting, draft and canceled.
  await pending('RECEIPT', 1, 4, [{ productId: sku('RM-STL-001').id, demandQty: 500 }], {
    to: S1,
    partner: 'Tata Steel Ltd',
  });
  await pending('RECEIPT', 1, 26, [{ productId: sku('RM-CPR-003').id, demandQty: 1000 }], {
    to: S1,
    partner: 'Hindalco Industries',
  });
  await pending(
    'RECEIPT',
    0,
    50,
    [
      { productId: sku('EL-MON-003').id, demandQty: 25 },
      { productId: sku('EL-KBD-004').id, demandQty: 50 },
    ],
    { to: S2, partner: 'Logitech India' },
  );
  await pending('RECEIPT', 0, 72, [{ productId: sku('PK-STR-005').id, demandQty: 40 }], {
    to: S1,
    partner: 'Uflex Packaging',
    confirm: false,
  });
  await pending('RECEIPT', 0, 96, [{ productId: sku('FU-DSK-002').id, demandQty: 20 }], {
    to: S1,
    partner: 'Godrej Interio',
    confirm: false,
  });

  await pending('DELIVERY', 1, 5, [{ productId: sku('EL-MOU-001').id, demandQty: 10 }], {
    from: S1,
    partner: 'Lodha Developers',
  });
  await pending(
    'DELIVERY',
    1,
    28,
    [
      { productId: sku('OS-PAP-001').id, demandQty: 20 },
      { productId: sku('OS-PEN-002').id, demandQty: 3 },
    ],
    { from: S1, partner: 'Oberoi Realty' },
  );
  await pending('DELIVERY', 0, 30, [{ productId: sku('PK-BOX-001').id, demandQty: 50 }], {
    from: S1,
    partner: 'Bosch Nashik Plant',
  });
  await pending('DELIVERY', 0, 6, [{ productId: desk.id, demandQty: 4 }], {
    from: S1,
    partner: 'Kalpataru Interiors',
  });
  await pending('DELIVERY', 0, 20, [{ productId: sku('FU-CHR-001').id, demandQty: 30 }], {
    from: S1,
    partner: 'WeWork India',
  });
  await pending('DELIVERY', 0, 48, [{ productId: sku('FU-SHF-005').id, demandQty: 2 }], {
    from: S1,
    partner: 'Lodha Developers',
    confirm: false,
  });

  await pending('INTERNAL', 1, 3, [{ productId: sku('RM-STL-001').id, demandQty: 50 }], {
    from: S1,
    to: loc('WH1/Production Floor'),
  });
  await pending('INTERNAL', 0, 24, [{ productId: sku('PK-PAL-004').id, demandQty: 10 }], {
    from: S1,
    to: loc('WH1/Stock/Rack B'),
  });
  await pending('INTERNAL', 0, 30, [{ productId: sku('EL-LED-005').id, demandQty: 40 }], {
    from: S1,
    to: S2,
    confirm: false,
  });

  await pending('RECEIPT', 4, -48, [{ productId: sku('FU-TBL-004').id, demandQty: 3 }], {
    to: S1,
    partner: 'Godrej Interio',
    cancel: true,
  });
  await pending('DELIVERY', 3, -24, [{ productId: sku('EL-HUB-002').id, demandQty: 15 }], {
    from: S1,
    partner: 'Oberoi Realty',
    cancel: true,
  });
}
