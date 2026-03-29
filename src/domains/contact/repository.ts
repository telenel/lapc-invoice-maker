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
 * Case-insensitive search by exact name.
 */
export async function findByName(name: string) {
  return prisma.contact.findMany({
    where: {
      name: { equals: name, mode: "insensitive" },
    },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Case-insensitive search by name, email, or org.
 */
export async function search(query: string) {
  return prisma.contact.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { org: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Find a contact by ID.
 */
export async function findById(id: string) {
  return prisma.contact.findUnique({ where: { id } });
}
