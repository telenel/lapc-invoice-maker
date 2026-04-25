-- Recovered from plan cache: TI_ARInvoice_Detail
-- 2 unique statements, ordered by statement_start_offset
-- Note: gaps possible if any statements were evicted from the cache.

declare curARd1 cursor for
	select
		 i.ARInvoiceDtlID, a.AgencyNumber
	from 
		inserted i 
		inner join Acct_ARInvoice_Header h on i.ARInvoiceID = h.ARInvoiceID
		inner join Acct_Agency a on h.AgencyID = a.AgencyID

;-- ---

fetch curARd1 into @arinvoice_dtl_id, @agency_number
