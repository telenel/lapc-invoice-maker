-- Recovered from plan cache: SP_RPT_AR_INVOICE
-- 33 unique statements, ordered by statement_start_offset
-- Note: gaps possible if any statements were evicted from the cache.

select @start_invoice = InvoiceNumber
from Acct_ARInvoice_Header
where ARInvoiceID = @invoice_id

;-- ---

select @end_invoice = InvoiceNumber
from Acct_ARInvoice_Header
where ARInvoiceID = @end_invoice_id

;-- ---

declare cur_get_invoices cursor fast_forward for
select distinct Acct_ARInvoice_Header.ARInvoiceID 
from Acct_ARInvoice_Header
inner join Acct_ARInvoice_Detail on Acct_ARInvoice_Header.ARInvoiceID = Acct_ARInvoice_Detail.ARInvoiceID
left join Transaction_Detail on Transaction_Detail.TranDtlID = Acct_ARInvoice_Detail.TranDtlID
left join Transaction_Header on Transaction_Header.TransactionID = Transaction_Detail.TransactionID
where
	Transaction_Header.fstatus <> 4
	and	(@invoice_id < 1 or InvoiceNumber between @start_invoice and @end_invoice)
	and (@agency_id < 1 or AgencyID = @agency_id )
	and (@use_date = 0 or InvoiceDate between @con_start_date and @con_end_date)

;-- ---

fetch cur_get_invoices 
into @InvoiceID

;-- ---

select @InvoiceCode = InvoiceCodeID 
	from Acct_ARInvoice_Header 
	where ARInvoiceID = @InvoiceID

;-- ---

declare cur_invoice cursor fast_forward for
	    select distinct
			ARInvoiceDtlID,
	        DetailDate,
	        CustomerID,
	        AgencyID,
	        LocationID,
	        InvoiceNumber,
	        CreateDate,
	        CPOAmount,
	        InvoiceAmt,
	        Tax,
	        DiscountPctAmt,
	        SKU,
	        Qty,
	        Price,
	        DiscountAmt,
	        ExtPrice,
	        TaxAmt,
	        InvoiceCodeID,
	        CheckAmount,
	        '',
	        null,
	        0,
	        0,
	        0,
	        0,
	        ShipCharge,
	        0,
	        TranDtlID,
	        ''
	        from ARInvoiceDetNMRPP2_vw
	        where ARInvoiceID = @InvoiceID
	            and InvoiceCodeID = @InvoiceCode
            order by TranDtlID desc

;-- ---

declare cur_invoice cursor fast_forward for
		select 
			ARINvoiceDtlID,
			isnull(Transaction_Header.ProcessDate, Transaction_Header.CreateDate),
			Acct_ARInvoice_Header.CustomerID,
			AgencyID,
			Acct_ARInvoice_Header.LocationID,
			InvoiceNumber,
			InvoiceDate,      
			Acct_ARInvoice_Header.CPOAmount,
			InvoiceAmt - isnull(Acct_ARInvoice_Header.ShipCharge, 0.0),
			Tax,
			InvDiscountPercent * InvoiceAmt,
			Acct_ARInvoice_Detail.SKU,
			Acct_ARInvoice_Detail.Qty,
			Acct_ARInvoice_Detail.Price,
			Acct_ARInvoice_Detail.DiscountAmt,
			Acct_ARInvoice_Detail.ExtPrice,
			Acct_ARInvoice_Detail.TaxAmt,
			InvoiceCodeID,
			CheckAmount,
			'',
			null,
			0,
			0,
			Acct_ARInvoice_Detail.CustomerID,
			Acct_ARInvoice_Detail.CPOAmount,
			isnull(Acct_ARInvoice_Header.ShipCharge, 0.0),
			Acct_ARInvoice_Detail.TransactionID,
			Acct_ARInvoice_Detail.TranDtlID,
			Acct_ARInvoice_Detail.OrginReceipt
		from 
			Acct_ARInvoice_Header
			inner join Acct_ARInvoice_Detail on Acct_ARInvoice_Header.ARInvoiceID = Acct_ARInvoice_Detail.ARInvoiceID
			left join Transaction_Detail on Transaction_Detail.TranDtlID = Acct_ARInvoice_Detail.TranDtlID
			left join Transaction_Header on Transaction_Header.TransactionID = Transaction_Detail.TransactionID
		where
--			((Acct_ARInvoice_Header.postvoidid is null or Acct_ARInvoice_Header.postvoidid  = 0)
--			and (Acct_ARInvoice_Header.invoiceamt > 0)) and 
			Acct_ARInvoice_Header.ARInvoiceID = @InvoiceID
			and InvoiceCodeID = @InvoiceCode

;-- ---

fetch cur_invoice
	into 
		@ARInvoiceDtlID,
		@detail_date,
		@CustomerID,
		@AgencyID,
		@LocationID,
		@InvoiceNumber,
		@CreateDate,
		@ChargedAmount,
		@InvoiceAmount,
		@Tax,
		@InvoiceDiscount,
		@SKU,
		@Qty,
		@Price,
		@Discount,
		@ExtPrice,
		@ItemTax,
		@InvoiceCodeID,
		@CheckAmount,
		@CheckNumber,
		@CheckDate,
		@DebitCOAID,
		@CreditCOAID,
		@Detail_CustomerID,
		@DetailCPOAmount,
		@ShipCharge,
		@TranID,
		@TranDtlID,
		@OrginReceipt

;-- ---

select @RefNumber = isnull(RequestNumber, '') 
			from Acct_ARInvoice_Header 
			where Acct_ARInvoice_Header.ARInvoiceID = @InvoiceID

;-- ---

select @RefNumber = isnull(RequestNumber, '') 
			from Transaction_Header 
			where TransactionID = @TranID

;-- ---

select @billing = fBilling 
		from Acct_Agency 
		where AgencyID = @AgencyID

;-- ---

select @bill_customer_id = isnull(BillingRefID, @CustomerID) 
			from Acct_Agency_Customer 
			where 
				AgencyID = @AgencyID 
				and CustomerID = @CustomerID

;-- ---

select @bill_customer_id = isnull(BillingRefID, @Detail_CustomerID) 
			from Acct_Agency_Customer 
			where 
				AgencyID = @AgencyID 
				and CustomerID = @Detail_CustomerID

;-- ---

select
			    @Description =
			    case 
					when isnull(ntd.RentalPrice, td.NBCPRentalPrice) is not null and @Price in (ntd.RentalPrice, td.NBCPRentalPrice) then left(isnull(td.Description, ''), 28) + ' (student)'
					when ntd.RentalPrice is not null then left(isnull(td.Description, ''), 28) + ' (NMRP)'
					when td.NBCPRentalPrice is not null then left(isnull(td.Description, ''), 28) + ' (NBCP)'
					else td.Description
				end
			from Transaction_Detail td
			    left outer join NMRPTransactionDetail ntd on ntd.TranDtlID = td.TranDtlID
			where td.TranDtlID = @TranDtlID

;-- ---

select
				@CustomerName = ltrim(rtrim(AccountNumber)) + '/' + rtrim(isnull(FirstName, '')) + ' ' + rtrim(isnull(LastName, '')),
				@CustomerNumber = AccountNumber
			from Customer_Table
			where CustomerID = @CustomerID

;-- ---

select 
				@CustomerName = rtrim(isnull(FirstName, '')) + ' ' + rtrim(isnull(LastName, '')),
				@CustomerNumber = AccountNumber
			from Customer_Table
			where CustomerID = @CustomerID

;-- ---

select 
			@AgencyName = Name,
			@AgencyNumber = AgencyNumber
		from Acct_Agency
		where AgencyID = @AgencyID

;-- ---

select top 1
				@CustomerAddress = Address,
				@CustomerCity = City,
				@CustomerState = State,
				@CustomerZipCode = Zipcode
			from Customer_Address
			where
				CustomerID = @CustomerID 
				and fBillAddr in (1, 2)
			order by fDefault desc

;-- ---

select 
				@CustomerAddress = Address,
				@CustomerCity = City,
				@CustomerState = State,
				@CustomerZipCode = Postalcode
			from Acct_Agency
			where AgencyID = @AgencyID

;-- ---

select @Location = Description
		from Location
		where LocationID = @LocationID

;-- ---

select
			@LocationAddress = MailAddress,
			@LocationCity = MailCity,
			@LocationState = MailState,
			@LocationZipCode = MailPostalCode,
			@LocationPhone = MailPhoneNumber
		from Store_Information_Table         
		where LocationID = @LocationID

;-- ---

select @AcctTermID = AcctTermID
		from Acct_Agency   
		where AgencyID  = @AgencyID

;-- ---

select @TermDesc = TermDesc 
		from Acct_Terms_Header
		where AcctTermID = @AcctTermID

;-- ---

select @page_break = fPageBreak
			from Acct_Agency
			where AgencyID = @AgencyID

;-- ---

select @TransactionID = TransactionID 
		from Acct_ARInvoice_Header
		where ARInvoiceID = @InvoiceID

;-- ---

select @TransactionType = TranTypeID
			from Transaction_Header
			where TransactionID = @TransactionID

;-- ---

select @TransactionType = TranTypeID
			from Transaction_Header
			where TransactionID = @TranID

;-- ---

select @fExempt = fTaxExempt, @ExemptNumber = FedTaxNumber from Acct_Agency where AgencyID = @agency_id

;-- ---

insert into #_invoice
		(
			ARInvoiceDtlID,
			DetailDate,
			LocationID,
			Location,
			LocationAddress,
			LocationCity,
			LocationState,
			LocationZipCode,
			LocationPhone,
			InvoiceNumber,
			CreateDate,
			ChargedAmount,
			InvoiceAmount,
			Tax,
			InvoiceDiscount,
			SKU,
			Description,
			Qty,
			Price,
			Discount,
			ExtPrice,
			ItemTax,
			CustomerName,
			CustomerNumber,
			CustomerAddress,
			CustomerCity,
			CustomerState,
			CustomerZipCode,
			TermDesc,
			Billing,
			AgencyName,
			AgencyNumber,
			fExempt,
			ExemptNumber,
			InvoiceCodeID,
			CheckAmount,
			ApplyInvoice,
			CheckNumber,
			CheckDate,
			Credit,
			Debit,
			CustomerIsDetail,
			PageBreak,
			DetailCPOAmount,
			ShipCharge,
			TransactionType,
			InvoiceID,
			RefNumber,
			OrginReceipt
		)
		values
		(
			@ARInvoiceDtlID,
			@detail_date,
			@LocationID,
			@Location,
			@LocationAddress,
			@LocationCity,
			@LocationState,
			@LocationZipCode,
			@LocationPhone,
			@InvoiceNumber,
			@CreateDate,
			@ChargedAmount,
			@NewInvoiceAmount,
			@Tax,
			@InvoiceDiscount,
			@SKU,
			@Description,
			@Qty,
			@Price,
			@Discount,
			@ExtPrice,
			@ItemTax,
			isnull(@CustomerName, ''),
			isnull(@CustomerNumber, ''),			
			@CustomerAddress,
			@CustomerCity,
			@CustomerState,
			@CustomerZipCode,
			@TermDesc,
			@billing,
			isnull(@AgencyName, 0),
			isnull(@AgencyNumber, 0),
			isnull(@fExempt, 0),
			isnull(@ExemptNumber, ''),
			@InvoiceCodeID,
			@CheckAmount,
			@ApplyInvoice,
			@CheckNumber,
			@CheckDate,
			@Credit,
			@Debit,
			@CustomerIsDetail,
			@page_break,
			@DetailCPOAmount,
			@ShipCharge,
			@TransactionType,
			@InvoiceID,
			@RefNumber,
			@OrginReceipt
		)

;-- ---

fetch cur_invoice
		into 
			@ARInvoiceDtlID,
			@detail_date,
			@CustomerID,
			@AgencyID,
			@LocationID,
			@InvoiceNumber,
			@CreateDate,
			@ChargedAmount,
			@InvoiceAmount,
			@Tax,
			@InvoiceDiscount,
			@SKU,
			@Qty,
			@Price,
			@Discount,
			@ExtPrice,
			@ItemTax,
			@InvoiceCodeID,
			@CheckAmount,
			@CheckNumber,
			@CheckDate,
			@DebitCOAID,
			@CreditCOAID,
			@Detail_CustomerID,
			@DetailCPOAmount,
			@ShipCharge,
			@TranID,
			@TranDtlID,
			@OrginReceipt

;-- ---

update #_invoice 
	set InvoiceAmount = @InvoiceAmount
	where InvoiceID = @InvoiceID

;-- ---

fetch cur_get_invoices 
	into @InvoiceID

;-- ---

select * from #_invoice order by ARInvoiceDtlID, Description desc
