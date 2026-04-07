import { describe, it, expect } from "vitest";
import {
  requisitionBookSchema,
  requisitionCreateSchema,
  requisitionUpdateSchema,
  publicRequisitionSubmitSchema,
  requisitionStatusUpdateSchema,
} from "@/lib/validators";

describe("requisitionBookSchema", () => {
  it("should accept a valid book", () => {
    const result = requisitionBookSchema.safeParse({
      bookNumber: 1,
      author: "Smith",
      title: "Intro to CS",
      isbn: "9781234567890",
    });
    expect(result.success).toBe(true);
  });

  it("should reject an ISBN that is not 10 or 13 digits", () => {
    const result = requisitionBookSchema.safeParse({
      bookNumber: 1,
      author: "Smith",
      title: "Intro to CS",
      isbn: "12345",
    });
    expect(result.success).toBe(false);
  });

  it("should accept ISBN-10 with X check digit", () => {
    const result = requisitionBookSchema.safeParse({
      bookNumber: 1,
      author: "Smith",
      title: "Intro to CS",
      isbn: "012345678X",
    });
    expect(result.success).toBe(true);
  });

  it("should require oerLink when bookType is OER", () => {
    const result = requisitionBookSchema.safeParse({
      bookNumber: 1,
      author: "Smith",
      title: "Open Resource",
      isbn: "9781234567890",
      bookType: "OER",
    });
    expect(result.success).toBe(false);
  });

  it("should accept OER book with oerLink", () => {
    const result = requisitionBookSchema.safeParse({
      bookNumber: 1,
      author: "Smith",
      title: "Open Resource",
      isbn: "9781234567890",
      bookType: "OER",
      oerLink: "https://example.com/oer",
    });
    expect(result.success).toBe(true);
  });
});

describe("requisitionCreateSchema", () => {
  const validInput = {
    instructorName: "Dr. Smith",
    phone: "(818) 555-1234",
    email: "smith@piercecollege.edu",
    department: "Computer Science",
    course: "CS 101",
    sections: "01, 02",
    enrollment: 35,
    term: "Fall",
    reqYear: 2026,
    books: [
      { bookNumber: 1, author: "Author", title: "Title", isbn: "9781234567890" },
    ],
  };

  it("should accept valid input", () => {
    const result = requisitionCreateSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("should require at least one book", () => {
    const result = requisitionCreateSchema.safeParse({ ...validInput, books: [] });
    expect(result.success).toBe(false);
  });

  it("should reject invalid term", () => {
    const result = requisitionCreateSchema.safeParse({ ...validInput, term: "Autumn" });
    expect(result.success).toBe(false);
  });

  it("should reject invalid email", () => {
    const result = requisitionCreateSchema.safeParse({ ...validInput, email: "not-email" });
    expect(result.success).toBe(false);
  });

  it("should reject enrollment of zero", () => {
    const result = requisitionCreateSchema.safeParse({ ...validInput, enrollment: 0 });
    expect(result.success).toBe(false);
  });

  it("should reject whitespace-only instructor name", () => {
    const result = requisitionCreateSchema.safeParse({ ...validInput, instructorName: "   " });
    expect(result.success).toBe(false);
  });

  it("should reject whitespace-only department", () => {
    const result = requisitionCreateSchema.safeParse({ ...validInput, department: "  \t  " });
    expect(result.success).toBe(false);
  });

  it("should trim and accept valid input with leading/trailing spaces", () => {
    const result = requisitionCreateSchema.safeParse({ ...validInput, instructorName: "  Dr. Smith  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.instructorName).toBe("Dr. Smith");
    }
  });
});

describe("requisitionUpdateSchema", () => {
  it("should allow clearing nullable note fields", () => {
    const result = requisitionUpdateSchema.safeParse({
      additionalInfo: null,
      staffNotes: null,
    });

    expect(result.success).toBe(true);
  });
});

describe("publicRequisitionSubmitSchema", () => {
  const validInput = {
    instructorName: "Dr. Smith",
    phone: "(818) 555-1234",
    email: "smith@piercecollege.edu",
    employeeId: "123456",
    department: "Computer Science",
    course: "CS 101",
    sections: "01, 02",
    enrollment: 35,
    term: "Fall",
    reqYear: 2026,
    books: [
      { bookNumber: 1, author: "Author", title: "Title", isbn: "9781234567890" },
    ],
  };

  it("should strip status from public submissions", () => {
    const result = publicRequisitionSubmitSchema.safeParse({
      ...validInput,
      status: "ORDERED",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).status).toBeUndefined();
    }
  });

  it("should strip staffNotes from public submissions", () => {
    const result = publicRequisitionSubmitSchema.safeParse({
      ...validInput,
      staffNotes: "secret",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).staffNotes).toBeUndefined();
    }
  });

  it("should strip source from public submissions", () => {
    const result = publicRequisitionSubmitSchema.safeParse({
      ...validInput,
      source: "STAFF_CREATED",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).source).toBeUndefined();
    }
  });
});

describe("requisitionStatusUpdateSchema", () => {
  it("should accept valid status", () => {
    const result = requisitionStatusUpdateSchema.safeParse({ status: "ORDERED" });
    expect(result.success).toBe(true);
  });

  it("should reject invalid status", () => {
    const result = requisitionStatusUpdateSchema.safeParse({ status: "CANCELLED" });
    expect(result.success).toBe(false);
  });
});
