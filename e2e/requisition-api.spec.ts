import { test, expect } from "@playwright/test";

/**
 * API-level E2E tests for the textbook requisition endpoints.
 * These test the actual HTTP contract without needing browser rendering.
 */

test.describe("Requisition API — Public Submit", () => {
  const validSubmission = {
    instructorName: "Dr. Test",
    phone: "(818) 555-0000",
    email: "test@piercecollege.edu",
    department: "Mathematics",
    course: "MATH 101",
    sections: "01",
    enrollment: 30,
    term: "Fall",
    reqYear: 2026,
    books: [
      { bookNumber: 1, author: "Test Author", title: "Test Book", isbn: "9780000000000" },
    ],
  };

  test("POST /api/textbook-requisitions/submit — valid submission returns 201 with ack", async ({ request }) => {
    const response = await request.post("/api/textbook-requisitions/submit", {
      data: validSubmission,
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.id).toBeTruthy();
    expect(body.submittedAt).toBeTruthy();
    expect(body.department).toBe("Mathematics");
    expect(body.course).toBe("MATH 101");
    expect(body.term).toBe("Fall");
    expect(body.reqYear).toBe(2026);
    expect(body.bookCount).toBe(1);
    // Should NOT contain internal fields
    expect(body.staffNotes).toBeUndefined();
    expect(body.status).toBeUndefined();
    expect(body.internalNotes).toBeUndefined();
  });

  test("POST /api/textbook-requisitions/submit — missing fields returns 400", async ({ request }) => {
    const response = await request.post("/api/textbook-requisitions/submit", {
      data: { instructorName: "Dr. Test" },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Validation failed");
  });

  test("POST /api/textbook-requisitions/submit — empty books array returns 400", async ({ request }) => {
    const response = await request.post("/api/textbook-requisitions/submit", {
      data: { ...validSubmission, books: [] },
    });

    expect(response.status()).toBe(400);
  });

  test("POST /api/textbook-requisitions/submit — whitespace-only name returns 400", async ({ request }) => {
    const response = await request.post("/api/textbook-requisitions/submit", {
      data: { ...validSubmission, instructorName: "   " },
    });

    expect(response.status()).toBe(400);
  });

  test("POST /api/textbook-requisitions/submit — invalid ISBN returns 400", async ({ request }) => {
    const response = await request.post("/api/textbook-requisitions/submit", {
      data: {
        ...validSubmission,
        books: [{ bookNumber: 1, author: "A", title: "B", isbn: "12345" }],
      },
    });

    expect(response.status()).toBe(400);
  });

  test("POST /api/textbook-requisitions/submit — strips status/source/staffNotes", async ({ request }) => {
    const response = await request.post("/api/textbook-requisitions/submit", {
      data: {
        ...validSubmission,
        status: "ORDERED",
        source: "STAFF_CREATED",
        staffNotes: "secret notes",
      },
    });

    // Should succeed — status/source/staffNotes are stripped, not rejected
    expect(response.status()).toBe(201);
  });

  test("POST /api/textbook-requisitions/submit — honeypot rejects bots silently", async ({ request }) => {
    const response = await request.post("/api/textbook-requisitions/submit", {
      data: { ...validSubmission, _hp: "bot-filled-this" },
    });

    // Returns 201 to not reveal the trap
    expect(response.status()).toBe(201);
    const body = await response.json();
    // But the ID is fake
    expect(body.id).toBe("ok");
  });

  test("POST /api/textbook-requisitions/submit — invalid term returns 400", async ({ request }) => {
    const response = await request.post("/api/textbook-requisitions/submit", {
      data: { ...validSubmission, term: "Autumn" },
    });

    expect(response.status()).toBe(400);
  });
});

test.describe("Requisition API — Authenticated Endpoints", () => {
  // These require auth — skip if no cookie
  test.skip(
    () => !process.env.E2E_AUTH_COOKIE,
    "Skipped: E2E_AUTH_COOKIE not set",
  );

  test("GET /api/textbook-requisitions — requires auth", async ({ request }) => {
    const response = await request.get("/api/textbook-requisitions");
    // Without auth, middleware redirects to login (302) or returns 401
    expect([302, 401, 307]).toContain(response.status());
  });

  test("GET /api/textbook-requisitions/submit — POST only", async ({ request }) => {
    const response = await request.get("/api/textbook-requisitions/submit");
    // GET on POST-only route returns 405
    expect(response.status()).toBe(405);
  });
});
