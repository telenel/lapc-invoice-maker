import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { CopyTechImportUploader } from "@/components/copytech/copytech-import-uploader";
import { copyTechImportService } from "@/domains/copytech-import/service";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CopyTechImportPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-5">
      <div className="page-enter page-enter-1">
        <h1 className="text-3xl font-bold tracking-tight">CopyTech Import</h1>
        <p className="mt-1 text-sm text-muted-foreground">Upload charge CSVs and create draft invoices.</p>
      </div>
      <div className="page-enter page-enter-2">
        <CopyTechImportUploader format={copyTechImportService.getCsvFormat()} />
      </div>
    </div>
  );
}

