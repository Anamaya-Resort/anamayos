import { z } from 'zod';

/** Shared validation for planner persistence routes. */

export const templateEventSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  title: z.string(),
  startMin: z.number().int().min(0).max(1440),
  durationMin: z.number().int().min(1).max(1440),
  description: z.string().optional(),
  plan: z.string().optional(),
  layer: z.enum(['program', 'booking']).optional(),
});

export const planEventSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  type: z.string().min(1),
  layer: z.enum(['program', 'booking']),
  description: z.string().optional(),
  plan: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startMin: z.number().int().min(0).max(1440),
  durationMin: z.number().int().min(1).max(1440),
});

export const templateEventsSchema = z.array(templateEventSchema).max(500);
export const planEventsSchema = z.array(planEventSchema).max(5000);

export const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  events: templateEventsSchema.default([]),
});

export const updateTemplateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(1000).nullish(),
  events: templateEventsSchema.optional(),
});

export const upsertPlanSchema = z.object({
  retreatId: z.string().uuid(),
  name: z.string().trim().max(200).nullish(),
  events: planEventsSchema,
  status: z.enum(['draft', 'approved']).optional(),
  sourceTemplateId: z.string().uuid().nullish(),
});
