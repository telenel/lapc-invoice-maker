// src/domains/contact/repository.ts
import { prisma } from "@/lib/prisma";
import type { CreateContactInput } from "./types";

/**
 * Create a new contact.
 */
export async function create(data: CreateContactInput, createdBy: string) {
  return prisma.contact.create({
    data: {
      name: data.name,
      email: data.email ?? "",
      phone: data.phone ?? "",
      org: data.org ?? "",
      department: data.department ?? "",
      title: data.title ?? "",
      notes: data.notes ?? null,
      createdBy,
    },
  });
}

/**
 * Case-insensitive search by exact name, scoped to owner.
 */
export async function findByName(name: string, createdBy: string) {
  return prisma.contact.findMany({
    where: {
      name: { equals: name, mode: "insensitive" },
      createdBy,
    },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Case-insensitive search by name, email, or org, scoped to owner.
 */
export async function search(query: string, createdBy: string) {
  const q = query.trim();
  if (!q) return [];
  return prisma.contact.findMany({
    where: {
      createdBy,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { org: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
}

/**
 * Find a contact by email (case-insensitive), scoped to owner.
 */
export async function findByEmail(email: string, createdBy: string) {
  return prisma.contact.findMany({
    where: {
      email: { equals: email, mode: "insensitive" },
      createdBy,
    },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Find a contact by ID, scoped to owner.
 */
export async function findById(id: string, createdBy: string) {
  return prisma.contact.findFirst({ where: { id, createdBy } });
}
