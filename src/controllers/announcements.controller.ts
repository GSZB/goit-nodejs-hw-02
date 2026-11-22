import type { Request, Response } from "express";
import createError from "http-errors";

import prisma from "../../prisma/client.ts";
import type { Prisma } from "../../generated/prisma/client.ts";
import {
  PER_PAGE,
  type CreateAnnouncementInput,
  type ListAnnouncementsQuery,
  type UpdateAnnouncementInput,
} from "../validators/announcements.validator.ts";

// Shape returned to the client: announcement + public author data (no password)
const announcementSelect = {
  id: true,
  title: true,
  description: true,
  price: true,
  category: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: { id: true, username: true, email: true, name: true },
  },
} satisfies Prisma.AnnouncementSelect;

function getId(req: Request): number {
  return Number(req.params.id);
}

/**
 * Finds the announcement and makes sure it belongs to the current user.
 * 404 if it does not exist, 403 if it belongs to someone else.
 */
async function assertOwnership(id: number, userId: number) {
  const announcement = await prisma.announcement.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!announcement) {
    throw createError(404, "Announcement not found");
  }
  if (announcement.userId !== userId) {
    throw createError(403, "Access denied");
  }
}

// GET /announcements
export async function listAnnouncements(req: Request, res: Response) {
  const { search, sort, page } = req.query as unknown as ListAnnouncementsQuery;

  const where: Prisma.AnnouncementWhereInput = search
    ? { title: { contains: search, mode: "insensitive" } }
    : {};

  const direction = sort === "oldest" ? "asc" : "desc";

  const [data, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      orderBy: [{ createdAt: direction }, { id: direction }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: announcementSelect,
    }),
    prisma.announcement.count({ where }),
  ]);

  res.status(200).json({
    data,
    pagination: {
      total,
      page,
      totalPages: Math.ceil(total / PER_PAGE),
      perPage: PER_PAGE,
    },
  });
}

// GET /announcements/:id
export async function getAnnouncement(req: Request, res: Response) {
  const announcement = await prisma.announcement.findUnique({
    where: { id: getId(req) },
    select: announcementSelect,
  });

  // findUnique returns null when nothing is found
  if (!announcement) {
    throw createError(404, "Announcement not found");
  }

  res.status(200).json(announcement);
}

// POST /announcements (protected)
export async function createAnnouncement(req: Request, res: Response) {
  const { title, description, price, category } = req.body as CreateAnnouncementInput;

  const announcement = await prisma.announcement.create({
    data: {
      title,
      description,
      price,
      category,
      userId: req.user!.sub, // author always comes from the token
    },
    select: announcementSelect,
  });

  res.status(201).json(announcement);
}

// PATCH /announcements/:id (protected + ownership)
export async function updateAnnouncement(req: Request, res: Response) {
  const id = getId(req);
  await assertOwnership(id, req.user!.sub);

  const { title, description, price, category } = req.body as UpdateAnnouncementInput;

  // updatedAt is refreshed automatically by @updatedAt
  const announcement = await prisma.announcement.update({
    where: { id },
    data: { title, description, price, category },
    select: announcementSelect,
  });

  res.status(200).json(announcement);
}

// DELETE /announcements/:id (protected + ownership)
export async function deleteAnnouncement(req: Request, res: Response) {
  const id = getId(req);
  await assertOwnership(id, req.user!.sub);

  await prisma.announcement.delete({ where: { id } });

  res.status(204).end();
}
