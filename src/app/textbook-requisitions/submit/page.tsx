import { FacultySubmitForm } from "@/components/textbook-requisitions/faculty-submit-form";

export default function FacultySubmitPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="text-red-600">Pierce College</span> Textbook Requisition
        </h1>
        <p className="text-muted-foreground">
          Submit your textbook requirements for the upcoming term.
        </p>
      </div>
      <FacultySubmitForm />
    </main>
  );
}
