// src/domains/contact/types.ts

export interface ContactResponse {
  id: string;
  name: string;
  email: string;
  phone: string;
  org: string;
  department: string;
  title: string;
  notes: string | null;
  createdAt: string;
}

export interface CreateContactInput {
  name: string;
  email?: string;
  phone?: string;
  org?: string;
  department?: string;
  title?: string;
  notes?: string;
}
