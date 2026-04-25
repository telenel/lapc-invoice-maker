-- Recovered from plan cache: SP_ARCreateInvoiceHdr
-- 20 unique statements, ordered by statement_start_offset
-- Note: gaps possible if any statements were evicted from the cache.

if not exists (select * from TransactionTender360_vw where TransactionID = @receipt_id and AgencyID > 0)

;-- ---

select @customer_id = isnull(CustomerID,0), @cpo_req = RequestNumber, @tran_code_id = TranCodeID, @status = fStatus, 
	  @trn_post_void_id = PostVoidRcptID,  @tran_total = TranTotal, @tran_date = Processdate
		from Transaction_Header where TransactionID = @receipt_id

;-- ---

update transaction_header set fInvoiced = 1 where transactionid = @trn_post_void_id

;-- ---

declare curCreateInvDetail cursor fast_forward for
	  		Select TranDtlID from transaction_detail where transactionid = @receipt_id

;-- ---

fetch next from curCreateInvDetail into @TranDtlID

;-- ---

select @count = count(*) from TransactionTender360_vw where TransactionID = @receipt_id and AgencyID > 0

;-- ---

select @pv_tran_code_id = TranCodeID from Transaction_Header where TransactionID = @trn_post_void_id

;-- ---

declare cur_get_agencys cursor fast_forward for
	select tt360.AgencyID, tt360.AuthorizedDate, tt360.TenderAmount, isnull(tt360.CustomerId,0), aa.fInvoiceInAR, 
		isnull(aa.fTaxExempt,0), TranTendorID, tt360.Type360
		from TransactionTender360_vw tt360 
			inner join Acct_Agency aa on tt360.AgencyID = aa.AgencyID
		where TransactionID = @receipt_id and tt360.TenderAmount <> 0
			order by aa.priority asc, abs(TenderAmount) desc

;-- ---

fetch cur_get_agencys into @agency_id, @cpo_date, @cpo_amt, @GCCustomerID, @InvoiceInAR, @bTaxExempt, @TranTendorID, @Type360

;-- ---

if @InvCustomerID = 0 or not exists(select * from Acct_Agency_Customer where CustomerID = @InvCustomerID and AgencyID = @agency_id)

;-- ---

if exists (select * from Acct_ARInvoice_Header 
				where TransactionID = @receipt_id and CustomerID = @InvCustomerID and AgencyID = @agency_id and CPOAmount = @cpo_amt)

;-- ---

select @inv_post_void_id = ARInvoiceID from Acct_ARInvoice_Header 
				where TransactionId = @trn_post_void_id and AgencyId = @agency_id and CustomerId = @InvCustomerId

;-- ---

select @taxamt = sum(tdt.TaxAmt) from Transaction_Detail_Tender tdt where TranTenderID = @TranTendorID

;-- ---

select @taxamt = isnull(TaxTotal,0.00) from Transaction_Header where TransactionID = @receipt_id

;-- ---

select @TranNumber = 
				case when (@count = 1) then TranNumber 
				else LTRIM(RTRIM(TranNumber)) + '-' + CONVERT(char(2), @number) end-- Mark S - changed to char(2) so to allow
																					-- more than 9 tenders (Max is now 99)
				from Transaction_Header where TransactionID = @receipt_id

;-- ---

insert into Acct_ARInvoice_Header
			(
				UserID,      
				CustomerID,  
				AgencyID,    
				LocationID,
				TransactionID,
				InvoiceNumber,    
				InvoiceCodeID,         
				PostVoidID,
				Tax,                   
				TaxExemptTotal,        
				fTaxExempt, 
				fManualTax,
				CPODate,                                                
				CPOAmount,			
				RequestNumber,
				CreateDate,                                             
				fStatus,
				InvoiceAmt,
				PrintedDate,
				InvoiceDate,
				ARPeriod,
				ShipCharge
			)
			select
				UserID,      
				@InvCustomerID,  
				@agency_id,
				LocationID,
				@receipt_id,
				@TranNumber, 
				1, -- InvoiceCodeID = 'Receipt'
				@inv_post_void_id,
				@taxamt,     
				TaxExemptTotal,        
				fTaxExempt, 
				fManualTax, 
				@cpo_date,
				@cpo_amt,
				@cpo_req,
				[dbo].fnGetDateOffset(),                                             
				1, -- fStatus = 'POSTED'
--				case when (@tran_code_id = 3 or @tran_code_id = 4) then 0.0 - (@cpo_amt - @taxamt)  else @cpo_amt- @taxamt end,
				case 
					when (@tran_code_id = 3 or @tran_code_id = 4) then 0.0 - (TranTotal) 
					else TranTotal 
					end,
				ProcessDate,
				ProcessDate,
				@ar_period,
				ShipCharge
			from 
				Transaction_Header
			where
				TransactionID = @receipt_id

;-- ---

select @arinvoice_id = ARInvoiceID from Acct_ARInvoice_Header where InvoiceNumber = @TranNumber and 
				TransactionID = @receipt_id

;-- ---

insert into Acct_ARInvoice_Tender 
			(
				ARInvoiceID,
				AgencyID,    
				TenderID,    
				TenderAmount,          
				TenderAccount,              
				TenderAuth,                 
				TenderResp,                 
				ExpDate,  
				fAuthorized, 
				AuthorizedDate                                         
			)
			select 
				@arinvoice_id,
				AgencyID,    
				TenderID,    
				TenderAmount,          
				null,              
				null,                 
				null,                 
				null,  
				1, 
				AuthorizedDate                                         
			from
				TransactionTender360_vw
			where
				TransactionID = @receipt_id and AgencyID = @agency_id and isnull(CustomerId,0) = @GCCustomerID and TenderAmount <> 0

;-- ---

insert into Acct_ARInvoice_Tender (
					ARInvoiceID, AgencyID, TenderID, TenderAmount, TenderAccount, TenderAuth, 
					TenderResp,  ExpDate,  	fAuthorized, AuthorizedDate)
				select 	@arinvoice_id, AgencyID, TenderID, TenderAmount, NULL, NULL,                 
					NULL, NULL, fAuthorized, AuthorizedDate                                         
				from
					Transaction_Tender
				where
					TransactionID = @receipt_id and AgencyID <= 0

;-- ---

update Transaction_Header SET fInvoiced= 1 where TransactionID = @receipt_id
