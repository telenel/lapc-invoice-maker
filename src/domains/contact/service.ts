// src/domains/contact/service.ts
import * as contactRepository from "./repository";
import type { ContactResponse, CreateContactInput } from "./types";

function toContactResponse(contact: {
  id: string;
  name: string;
  email: string;
  phone: string;
  org: string;
  department: string;
  title: string;
  notes: string | null;
  createdAt: Date;
}): ContactResponse {
  return {
    id: contact.id,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    org: contact.org,
    department: contact.department,
    title: contact.title,
    notes: contact.notes,
    createdAt: contact.createdAt.toISOString(),
  };
}

export const contactService = {
  /**
   * Create a new contact.
   */
  async create(input: CreateContactInput, userId: string): Promise<ContactResponse> {
    const contact = await contactRepository.create(input, userId);
    return toContactResponse(contact);
  },

  /**
   * Search contacts by name, email, or org, scoped to the requesting user.
   */
  async search(query: string, userId: string): Promise<ContactResponse[]> {
    const contacts = await contactRepository.search(query, userId);
    return contacts.map(toContactResponse);
  },

  /**
   * Find a contact by ID, scoped to the requesting user.
   */
  async findById(id: string, userId: string): Promise<ContactResponse | null> {
    const contact = await contactRepository.findById(id, userId);
    if (!contact) return null;
    return toContactResponse(contact);
  },

  /**
   * Find a contact by exact name, or create one if not found.
   * Returns the existing or newly created contact.
   */
  async findOrCreate(
    name: string,
    userId: string,
    extra?: { department?: string; email?: string; org?: string }
  ): Promise<ContactResponse> {
    // If email is provided, try matching by email first (stronger identifier)
    if (extra?.email) {
      const byEmail = await contactRepository.findByEmail(extra.email, userId);
      if (byEmail.length > 0) {
        return toContactResponse(byEmail[0]);
      }
    }

    // Fall back to name matching, but only reuse if metadata agrees.
    // If the caller provides org/department but the existing record is blank, treat as no match
    // to avoid incorrectly reusing "John Smith" (no org) for "John Smith from ACME".
    const existing = await contactRepository.findByName(name, userId);
    if (existing.length > 0) {
      const match = existing.find((c) => {
        if (extra?.org) {
          if (!c.org) return false;
          if (c.org.toLowerCase() !== extra.org.toLowerCase()) return false;
        }
        if (extra?.department) {
          if (!c.department) return false;
          if (c.department.toLowerCase() !== extra.department.toLowerCase()) return false;
        }
        return true;
      });
      if (match) return toContactResponse(match);
    }

    const contact = await contactRepository.create(
      {
        name,
        department: extra?.department,
        email: extra?.email,
        org: extra?.org,
      },
      userId
    );
    return toContactResponse(contact);
  },
};
