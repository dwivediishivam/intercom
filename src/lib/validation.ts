import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/),
});

export const invitationSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(["admin", "agent"]),
});

export const conversationFiltersSchema = z.object({
  channel: z.enum(["chat", "email"]).optional(),
  status: z.enum(["open", "snoozed", "resolved"]).optional(),
  assigneeId: uuidSchema.nullable().optional(),
  query: z.string().trim().max(200).optional(),
});

export const agentMessageSchema = z.object({
  bodyText: z.string().trim().min(1).max(20_000),
  bodyHtml: z.string().max(50_000).optional(),
  clientMessageId: uuidSchema.optional(),
});

export const widgetMessageSchema = z.object({
  workspacePublicId: uuidSchema,
  visitorToken: z.string().min(32).max(256),
  conversationId: uuidSchema.optional(),
  bodyText: z.string().trim().min(1).max(8_000),
  clientMessageId: uuidSchema,
});

export const widgetTypingSchema = z.object({
  workspacePublicId: uuidSchema,
  visitorToken: z.string().min(32).max(256),
  conversationId: uuidSchema.optional(),
  typing: z.boolean(),
});

export const widgetBootstrapSchema = z.object({
  workspacePublicId: uuidSchema,
  visitorToken: z.string().min(32).max(256).optional(),
  page: z
    .object({
      url: z.string().url().max(2_000),
      title: z.string().max(300).optional(),
      referrer: z.string().url().max(2_000).optional(),
    })
    .optional(),
});

export const conversationActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assign"), assigneeId: uuidSchema.nullable() }),
  z.object({ action: z.literal("snooze"), until: z.string().datetime() }),
  z.object({ action: z.literal("resolve") }),
  z.object({ action: z.literal("reopen") }),
]);

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(120);

export const knowledgeCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema,
  description: z.string().trim().max(500).optional(),
  position: z.number().int().min(0).max(10_000).optional(),
});

export const knowledgeSectionSchema = knowledgeCategorySchema.extend({
  categoryId: uuidSchema,
});

export const knowledgeArticleSchema = z.object({
  sectionId: uuidSchema,
  title: z.string().trim().min(1).max(180),
  slug: slugSchema,
  excerpt: z.string().trim().max(600).optional(),
  contentJson: z.record(z.string(), z.unknown()),
  contentHtml: z.string().max(200_000),
  status: z.enum(["draft", "published", "archived"]),
});

export const cannedResponseSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(10_000),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
});

export const customDomainSchema = z.object({ hostname: z.string().trim().min(4).max(253) });

export const apiTokenSchema = z.object({
  name: z.string().trim().min(1).max(120),
  scopes: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
  expiresAt: z.string().datetime().optional(),
});

export const webhookSubscriptionSchema = z.object({
  url: z.string().url().refine((value) => new URL(value).protocol === "https:"),
  eventTypes: z.array(z.string().trim().min(1).max(100)).min(1).max(20),
});
