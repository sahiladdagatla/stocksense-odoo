import type { z } from 'zod';

/**
 * Parses untrusted input with a Zod schema. A ZodError propagates to the error middleware,
 * which turns it into a 400 VALIDATION_ERROR response.
 */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  return schema.parse(data);
}
