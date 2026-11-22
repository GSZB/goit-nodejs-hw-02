import { Router } from "express";

import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncement,
  listAnnouncements,
  updateAnnouncement,
} from "../controllers/announcements.controller.ts";
import { authenticate } from "../middleware/authenticate.ts";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.ts";
import { registry } from "../openapi.ts";
import {
  announcementIdParamsSchema,
  announcementListSchema,
  announcementSchema,
  createAnnouncementSchema,
  listAnnouncementsQuerySchema,
  updateAnnouncementSchema,
} from "../validators/announcements.validator.ts";
import { errorSchema, validationErrorSchema } from "../validators/auth.validator.ts";

const router = Router();

router.get("/", validateQuery(listAnnouncementsQuerySchema), listAnnouncements);
router.get("/:id", validateParams(announcementIdParamsSchema), getAnnouncement);
router.post("/", authenticate, validateBody(createAnnouncementSchema), createAnnouncement);
router.patch(
  "/:id",
  authenticate,
  validateParams(announcementIdParamsSchema),
  validateBody(updateAnnouncementSchema),
  updateAnnouncement,
);
router.delete(
  "/:id",
  authenticate,
  validateParams(announcementIdParamsSchema),
  deleteAnnouncement,
);

export default router;

// ---------------------------- OpenAPI docs ----------------------------

const json = <T>(schema: T) => ({ content: { "application/json": { schema } } });

const validationError = { description: "Validation failed", ...json(validationErrorSchema) };
const unauthorized = {
  description: "Missing, invalid or expired access token",
  ...json(errorSchema),
};
const notFound = { description: "Announcement not found", ...json(errorSchema) };
const forbidden = {
  description: "Access denied — the announcement belongs to another user",
  ...json(errorSchema),
};

registry.registerPath({
  method: "get",
  path: "/announcements",
  tags: ["Announcements"],
  summary: "List announcements",
  description:
    "Public. Pagination (10 per page), case-insensitive search by title and sorting by creation date.",
  request: { query: listAnnouncementsQuerySchema },
  responses: {
    200: { description: "Paginated list", ...json(announcementListSchema) },
    400: validationError,
  },
});

registry.registerPath({
  method: "get",
  path: "/announcements/{id}",
  tags: ["Announcements"],
  summary: "Get announcement by ID",
  description: "Public. Returns the announcement with its author's data.",
  request: { params: announcementIdParamsSchema },
  responses: {
    200: { description: "Announcement", ...json(announcementSchema) },
    400: validationError,
    404: notFound,
  },
});

registry.registerPath({
  method: "post",
  path: "/announcements",
  tags: ["Announcements"],
  summary: "Create announcement",
  description: "The author (userId) is taken from the access token, not from the body.",
  security: [{ bearerAuth: [] }],
  request: { body: { required: true, ...json(createAnnouncementSchema) } },
  responses: {
    201: { description: "Announcement created", ...json(announcementSchema) },
    400: validationError,
    401: unauthorized,
  },
});

registry.registerPath({
  method: "patch",
  path: "/announcements/{id}",
  tags: ["Announcements"],
  summary: "Partially update own announcement",
  description:
    "All fields are optional, but at least one must be present. Only the author can update the announcement.",
  security: [{ bearerAuth: [] }],
  request: {
    params: announcementIdParamsSchema,
    body: { required: true, ...json(updateAnnouncementSchema) },
  },
  responses: {
    200: { description: "Announcement updated", ...json(announcementSchema) },
    400: validationError,
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
});

registry.registerPath({
  method: "delete",
  path: "/announcements/{id}",
  tags: ["Announcements"],
  summary: "Delete own announcement",
  description: "Only the author can delete the announcement.",
  security: [{ bearerAuth: [] }],
  request: { params: announcementIdParamsSchema },
  responses: {
    204: { description: "Announcement deleted (no content)" },
    400: validationError,
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
});
