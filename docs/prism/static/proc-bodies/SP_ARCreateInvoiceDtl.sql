-- Recovered from plan cache: SP_ARCreateInvoiceDtl
-- 6 unique statements, ordered by statement_start_offset
-- Note: gaps possible if any statements were evicted from the cache.

select @receipt_id = TransactionID from Transaction_Detail where TranDtlID = @receipt_dtl_id

;-- ---

if not exists(select * from transaction_Header th
			inner join TransactionTender360_vw tt on th.transactionID = tt.transactionID
			where th.TransactionID = @receipt_id and tt.AgencyID > 0)

;-- ---

select @location_id = LocationID from transaction_Header where TransactionID = @receipt_id

;-- ---

declare curCreateARInvDetailTend cursor fast_forward for
	select ARInvoiceID, InvoiceNumber, AgencyTypeID, CustomerID
		from Acct_ARInvoice_Header ah
		 inner join Acct_Agency aa on ah.AgencyID = aa.AgencyID
		 where TransactionID = @receipt_id

;-- ---

fetch next from curCreateARInvDetailTend INTO @arinvoice_id, @receipt_num, @AgencyTypeID, @GCCustomerId

;-- ---

insert into Acct_ARInvoice_Detail
		(
			ARInvoiceID,  
			SKU,         
			Qty,         
			Price,                 
			ExtPrice,                          
			OrginReceipt,              
			FeeAmt,                
			DiscountAmt,           
			DiscountRate, 
			TaxAmt,
			TranDtlID
		)
		select 
			@arinvoice_id,
			td.SKU,
			td.Qty,
			td.Price,
			td.ExtPrice,
			@receipt_num,
			0.0,
			td.DiscountAmt + td.TranDiscAmt,
			td.DiscountRate,
			td.TaxAmt,
			td.TranDtlID
		from 
			Transaction_Detail td
			left outer join TransactionTender360_vw tendVw on td.TranDtlID = tendVw.TranDtlId
		where
			td.TranDtlID = @receipt_dtl_id
		        and  not exists (select * from Acct_ARInvoice_Detail 
					where ARInvoiceID = @arinvoice_id and Acct_ARInvoice_Detail.TranDtlID = td.TranDtlID)
				and (@AgencyTypeID <> 5 or (tendVw.CustomerId = @GCCustomerId))
