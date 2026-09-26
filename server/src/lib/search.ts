/**
 * Prisma's `contains` becomes SQL LIKE '%…%' without escaping, so a user typing "%" or "_" would
 * match everything. Escape LIKE wildcards so search text is always taken literally.
 */
export const likeSafe = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
