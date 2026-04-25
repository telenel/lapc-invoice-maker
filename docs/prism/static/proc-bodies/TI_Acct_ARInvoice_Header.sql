-- Recovered from plan cache: TI_Acct_ARInvoice_Header
-- 2 unique statements, ordered by statement_start_offset
-- Note: gaps possible if any statements were evicted from the cache.

declare curARh cursor for
	select i.ARInvoiceID, a.AgencyNumber from inserted i inner join Acct_Agency a on i.AgencyID = a.AgencyID

;-- ---

fetch curARh into @arinvoice_id, @agency_number
