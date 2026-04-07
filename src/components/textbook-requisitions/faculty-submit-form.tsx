"use client";

import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RequisitionBooks,
  toCreateBookInputs,
  createEmptyBook,
} from "./requisition-books";
import type { BookFormData } from "./requisition-books";
import { requisitionApi } from "@/domains/textbook-requisition/api-client";
import type {
  CreateRequisitionInput,
  RequisitionSubmitAck,
} from "@/domains/textbook-requisition/types";
import { ApiError } from "@/domains/shared/types";

// ── Constants ──

const CURRENT_YEAR = new Date().getFullYear();

const TERM_OPTIONS = ["Winter", "Spring", "Summer", "Fall"] as const;

const MAX_BOOKS = 5;

// ── Types ──

interface FormErrors {
  instructorName?: string;
  phone?: string;
  email?: string;
  department?: string;
  course?: string;
  sections?: string;
  enrollment?: string;
  term?: string;
  reqYear?: string;
  books?: string;
}

// ── Validation ──

function validateForm(
  fields: {
    instructorName: string;
    phone: string;
    email: string;
    department: string;
    course: string;
    sections: string;
    enrollment: string;
    term: string;
    reqYear: string;
  },
  books: BookFormData[],
): FormErrors {
  const errors: FormErrors = {};

  if (!fields.instructorName.trim()) errors.instructorName = "Name is required";
  if (!fields.phone.trim()) errors.phone = "Phone is required";
  if (!fields.email.trim()) errors.email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()))
    errors.email = "Invalid email format";
  if (!fields.department.trim()) errors.department = "Department is required";
  if (!fields.course.trim()) errors.course = "Course is required";
  if (!fields.sections.trim()) errors.sections = "Section(s) required";
  if (!fields.enrollment.trim() || Number(fields.enrollment) < 1)
    errors.enrollment = "Enrollment must be at least 1";
  if (!fields.term) errors.term = "Term is required";
  if (!fields.reqYear.trim() || Number(fields.reqYear) < 2000)
    errors.reqYear = "Valid year required";

  const filledBooks = books.filter(
    (b) => b.author.trim() !== "" || b.title.trim() !== "",
  );
  if (filledBooks.length === 0) {
    errors.books = "At least one book is required";
  } else {
    const firstBook = filledBooks[0];
    if (!firstBook.author.trim() || !firstBook.title.trim()) {
      errors.books = "Book 1 must have an author and title";
    }
  }

  return errors;
}

function initBooks(): BookFormData[] {
  const initial: BookFormData[] = [createEmptyBook()];
  while (initial.length < MAX_BOOKS) {
    initial.push(createEmptyBook());
  }
  return initial;
}

// ── Component ──

export function FacultySubmitForm() {
  // ── Form state ──
  const [instructorName, setInstructorName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [course, setCourse] = useState("");
  const [sections, setSections] = useState("");
  const [enrollment, setEnrollment] = useState("");
  const [term, setTerm] = useState("");
  const [reqYear, setReqYear] = useState(String(CURRENT_YEAR));
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [books, setBooks] = useState<BookFormData[]>(initBooks);

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [ack, setAck] = useState<RequisitionSubmitAck | null>(null);

  const submitLockRef = useRef(false);

  const handleBooksChange = useCallback((updated: BookFormData[]) => {
    setBooks(updated);
  }, []);

  function resetForm() {
    setInstructorName("");
    setPhone("");
    setEmail("");
    setDepartment("");
    setCourse("");
    setSections("");
    setEnrollment("");
    setTerm("");
    setReqYear(String(CURRENT_YEAR));
    setAdditionalInfo("");
    setBooks(initBooks());
    setErrors({});
    setAck(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Double-submit protection
    if (submitLockRef.current) return;

    const fields = {
      instructorName,
      phone,
      email,
      department,
      course,
      sections,
      enrollment,
      term,
      reqYear,
    };

    const validationErrors = validateForm(fields, books);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    submitLockRef.current = true;
    setSubmitting(true);

    try {
      const payload: Omit<CreateRequisitionInput, "status" | "source" | "staffNotes"> = {
        instructorName: instructorName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        department: department.trim(),
        course: course.trim(),
        sections: sections.trim(),
        enrollment: Number(enrollment),
        term: term.trim(),
        reqYear: Number(reqYear),
        books: toCreateBookInputs(books),
      };

      if (additionalInfo.trim()) {
        payload.additionalInfo = additionalInfo.trim();
      }

      // Include honeypot field — bots fill it, real users don't see it
      const honeypotInput = document.getElementById("_hp_field") as HTMLInputElement | null;
      const fullPayload = { ...payload, _hp: honeypotInput?.value ?? "" };
      const result = await requisitionApi.submitPublic(fullPayload as typeof payload);
      setAck(result);
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Please try again.";
      toast.error(message);
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  }

  // ── Success state ──

  if (ack) {
    return (
      <div className="mt-8" aria-live="polite">
        <Card className="mx-auto max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="size-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle>Requisition Submitted</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Confirmation</dt>
              <dd className="font-mono text-xs">{ack.id.slice(0, 8)}</dd>

              <dt className="text-muted-foreground">Department</dt>
              <dd>{ack.department}</dd>

              <dt className="text-muted-foreground">Course</dt>
              <dd>{ack.course}</dd>

              <dt className="text-muted-foreground">Term</dt>
              <dd>
                {ack.term} {ack.reqYear}
              </dd>

              <dt className="text-muted-foreground">Books</dt>
              <dd>
                {ack.bookCount} title{ack.bookCount !== 1 ? "s" : ""}
              </dd>

              <dt className="text-muted-foreground">Submitted</dt>
              <dd>{new Date(ack.submittedAt).toLocaleString()}</dd>
            </dl>

            <div className="pt-4 text-center">
              <Button type="button" variant="outline" onClick={resetForm}>
                Submit Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Form ──

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-8">
      {/* Instructor Information */}
      <section>
        <h2 className="text-base font-semibold mb-4">Instructor Information</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Instructor Name"
            htmlFor="pub-instructorName"
            error={errors.instructorName}
            required
          >
            <Input
              id="pub-instructorName"
              value={instructorName}
              onChange={(e) => setInstructorName(e.target.value)}
              placeholder="Last, First"
              aria-invalid={errors.instructorName ? true : undefined}
              aria-describedby={errors.instructorName ? "pub-instructorName-err" : undefined}
            />
          </FormField>

          <FormField label="Phone" htmlFor="pub-phone" error={errors.phone} required>
            <Input
              id="pub-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(818) 555-0100"
              aria-invalid={errors.phone ? true : undefined}
              aria-describedby={errors.phone ? "pub-phone-err" : undefined}
            />
          </FormField>

          <FormField label="Email" htmlFor="pub-email" error={errors.email} required>
            <Input
              id="pub-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="instructor@piercecollege.edu"
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? "pub-email-err" : undefined}
            />
          </FormField>

          <FormField
            label="Department"
            htmlFor="pub-department"
            error={errors.department}
            required
          >
            <Input
              id="pub-department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Mathematics"
              aria-invalid={errors.department ? true : undefined}
              aria-describedby={errors.department ? "pub-department-err" : undefined}
            />
          </FormField>

          <FormField label="Course" htmlFor="pub-course" error={errors.course} required>
            <Input
              id="pub-course"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              placeholder="e.g. MATH 227"
              aria-invalid={errors.course ? true : undefined}
              aria-describedby={errors.course ? "pub-course-err" : undefined}
            />
          </FormField>

          <FormField
            label="Section(s)"
            htmlFor="pub-sections"
            error={errors.sections}
            required
          >
            <Input
              id="pub-sections"
              value={sections}
              onChange={(e) => setSections(e.target.value)}
              placeholder="e.g. 01, 02"
              aria-invalid={errors.sections ? true : undefined}
              aria-describedby={errors.sections ? "pub-sections-err" : undefined}
            />
          </FormField>

          <FormField
            label="Enrollment"
            htmlFor="pub-enrollment"
            error={errors.enrollment}
            required
          >
            <Input
              id="pub-enrollment"
              type="number"
              min={1}
              value={enrollment}
              onChange={(e) => setEnrollment(e.target.value)}
              placeholder="Expected enrollment"
              aria-invalid={errors.enrollment ? true : undefined}
              aria-describedby={errors.enrollment ? "pub-enrollment-err" : undefined}
            />
          </FormField>

          <FormField label="Term" htmlFor="pub-term" error={errors.term} required>
            <select
              id="pub-term"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-invalid={errors.term ? true : undefined}
              aria-describedby={errors.term ? "pub-term-err" : undefined}
            >
              <option value="">Select term...</option>
              {TERM_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Year" htmlFor="pub-reqYear" error={errors.reqYear} required>
            <Input
              id="pub-reqYear"
              type="number"
              min={2000}
              max={2100}
              value={reqYear}
              onChange={(e) => setReqYear(e.target.value)}
              aria-invalid={errors.reqYear ? true : undefined}
              aria-describedby={errors.reqYear ? "pub-reqYear-err" : undefined}
            />
          </FormField>
        </div>
      </section>

      {/* Books */}
      <section>
        <h2 className="text-base font-semibold mb-4">Books</h2>
        {errors.books && (
          <p className="text-sm text-destructive mb-3" role="alert">
            {errors.books}
          </p>
        )}
        <RequisitionBooks books={books} onChange={handleBooksChange} />
      </section>

      {/* Additional Notes */}
      <section>
        <h2 className="text-base font-semibold mb-4">Additional Notes</h2>
        <Label htmlFor="pub-additionalInfo" className="sr-only">
          Additional notes
        </Label>
        <Textarea
          id="pub-additionalInfo"
          value={additionalInfo}
          onChange={(e) => setAdditionalInfo(e.target.value)}
          placeholder="Any additional notes for this requisition (optional)..."
          rows={3}
        />
      </section>

      {/* Honeypot — hidden from real users, filled by bots */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-[-9999px]">
        <label htmlFor="_hp_field">Leave this empty</label>
        <input id="_hp_field" name="_hp" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {/* Submit */}
      <div className="border-t border-border pt-6 text-center">
        <Button type="submit" disabled={submitting} className="min-w-[200px]">
          {submitting ? "Submitting..." : "Submit Requisition"}
        </Button>
      </div>
    </form>
  );
}

// ── Form Field Wrapper ──

interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

function FormField({ label, htmlFor, error, required, children }: FormFieldProps) {
  const errorId = `${htmlFor}-err`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error && (
        <p id={errorId} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
