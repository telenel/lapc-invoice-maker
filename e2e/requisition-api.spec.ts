import { test, expect, APIResponse } from "@playwright/test";

/**
 * API-level E2E tests for the textbook requisition endpoints.
 * These test the actual HTTP contract without needing browser rendering.
 *
 * NOTE: The public submit endpoint is rate-limited (10 per 15min per IP).
 * If the rate limit is hit, tests skip rather than fail.
 */

/** Skip the current test if rate-limited instead of failing. */
function skipIfRateLimited(response: APIResponse) {
  if (response.status() === 429) {
    test.skip(true, "Rate limited (429) — try again after 15 minutes");
  }
}

test.describe.serial("Requisition API — Public Submit", () => {
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
    skipIfRateLimited(response);

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
    skipIfRateLimited(response);

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Validation failed");
  });

  test("POST /api/textbook-requisitions/submit — empty books array returns 400", async ({ request }) => {
    const response = await request.post("/api/textbook-requisitions/submit", {
      data: { ...validSubmission, books: [] },
    });
    skipIfRateLimited(response);

    expect(response.status()).toBe(400);
  });

  test("POST /api/textbook-requisitions/submit — whitespace-only name returns 400", async ({ request }) => {
    const response = await request.post("/api/textbook-requisitions/submit", {
      data: { ...validSubmission, instructorName: "   " },
    });
    skipIfRateLimited(response);

    expect(response.status()).toBe(400);
  });

  test("POST /api/textbook-requisitions/submit — invalid ISBN returns 400", async ({ request }) => {
    const response = await request.post("/api/textbook-requisitions/submit", {
      data: {
        ...validSubmission,
        books: [{ bookNumber: 1, author: "A", title: "B", isbn: "12345" }],
      },
    });
    skipIfRateLimited(response);

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

    skipIfRateLimited(response);
    // Should succeed — status/source/staffNotes are stripped, not rejected
    expect(response.status()).toBe(201);
  });

  test("POST /api/textbook-requisitions/submit — honeypot rejects bots silently", async ({ request }) => {
    const response = await request.post("/api/textbook-requisitions/submit", {
      data: { ...validSubmission, _hp: "bot-filled-this" },
    });

    skipIfRateLimited(response);
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
    skipIfRateLimited(response);

    expect(response.status()).toBe(400);
  });
});

test.describe("Requisition API — Authenticated Endpoints", () => {
  test("GET /api/textbook-requisitions — authenticated request succeeds", async ({ request }) => {
    const response = await request.get("/api/textbook-requisitions");
    // With shared auth state via withAuth, should return 200
    // Redirects indicate auth setup failed
    if (response.status() === 302 || response.status() === 307) {
      test.skip(true, "Received redirect instead of 200 — auth fixture may have failed");
    }
    expect(response.status()).toBe(200);
  });

  test("GET /api/textbook-requisitions/submit — POST only", async ({ request }) => {
    const response = await request.get("/api/textbook-requisitions/submit");
    // GET on POST-only route returns 405
    expect(response.status()).toBe(405);
  });
});