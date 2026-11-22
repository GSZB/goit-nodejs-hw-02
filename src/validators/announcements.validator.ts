import { z } from "zod";

// openapi.ts calls extendZodWithOpenApi(z), which enables `.openapi()` below
import "../openapi.ts";
import { publicUserSchema } from "./auth.validator.ts";

export const CATEGORIES = ["sale", "service", "job", "other"] as const;
export const PER_PAGE = 10;

const titleSchema = z
  .string()
  .trim()
  .min(5, "Title must be at least 5 characters")
  .max(50, "Title must be at most 50 characters")
  .openapi({ example: "Продам велосипед" });

const descriptionSchema = z
  .string()
  .trim()
  .min(10, "Description must be at least 10 characters")
  .openapi({ example: "Гірський велосипед, 21 швидкість" });

const priceSchema = z
  .number("Price must be a number")
  .positive("Price must be greater than 0")
  .openapi({ example: 8000 });

const categorySchema = z
  .enum(CATEGORIES, "Category must be one of: sale, service, job, other")
  .openapi({ example: "sale" });

export const createAnnouncementSchema = z
  .object({
    title: titleSchema,
    description: descriptionSchema,
    price: priceSchema,
    category: categorySchema,
  })
  .openapi("CreateAnnouncementRequest");

export const updateAnnouncementSchema = z
  .object({
    title: titleSchema.optional(),
    description: descriptionSchema.optional(),
    price: priceSchema.optional(),
    category: categorySchema.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "At least one field (title, description, price, category) must be provided",
  })
  .openapi("UpdateAnnouncementRequest", {
    example: { title: "Продам велосипед терміново", price: 6500 },
  });

export const announcementIdParamsSchema = z.object({
  id: z.coerce
    .number("ID must be a number")
    .int("ID must be an integer")
    .positive("ID must be greater than 0")
    .max(2147483647, "ID is too large")
    .openapi({ param: { name: "id", in: "path" }, example: 5 }),
});

export const listAnnouncementsQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .optional()
    .openapi({
      description: "Case-insensitive substring search by title",
      example: "ноутбук",
    }),
  sort: z
    .enum(["newest", "oldest"], "Sort must be one of: newest, oldest")
    .default("newest")
    .openapi({ description: "Sort order by creation date" }),
  page: z.coerce
    .number("Page must be a number")
    .int("Page must be an integer")
    .positive("Page must be greater than 0")
    .default(1)
    .openapi({ description: "Page number (10 items per page)", example: 1 }),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
export type ListAnnouncementsQuery = z.infer<typeof listAnnouncementsQuerySchema>;

// ---------- Response schemas (used for OpenAPI documentation) ----------

export const announcementSchema = z
  .object({
    id: z.number().int().openapi({ example: 5 }),
    title: z.string().openapi({ example: "Продам ноутбук ASUS" }),
    description: z.string().openapi({ example: "Відмінний стан, 16GB RAM" }),
    price: z.number().openapi({ example: 18000 }),
    category: z.enum(CATEGORIES).openapi({ example: "sale" }),
    createdAt: z
      .string()
      .openapi({ format: "date-time", example: "2025-01-10T12:00:00.000Z" }),
    updatedAt: z
      .string()
      .openapi({ format: "date-time", example: "2025-01-10T12:00:00.000Z" }),
    user: publicUserSchema,
  })
  .openapi("Announcement");

export const announcementListSchema = z
  .object({
    data: z.array(announcementSchema),
    pagination: z
      .object({
        total: z.number().int().openapi({ example: 23 }),
        page: z.number().int().openapi({ example: 2 }),
        totalPages: z.number().int().openapi({ example: 3 }),
        perPage: z.number().int().openapi({ example: PER_PAGE }),
      })
      .openapi("Pagination"),
  })
  .openapi("AnnouncementList");
