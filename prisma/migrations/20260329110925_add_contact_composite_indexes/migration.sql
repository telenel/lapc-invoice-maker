-- CreateIndex
CREATE INDEX "contacts_created_by_name_idx" ON "contacts"("created_by", "name");

-- CreateIndex
CREATE INDEX "contacts_created_by_email_idx" ON "contacts"("created_by", "email");
