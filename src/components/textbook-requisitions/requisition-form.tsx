"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  RequisitionBooks,
  toCreateBookInputs,
  createEmptyBook,
} from "./requisition-books";
import type { BookFormData } from "./requisition-books";
import type {
  RequisitionResponse,
  CreateRequisitionInput,
  UpdateRequisitionInput,
} from "@/domains/textbook-requisition/types";

// ── Constants ──

const CURRENT_YEAR = new Date().getFullYear();

const TERM_OPTIONS = ["Winter", "Spring", "Summer", "Fall"] as const;

const MAX_BOOKS = 5;

// ── Types ──

interface RequisitionFormProps {
  onCancel: () => void;
  submitLabel?: string;
}

interface RequisitionCreateFormProps extends RequisitionFormProps {
  initialData?: undefined;
  isEdit?: false;
  onSubmit: (data: CreateRequisitionInput) => Promise<void>;
}

interface RequisitionEditFormProps extends RequisitionFormProps {
  initialData: RequisitionResponse;
  isEdit: true;
  onSubmit: (data: UpdateRequisitionInput) => Promise<void>;
}

type RequisitionFormComponentProps =
  | RequisitionCreateFormProps
  | RequisitionEditFormProps;

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

// ── Helpers ──

function responseToBookFormData(res: RequisitionResponse): BookFormData[] {
  const mapped = res.books
    .sort((a, b) => a.bookNumber - b.bookNumber)
    .map((b): BookFormData => ({
      author: b.author,
      title: b.title,
      isbn: b.isbn,
      edition: b.edition ?? "",
      copyrightYear: b.copyrightYear ?? "",
      volume: b.volume ?? "",
      publisher: b.publisher ?? "",
      binding: b.binding ?? "",
      bookType: b.bookType === "OER" ? "OER" : "PHYSICAL",
      oerLink: b.oerLink ?? "",
    }));

  // Pad to MAX_BOOKS
  while (mapped.length < MAX_BOOKS) {
    mapped.push(createEmptyBook());
  }
  return mapped;
}

function initBooks(data?: RequisitionResponse): BookFormData[] {
  if (data && data.books.length > 0) {
    return responseToBookFormData(data);
  }
  const initial: BookFormData[] = [createEmptyBook()];
  while (initial.length < MAX_BOOKS) {
    initial.push(createEmptyBook());
  }
  return initial;
}

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

// ── Component ──

export function RequisitionForm(props: RequisitionFormComponentProps) {
  const {
    initialData,
    onCancel,
    submitLabel,
  } = props;
  const isEdit = props.isEdit === true;
  // ── Form state ──
  const [instructorName, setInstructorName] = useState(initialData?.instructorName ?? "");
  const [phone, setPhone] = useState(initialData?.phone ?? "");
  const [email, setEmail] = useState(initialData?.email ?? "");
  const [department, setDepartment] = useState(initialData?.department ?? "");
  const [course, setCourse] = useState(initialData?.course ?? "");
  const [sections, setSections] = useState(initialData?.sections ?? "");
  const [enrollment, setEnrollment] = useState(
    initialData ? String(initialData.enrollment) : "",
  );
  const [term, setTerm] = useState(initialData?.term ?? "");
  const [reqYear, setReqYear] = useState(
    initialData ? String(initialData.reqYear) : String(CURRENT_YEAR),
  );
  const [additionalInfo, setAdditionalInfo] = useState(initialData?.additionalInfo ?? "");
  const [staffNotes, setStaffNotes] = useState(initialData?.staffNotes ?? "");
  // Status is managed through the detail page workflow, not the edit form
  const [books, setBooks] = useState<BookFormData[]>(() => initBooks(initialData));

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const handleBooksChange = useCallback((updated: BookFormData[]) => {
    setBooks(updated);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

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

    setSubmitting(true);
    try {
      const basePayload = {
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

      if (isEdit) {
        const payload: UpdateRequisitionInput = {
          ...basePayload,
          additionalInfo: additionalInfo.trim() || null,
          staffNotes: staffNotes.trim() || null,
        };
        await props.onSubmit(payload);
      } else {
        const payload: CreateRequisitionInput = {
          ...basePayload,
        };
        if (additionalInfo.trim()) {
          payload.additionalInfo = additionalInfo.trim();
        }
        if (staffNotes.trim()) {
          payload.staffNotes = staffNotes.trim();
        }
        await props.onSubmit(payload);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const buttonLabel = submitLabel ?? (isEdit ? "Save Changes" : "Create Requisition");

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Instructor Information */}
      <section>
        <h2 className="text-base font-semibold mb-4">Instructor Information</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Instructor Name"
            htmlFor="instructorName"
            error={errors.instructorName}
            required
          >
            <Input
              id="instructorName"
              value={instructorName}
              onChange={(e) => setInstructorName(e.target.value)}
              placeholder="Last, First"
              aria-invalid={errors.instructorName ? true : undefined}
            />
          </FormField>

          <FormField label="Phone" htmlFor="phone" error={errors.phone} required>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(818) 555-0100"
              aria-invalid={errors.phone ? true : undefined}
            />
          </FormField>

          <FormField label="Email" htmlFor="email" error={errors.email} required>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="instructor@piercecollege.edu"
              aria-invalid={errors.email ? true : undefined}
            />
          </FormField>

          <FormField
            label="Department"
            htmlFor="department"
            error={errors.department}
            required
          >
            <Input
              id="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Mathematics"
              aria-invalid={errors.department ? true : undefined}
            />
          </FormField>

          <FormField label="Course" htmlFor="course" error={errors.course} required>
            <Input
              id="course"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              placeholder="e.g. MATH 227"
              aria-invalid={errors.course ? true : undefined}
            />
          </FormField>

          <FormField
            label="Section(s)"
            htmlFor="sections"
            error={errors.sections}
            required
          >
            <Input
              id="sections"
              value={sections}
              onChange={(e) => setSections(e.target.value)}
              placeholder="e.g. 01, 02"
              aria-invalid={errors.sections ? true : undefined}
            />
          </FormField>

          <FormField
            label="Enrollment"
            htmlFor="enrollment"
            error={errors.enrollment}
            required
          >
            <Input
              id="enrollment"
              type="number"
              min={1}
              value={enrollment}
              onChange={(e) => setEnrollment(e.target.value)}
              placeholder="Expected enrollment"
              aria-invalid={errors.enrollment ? true : undefined}
            />
          </FormField>

          <FormField label="Term" htmlFor="term" error={errors.term} required>
            <select
              id="term"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-invalid={errors.term ? true : undefined}
            >
              <option value="">Select term...</option>
              {TERM_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Year" htmlFor="reqYear" error={errors.reqYear} required>
            <Input
              id="reqYear"
              type="number"
              min={2000}
              max={2100}
              value={reqYear}
              onChange={(e) => setReqYear(e.target.value)}
              aria-invalid={errors.reqYear ? true : undefined}
            />
          </FormField>
        </div>
      </section>

      {/* Books */}
      <section>
        <h2 className="text-base font-semibold mb-4">Books</h2>
        {errors.books && (
          <p className="text-sm text-destructive mb-3">{errors.books}</p>
        )}
        <RequisitionBooks books={books} onChange={handleBooksChange} />
      </section>

      {/* Additional Info */}
      <section>
        <h2 className="text-base font-semibold mb-4">Additional Information</h2>
        <Textarea
          id="additionalInfo"
          value={additionalInfo}
          onChange={(e) => setAdditionalInfo(e.target.value)}
          placeholder="Any additional notes for this requisition..."
          rows={3}
        />
      </section>

      {/* Staff Notes */}
      <section>
        <h2 className="text-base font-semibold mb-4">Staff Notes</h2>
        <Textarea
          id="staffNotes"
          value={staffNotes}
          onChange={(e) => setStaffNotes(e.target.value)}
          placeholder="Internal notes (not visible to instructor)..."
          rows={3}
        />
      </section>

      {/* Status note — edit mode only. Status transitions happen via the detail page actions. */}
      {isEdit && (
        <p className="text-sm text-muted-foreground">
          Status changes are managed from the requisition detail page using the notification workflow.
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 border-t border-border pt-6">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : buttonLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
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
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
