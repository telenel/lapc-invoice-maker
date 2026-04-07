"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { CreateBookInput, BookBinding, BookType } from "@/domains/textbook-requisition/types";

// ── Constants ──

const MAX_BOOKS = 5;

const BINDING_OPTIONS: { value: BookBinding; label: string }[] = [
  { value: "HARDCOVER", label: "Hardcover" },
  { value: "PAPERBACK", label: "Paperback" },
  { value: "LOOSE_LEAF", label: "Loose-leaf" },
  { value: "DIGITAL", label: "Digital" },
];

const BOOK_TYPE_OPTIONS: { value: BookType; label: string }[] = [
  { value: "PHYSICAL", label: "Physical Book" },
  { value: "OER", label: "OER" },
];

// ── Types ──

export interface BookFormData {
  author: string;
  title: string;
  isbn: string;
  edition: string;
  copyrightYear: string;
  volume: string;
  publisher: string;
  binding: string;
  bookType: "PHYSICAL" | "OER";
  oerLink: string;
}

interface RequisitionBooksProps {
  books: BookFormData[];
  onChange: (books: BookFormData[]) => void;
}

// ── Helpers ──

export function createEmptyBook(): BookFormData {
  return {
    author: "",
    title: "",
    isbn: "",
    edition: "",
    copyrightYear: "",
    volume: "",
    publisher: "",
    binding: "",
    bookType: "PHYSICAL",
    oerLink: "",
  };
}

function normalizeIsbn(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, "");
}

function isValidIsbn(raw: string): boolean {
  const stripped = normalizeIsbn(raw);
  if (stripped.length === 0) return true; // empty is not invalid, just not filled
  return stripped.length === 10 || stripped.length === 13;
}

function stripEmptyOptionals(
  value: string | undefined,
): string | undefined {
  if (!value || value.trim() === "") return undefined;
  return value.trim();
}

export function toCreateBookInputs(books: BookFormData[]): CreateBookInput[] {
  return books
    .filter((b) => b.author.trim() !== "" || b.title.trim() !== "")
    .map((b, idx) => {
      const input: CreateBookInput = {
        bookNumber: idx + 1,
        author: b.author.trim(),
        title: b.title.trim(),
        isbn: normalizeIsbn(b.isbn),
      };

      const edition = stripEmptyOptionals(b.edition);
      if (edition) input.edition = edition;

      const copyrightYear = stripEmptyOptionals(b.copyrightYear);
      if (copyrightYear) input.copyrightYear = copyrightYear;

      const volume = stripEmptyOptionals(b.volume);
      if (volume) input.volume = volume;

      const publisher = stripEmptyOptionals(b.publisher);
      if (publisher) input.publisher = publisher;

      if (b.binding && b.binding !== "") {
        input.binding = b.binding as BookBinding;
      }

      input.bookType = b.bookType as BookType;

      if (b.bookType === "OER" && b.oerLink.trim() !== "") {
        input.oerLink = b.oerLink.trim();
      }

      return input;
    });
}

// ── Component ──

export function RequisitionBooks({ books, onChange }: RequisitionBooksProps) {
  const [visibleCount, setVisibleCount] = useState(
    Math.max(1, books.filter((b) => b.author || b.title).length),
  );

  function updateBook(index: number, field: keyof BookFormData, value: string) {
    const updated = books.map((book, i) =>
      i === index ? { ...book, [field]: value } : book,
    );
    onChange(updated);
  }

  function addBook() {
    if (visibleCount >= MAX_BOOKS) return;
    const newCount = visibleCount + 1;
    setVisibleCount(newCount);
    // Ensure the books array has enough entries
    if (books.length < newCount) {
      const extended = [...books];
      while (extended.length < newCount) {
        extended.push(createEmptyBook());
      }
      onChange(extended);
    }
  }

  function removeBook(index: number) {
    if (index === 0) return; // Book 1 is always visible
    const updated = [...books];
    updated.splice(index, 1);
    while (updated.length < MAX_BOOKS) {
      updated.push(createEmptyBook());
    }
    onChange(updated);
    setVisibleCount((prev) => prev - 1);
  }

  const visibleBooks = books.slice(0, visibleCount);

  return (
    <div className="space-y-6">
      {visibleBooks.map((book, index) => (
        <BookFieldset
          key={index}
          index={index}
          book={book}
          onUpdate={(field, value) => updateBook(index, field, value)}
          onRemove={index > 0 ? () => removeBook(index) : undefined}
        />
      ))}

      {visibleCount < MAX_BOOKS && (
        <Button type="button" variant="outline" size="sm" onClick={addBook}>
          <Plus className="size-3.5" data-icon="inline-start" />
          Add Another Title
        </Button>
      )}
    </div>
  );
}

// ── Book Fieldset ──

interface BookFieldsetProps {
  index: number;
  book: BookFormData;
  onUpdate: (field: keyof BookFormData, value: string) => void;
  onRemove?: () => void;
}

function BookFieldset({ index, book, onUpdate, onRemove }: BookFieldsetProps) {
  const isbnNormalized = normalizeIsbn(book.isbn);
  const isbnValid = isValidIsbn(book.isbn);
  const isbnTouched = book.isbn.length > 0;

  return (
    <fieldset className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <legend className="text-sm font-semibold">Book {index + 1}</legend>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onRemove}
            aria-label={`Remove Book ${index + 1}`}
          >
            <Trash2 className="size-3.5 text-muted-foreground" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Author */}
        <div className="space-y-1.5">
          <Label htmlFor={`book-${index}-author`}>
            Author {index === 0 && <span className="text-destructive">*</span>}
          </Label>
          <Input
            id={`book-${index}-author`}
            value={book.author}
            onChange={(e) => onUpdate("author", e.target.value)}
            placeholder="Last, First"
            required={index === 0}
          />
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor={`book-${index}-title`}>
            Title {index === 0 && <span className="text-destructive">*</span>}
          </Label>
          <Input
            id={`book-${index}-title`}
            value={book.title}
            onChange={(e) => onUpdate("title", e.target.value)}
            placeholder="Book title"
            required={index === 0}
          />
        </div>

        {/* ISBN */}
        <div className="space-y-1.5">
          <Label htmlFor={`book-${index}-isbn`}>ISBN</Label>
          <Input
            id={`book-${index}-isbn`}
            value={book.isbn}
            onChange={(e) => onUpdate("isbn", e.target.value)}
            placeholder="978-0-000000-00-0"
            aria-invalid={isbnTouched && !isbnValid ? true : undefined}
          />
          {isbnTouched && !isbnValid && (
            <p className="text-xs text-destructive">
              ISBN must be 10 or 13 digits (currently {isbnNormalized.length})
            </p>
          )}
        </div>

        {/* Edition */}
        <div className="space-y-1.5">
          <Label htmlFor={`book-${index}-edition`}>Edition</Label>
          <Input
            id={`book-${index}-edition`}
            value={book.edition}
            onChange={(e) => onUpdate("edition", e.target.value)}
            placeholder="e.g. 5th"
          />
        </div>

        {/* Copyright Year */}
        <div className="space-y-1.5">
          <Label htmlFor={`book-${index}-copyrightYear`}>Copyright Year</Label>
          <Input
            id={`book-${index}-copyrightYear`}
            value={book.copyrightYear}
            onChange={(e) => onUpdate("copyrightYear", e.target.value)}
            placeholder="e.g. 2024"
          />
        </div>

        {/* Volume */}
        <div className="space-y-1.5">
          <Label htmlFor={`book-${index}-volume`}>Volume</Label>
          <Input
            id={`book-${index}-volume`}
            value={book.volume}
            onChange={(e) => onUpdate("volume", e.target.value)}
            placeholder="e.g. 1"
          />
        </div>

        {/* Publisher */}
        <div className="space-y-1.5">
          <Label htmlFor={`book-${index}-publisher`}>Publisher</Label>
          <Input
            id={`book-${index}-publisher`}
            value={book.publisher}
            onChange={(e) => onUpdate("publisher", e.target.value)}
            placeholder="Publisher name"
          />
        </div>

        {/* Binding */}
        <div className="space-y-1.5">
          <Label htmlFor={`book-${index}-binding`}>Binding</Label>
          <select
            id={`book-${index}-binding`}
            value={book.binding}
            onChange={(e) => onUpdate("binding", e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Select binding...</option>
            {BINDING_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Book Type */}
        <div className="space-y-1.5">
          <Label htmlFor={`book-${index}-bookType`}>Type</Label>
          <select
            id={`book-${index}-bookType`}
            value={book.bookType}
            onChange={(e) => onUpdate("bookType", e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {BOOK_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* OER Link — conditional */}
        {book.bookType === "OER" && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={`book-${index}-oerLink`}>OER Link</Label>
            <Input
              id={`book-${index}-oerLink`}
              type="url"
              value={book.oerLink}
              onChange={(e) => onUpdate("oerLink", e.target.value)}
              placeholder="https://..."
            />
          </div>
        )}
      </div>
    </fieldset>
  );
}
