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
   * Search contacts by name, email, or org.
   */
  async search(query: string): Promise<ContactResponse[]> {
    const contacts = await contactRepository.search(query);
    return contacts.map(toContactResponse);
  },

  /**
   * Find a contact by ID.
   */
  async findById(id: string): Promise<ContactResponse | null> {
    const contact = await contactRepository.findById(id);
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
    const existing = await contactRepository.findByName(name);
    if (existing.length > 0) {
      return toContactResponse(existing[0]);
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
