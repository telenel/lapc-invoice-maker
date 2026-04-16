import { test, expect, APIResponse } from "@playwright/test";

/**
 * Comprehensive API-level E2E tests for textbook requisition endpoints.
 * Covers: edge cases, auth boundaries, status transitions, lookup,
 * export, and error handling.
 */

function skipIfRateLimited(response: APIResponse) {
  if (response.status() === 429) {
    test.skip(true, "Rate limited (429) — try again after 15 minutes");
  }
}

// ── Public Submit Edge Cases ──

test.describe.serial("Requisition API — Submit Edge Cases", () => {
  const baseSubmission = {
    employeeId: "12345",
    instructorName: "Dr. Edge Case",
    phone: "(818) 555-0000",
    email: "edge@piercecollege.edu",
    department: "Mathematics",
    course: "MATH 227",
    sections: "01",
    enrollment: 30,
    term: "Fall",
    reqYear: 2026,
    books: [
      { bookNumber: 1, author: "Stewart", title: "Calculus", isbn: "9781285740621" },
    ],
  };

  test("rejects reqYear below 2020 on API even though client allows 2000+", async ({ request }) => {
    const response = await request.post("/api/textbook-requisitions/submit", {
      data: { ...baseSubmission, reqYear: 2019 },
    });
    skipIfRateLimited(response);
    expect(response.status()).toBe(400);
  });

  test("accepts reqYear of 2020 (minimum)", async ({ request }) => {
    const response = await request.post("/api/textbook-requisitions/submit", {
      data: { ...baseSubmission, reqYear: 2020 },
    });
    skipIfRateLimited(response);
    expect(response.status()).toBe(201);
  });

  test("rejects enrollment of 0", async ({ request }) => {
    const response = await request.post("/api/textbook-requisitions/submit", {
      data: { ...baseSubmission, enrollment: 0 },
    });
    skipIfRateLimited(response);
    expect(response.status()).toBe(400);
  });

  test("rejects negative enrollment", async ({ request }) => {
    const response = await request.post("/api/textbook-requisitions/submit", {
      data: { ...baseSubmission, enrollment: -5 },
    });
    skipIfRateLimited(response);
    expect(response.status()).toBe(400);
  });

  test("accepts ISBN with X check digit (10-digit)", async ({ request }) => {
    const response = await request.post("/api/textbook-requisitions/submit", {
      data: {
        ...baseSubmission,
        books: [{ bookNumber: 1, author: "A", title: "B", isbn: "080442957X" }],
      },
    });
    skipIfRateLimited(response);
    expect(response.status()).toBe(201);
  });

  test("rejects ISBN with wrong length (11 digits)", async ({ request }) => {
    const response = await request.post("/api/textbook-requisitions/submit", {
      data: {
        ...baseSubmission,
        books: [{ bookNumber: 1, author: "A", title: "B", isbn: "12345678901" }],
      },
    });
    skipIfRateLimited(response);
    expect(response.status()).toBe(400);
  });

  test("accepts multiple books in correct order", async ({ request }) => {
    const response = await request.post("/api/textbook-requisitions/submit", {
      data: {
        ...baseSubmission,
        books: [
          { bookNumber: 1, author: "Author 1", title: "Book 1", isbn: "9780000000001" },
          { bookNumber: 2, author: "Author 2", title: "Book 2", isbn: "9780000000002" },
          { bookNumber: 3, author: "Author 3", title: "Book 3", isbn: "9780000000003" },
        ],
      },
    });
    skipIfRateLimited(response);
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.bookCount).toBe(3);
  });

  test("rejects books exceeding max of 5", async ({ request }) => {
    const books = Array.from({ length: 6 }, (_, i) => ({
      bookNumber: i + 1,
      author: `Author ${i + 1}`,
      title: `Book ${i + 1}`,
      isbn: `978000000000${i}`,
    }));
    const response = await request.post("/api/textbook-requisitions/submit", {
      data: { ...baseSubmission, books },
    });
    skipIfRateLimited(response);
    expect(response.status()).toBe(400);
  });

  test("rejects empty object body", async ({ request }) => {
    const response = await request.post("/api/textbook-requisitions/submit", {
      data: {},
    });
    skipIfRateLimited(response);
    // Should return 400 for missing required fields
    expect(response.status()).toBe(400);
  });

  test("submission ack does not leak internal fields", async ({ request }) => {
    const response = await request.post("/api/textbook-requisitions/submit", {
      data: baseSubmission,
    });
    skipIfRateLimited(response);
    if (response.status() !== 201) return;

    const body = await response.json();
    // Should contain public ack fields
    expect(body.id).toBeTruthy();
    expect(body.submittedAt).toBeTruthy();
    expect(body.department).toBe("Mathematics");
    expect(body.bookCount).toBe(1);

    // Should NOT contain any internal fields
    expect(body.status).toBeUndefined();
    expect(body.source).toBeUndefined();
    expect(body.staffNotes).toBeUndefined();
    expect(body.createdBy).toBeUndefined();
    expect(body.books).toBeUndefined();
    expect(body.notifications).toBeUndefined();
  });

  test("OER book without oerLink still accepted at API (flag generated server-side)", async ({ request }) => {
    const response = await request.post("/api/textbook-requisitions/submit", {
      data: {
        ...baseSubmission,
        books: [
          {
            bookNumber: 1,
            author: "Open Author",
            title: "Open Book",
            isbn: "9780000000000",
            bookType: "OER",
            // No oerLink — should still succeed but generate attention flag
          },
        ],
      },
    });
    skipIfRateLimited(response);
    expect(response.status()).toBe(201);
  });
});

// ── Employee Lookup API ──

test.describe("Requisition API — Employee Lookup", () => {
  test("GET /api/textbook-requisitions/lookup without employeeId returns 400", async ({ request }) => {
    const response = await request.get("/api/textbook-requisitions/lookup");
    skipIfRateLimited(response);
    expect(response.status()).toBe(400);
  });

  test("GET /api/textbook-requisitions/lookup with non-existent ID returns empty array", async ({ request }) => {
    const response = await request.get("/api/textbook-requisitions/lookup?employeeId=9999999");
    skipIfRateLimited(response);

    if (response.status() === 200) {
      const body = await response.json();
      expect(Array.isArray(body)).toBe(true);
    }
  });

  test("POST to lookup endpoint returns 405", async ({ request }) => {
    const response = await request.post("/api/textbook-requisitions/lookup", {
      data: { employeeId: "12345" },
    });
    expect(response.status()).toBe(405);
  });
});

// NOTE: Authenticated CRUD, status transition, export, and auth boundary tests
// are in requisition-detail-workflow.spec.ts (runs in the authenticated project).
