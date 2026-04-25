-- Recovered from plan cache: SP_ARAutogenInvoices
-- 29 unique statements, ordered by statement_start_offset
-- Note: gaps possible if any statements were evicted from the cache.

SELECT 
			@begin_date = BeginDate,
			@end_date = EndDate,
			@begin_trans = isnull(BeginTransNum,''),
			@end_trans = isnull(EndTransNum,''),
			@AcctSelectType = AcctSelectType,
			@CustSelectType = CustSelectType,
			@fUseCurrentDate = isnull(fUseCurrentDate,0),
			@CreateDate = CreateDate
		FROM 
			Acct_ARAutogen_Inv
		WHERE 
			ARAutoID = @autogenID

;-- ---

SELECT @AcctCnt = Count(*) FROM Acct_Auto_Acct WHERE ModuleID = 1 and AutoID = @autogenID

;-- ---

SELECT @CustCnt = Count(*) From Acct_Auto_Cust WHERE ModuleID = 1 and AutoID = @autogenID

;-- ---

Select
		Transaction_Header.LocationID as LocationID,
		Acct_Agency.AgencyID as AgencyID,
		CustomerID As CustomerID,
		ProcessDate As Created, 
		Transaction_Header.TransactionID As TransactionID,
		RTrim(TranNumber) As TransNumber,
		fBilling As fBilling,
		TaxTotal As TaxTotal,
		isnull(td.DiscountTotal, 0) * -1 As DiscountTotal,
		TenderAmount As TenderAmount,
		TaxExemptTotal As TaxExemptTotal,
		Transaction_Header.fTaxExempt As fTaxExempt,
		fManualTax As fManualTax,
		TenderID As TenderID,
		TranTotal As TranTotal
	into
		#_ARAutoGenInvoices_Main
	from 
		Transaction_Header 
			left outer join Acct_Auto_Loc on Transaction_Header.LocationID = Acct_Auto_Loc.LocationID and ModuleID = 1 and AutoID = @autogenID 
			inner join Transaction_Tender on Transaction_Header.TransactionID = Transaction_Tender.TransactionID and Transaction_Tender.TenderAmount <> 0
			inner join Acct_Agency on Transaction_Tender.AgencyID = Acct_Agency.AgencyID
			left join ( select ad.ARInvoiceDtlID, ah.AgencyID, ad.TransactionID from Acct_ARInvoice_header ah inner join Acct_ARInvoice_Detail ad on ah.ARInvoiceID = ad.ARInvoiceID ) as ad on ad.AgencyID = Acct_Agency.AgencyID and ad.TransactionId = Transaction_Header.TransactionID
			left join (select TransactionID, sum(DiscountAmt) + sum(TranDiscAmt) as DiscountTotal from Transaction_Detail group by TransactionID) as td on td.TransactionID = Transaction_Header.TransactionID
	WHERE 
		(
			@AcctSelectType = 0 
				or 
			(@AcctSelectType = 1 and fBilling = 1)
				or
			(@AcctSelectType = 2 and fBilling = 0)
				or
			(@AcctSelectType = 3 and Transaction_Tender.AgencyID in ( select AgencyID from Acct_Auto_Acct WHERE ModuleID = 1 and AutoID = @autogenID))
				or
			(@AcctSelectType = 100 and Transaction_Tender.AgencyID = @SpecialAgencyID)
		) 
			and
		(
			@CustSelectType = 0 
				or 
			(@CustSelectType = 1 and CustomerID in (select CustomerID from Acct_Auto_Cust WHERE ModuleID = 1 and AutoID = @autogenID))
		) 
			and
		(
			Acct_Auto_Loc.LocationID > 0
				or
			@autogenID = 0
		) 
			and
		fInvoiced = 0 
			and 
		Transaction_Header.fStatus not in (0,3,4,7,8,9)
			AND 
		fInvoiceInAR = 1
			AND
		(isnull(Transaction_Header.MOReceiptId,0) = 0 or Transaction_Header.MOfStatus = 1)
			and
		(Len(Isnull(@begin_trans, '')) = 0 or RTrim(TranNumber) >= @begin_trans)
			and
		(Len(Isnull(@end_trans, '')) = 0 or RTrim(TranNumber) <= @end_trans)
			and
		(DATEPART(yyyy,@begin_date) = 1970 or ProcessDate >= @begin_date)	
			and
		(DATEPART(yyyy,@end_date) = 1970 or ProcessDate < @end_date)	
			and
		ad.ARInvoiceDtlID is null

;-- ---

INSERT INTO #_proposed_invoice_rpt (location_id, receipt_id, agency_id, customer_id, sku, description, qty, price, item_disc, amount, tax, trans_discount, l.loc_total_charge, loc_total_disc, loc_total_tax, acct_total_charge, acct_total_disc, acct_total_tax, cust_total_charge, cust_total_disc, cust_total_tax, rep_total_charge, .rep_total_disc, rep_total_tax )
		select
			m.LocationID, 
			m.TransactionID, 
			m.AgencyID, 
			m.CustomerID,
			d.SKU, 
			d.Description, 
			d.Qty, 
			d.Price, 
			d.DiscountAmt, 
			d.ExtPrice, 
			m.TaxTotal, 
			m.DiscountTotal,
			l.loc_total_charge,
			l.loc_total_disc,
			l.loc_total_tax,
			a.acct_total_charge,
			a.acct_total_disc,
			a.acct_total_tax,
			c.cust_total_charge,
			c.cust_total_disc,
			c.cust_total_tax,
			r.rep_total_charge,
			r.rep_total_disc,
			r.rep_total_tax
		from
			#_ARAutoGenInvoices_Main as m
				inner join Transaction_Detail as d on d.TransactionID = m.transactionId
				inner join Transaction_Detail_Tender tdt on tdt.TranDtlID = d.TranDtlID
				inner join Transaction_Tender tt on tt.TranTendorID = tdt.TranTenderID and tt.AgencyID = m.AgencyID
					and (
						@AcctSelectType = 0
							or
						(@AcctSelectType = 1 and fBilling = 1)
							or
						(@AcctSelectType = 2 and fBilling = 0)
							or
						(@AcctSelectType = 3 and tt.AgencyID in ( select AgencyID from Acct_Auto_Acct WHERE ModuleID = 1 and AutoID = @autogenID))
							or
						(@AcctSelectType = 100 and tt.AgencyID = @SpecialAgencyID)
					)
				left join (
					Select 
						LocationId, 
						SUM(TaxTotal) as loc_total_tax, 
						SUM(DiscountTotal) as loc_total_disc, 
						SUM(TenderAmount) as loc_total_charge 
					from 
						#_ARAutoGenInvoices_Main 
					Group By
						LocationId
				) as l on l.locationId = m.locationId
				left join (
					Select 
						LocationId, 
						AgencyId, 
						SUM(TaxTotal) as acct_total_tax, 
						SUM(DiscountTotal) as acct_total_disc, 
						SUM(TenderAmount) as acct_total_charge 
					from 
						#_ARAutoGenInvoices_Main 
					Group By
						LocationId, 
						AgencyId
				) as a on m.agencyId = a.agencyId and m.locationId = a.locationId
				left join (
					Select 
						LocationId, 
						AgencyId,
						CustomerId, 
						SUM(TaxTotal) as cust_total_tax, 
						SUM(DiscountTotal) as cust_total_disc, 
						SUM(TenderAmount) as cust_total_charge 
					from 
						#_ARAutoGenInvoices_Main 
					Group By
						LocationId, 
						AgencyId,
						CustomerId
				) as c on c.CustomerId = m.customerId and m.agencyId = c.agencyId and m.locationId = c.locationId,
				(
					select
						SUM(TaxTotal) as rep_total_tax, 
						SUM(DiscountTotal) as rep_total_disc, 
						SUM(TenderAmount) as rep_total_charge 
					from
						#_ARAutoGenInvoices_Main	
				) as r		
		Order by
			m.LocationId,
			m.AgencyId,
			m.CustomerId

;-- ---

Update #_proposed_invoice_rpt
		  set location_desc = VW_AR_TRANS_HEADER.Location,
		  customer_name = VW_AR_TRANS_HEADER.Customer,
		  transaction_number = VW_AR_TRANS_HEADER.TransNumber
		  from VW_AR_TRANS_HEADER
		  where VW_AR_TRANS_HEADER.RecordID = #_proposed_invoice_rpt.receipt_id

;-- ---

Update #_proposed_invoice_rpt
		  set acct_code = AgencyNumber,
		  acct_name = TenderAccount,
		  charged_amt = TenderAmount
		  from VW_AR_TRANS_TENDER
		  where VW_AR_TRANS_TENDER.TendRecID = #_proposed_invoice_rpt.receipt_id
		   and VW_AR_TRANS_TENDER.AccountID = #_proposed_invoice_rpt.agency_id

;-- ---

Update #_proposed_invoice_rpt
		  SET ReqNumber = ISNULL(RequestNumber,'')
		   FROM Transaction_Header
			WHERE #_proposed_invoice_rpt.receipt_id = Transaction_Header.TransactionID

;-- ---

SELECT * FROM #_proposed_invoice_rpt

;-- ---

DECLARE curARTrans CURSOR FAST_FORWARD FOR Select distinct * from #_ARAutoGenInvoices_Main ORDER BY LocationID, AgencyID, CustomerID

;-- ---

FETCH FROM curARTrans INTO @LocationID, @AgencyID, @CustomerID, @Created, @TransactionID, @TransNumber, @fBilling, @TaxTotal, @DiscountTotal, @TenderAmount, @TaxExemptTotal, @fTaxExempt, @fManualTax, @TenderID, @TranTotal

;-- ---

insert into Acct_ARInvoice_Header
				  (UserID, CustomerID, AgencyID, LocationID, TransactionID, InvoiceNumber, 
				  InvoiceCodeID, PostVoidID, CPODate, fStatus, PrintedDate, 
				  InvoiceDate, ARPeriod, fTaxExempt, fManualTax,fAutogen)
				values
				  (@UserID, @InvoiceCustomerID, @AgencyID, @LocationID, 0, @InvoiceNumber,
				  7, 0, @CreateDate, 1, @CreateDate, 
				  @CreateDate, @ARPeriod, @fTaxExempt, @fManualTax, 1)

;-- ---

select top 1 @ARInvoiceID = ARInvoiceID from Acct_ARInvoice_Header order by ARInvoiceID desc

;-- ---

update Acct_ARInvoice_Header
			  set CPOAmount = CPOAmount + @TenderAmount, Tax = Tax + @TaxTotal,
			   TaxExemptTotal = TaxExemptTotal + @TaxExemptTotal,
			   InvoiceAmt = InvoiceAmt + (@TranTotal)
			  where ARInvoiceID = @ARInvoiceID

;-- ---

if exists (select * from Acct_ARInvoice_Tender where ARInvoiceID = @ARInvoiceID and AgencyID = @AgencyID and TenderID = @TenderID)

;-- ---

update Acct_ARInvoice_Tender 
				set TenderAmount = TenderAmount + @TenderAmount
				where ARInvoiceID = @ARInvoiceID and AgencyID = @AgencyID and TenderID = @TenderID

;-- ---

insert into Acct_ARInvoice_Tender (ARInvoiceID, AgencyID, TenderID, TenderAmount, TenderAccount, TenderAuth, TenderResp, ExpDate, fAuthorized, AuthorizedDate)
				select @ARInvoiceID, AgencyID, TenderID, TenderAmount, TenderAccount, TenderAuth, TenderResp, ExpDate, fAuthorized, AuthorizedDate                                         
				from Transaction_Tender
				where TransactionID = @TransactionID and AgencyID = @AgencyID

;-- ---

DECLARE curARTransDetail CURSOR FAST_FORWARD FOR
				Select TranDtlID
				from Transaction_Detail
				WHERE TransactionID = @TransactionID

;-- ---

FETCH FROM curARTransDetail 
			  INTO @TranDtlID

;-- ---

insert into Acct_ARInvoice_Detail ( ARInvoiceID, SKU, Qty, Price, ExtPrice, OrginReceipt, FeeAmt, DiscountAmt, DiscountRate, TaxAmt, TransactionID, CustomerID, CPOAmount, TranDtlID )
				select @ARInvoiceID, SKU, Qty, Price, ExtPrice, @TransNumber, 0.0, isnull(DiscountAmt, 0) + isnull(TranDiscAmt, 0), DiscountRate, TaxAmt, @TransactionID, @InvoiceCustomerID, @DetailCPOAmount, TranDtlID
				from Transaction_Detail
				where TranDtlID = @TranDtlID

;-- ---

FETCH FROM curARTransDetail INTO @TranDtlID

;-- ---

if exists (select * from Acct_Apply where CustomerID = @CustomerID and AgencyID = @AgencyID and HeaderID = @ARInvoiceID and ApplyTypeID in (3,4))

;-- ---

select @ExistApplyTypeID = ApplyTypeID, @ExistInvoiceAmt = InvoiceAmt,
					@ExistPaymentAmt = PaymentAmt, @AcctApplyID = AcctApplyID
				  from Acct_Apply where CustomerID = @CustomerID and 
				  AgencyID = @AgencyID and HeaderID = @ARInvoiceID and ApplyTypeID in (3,4)

;-- ---

update Acct_Apply 
					  set InvoiceAmt = InvoiceAmt + @InvoiceAmt,
						PaymentAmt = PaymentAmt + @PaymentAmt, 
						AllocPayAmt = AllocPayAmt + @PaymentAmt
					  where @AcctApplyID = AcctApplyID

;-- ---

insert into Acct_Apply 
				(CustomerID, AgencyID, HeaderID, LocationID, ApplyTypeID, InvoiceAmt, 
				 PaymentAmt, AllocPayAmt, InvoiceDate, ARPeriod)
				values
				(@customerid, @agencyid, @arinvoiceid, @locationid, @ApplyTypeId,
					@InvoiceAmt, @PaymentAmt, @PaymentAmt, @CreateDate, @ARPeriod)

;-- ---

declare curInvCheck  cursor fast_forward for
			select tt.AgencyID 
			  from Transaction_Header th
			  inner join Transaction_Tender tt on th.TransactionID = tt.TransactionID
			  where th.TransactionID = @TransactionID and tt.AgencyID > 0

;-- ---

fetch next from curInvCheck  INTO @ChkAgencyID

;-- ---

if (not exists (select * from Acct_ARInvoice_header 
						where AgencyID = @ChkAgencyID 
							and TransactionID = @TransactionID))
					and 
					(not exists (select * from Acct_ARInvoice_header ah
							inner join Acct_ARInvoice_Detail ad on ah.ARInvoiceID = ad.ARInvoiceID
						where ah.AgencyID = @ChkAgencyID 
							and ad.TransactionID = @TransactionID))

;-- ---

update Transaction_Header set fInvoiced = 1 
				where TransactionID = @TransactionID
