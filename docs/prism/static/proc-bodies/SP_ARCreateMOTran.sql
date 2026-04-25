-- Recovered from plan cache: SP_ARCreateMOTran
-- 15 unique statements, ordered by statement_start_offset
-- Note: gaps possible if any statements were evicted from the cache.

select @NMRPAgencyID = isnull(NMRPAgencyID, -1), @NMRPCustomerID = isnull(NMRPCustomerID, -1), 
		@NBCPAgencyID = isnull(NBCPAgencyID, -1), @NBCPCustomerID = isnull(NBCPCustomerID, -1) 
		from Rental_Setup_Pos

;-- ---

select @MembershipID = isnull(MembershipID,0) from Transaction_Header where TransactionID = @TransactionId

;-- ---

if exists(select * from 
			Transaction_Tender t 
			inner join Tender_Codes_Location c on t.TenderID = c.TenderCodeLocID		
			where TransactionID = @TransactionId and (c.TenderAuthID = 20 or c.TenderAuthID = 14))

;-- ---

update Transaction_Header set finvoiced = 1 where TransactionID = @TransactionId

;-- ---

declare curMOTranARGCTenders cursor static for
		select t.TranTendorID, TenderAccount
		from 
			Transaction_Tender t 
			inner join Tender_Codes_Location c on t.TenderID = c.TenderCodeLocID		
		where TransactionID = @TransactionId and c.TenderAuthID = 14

;-- ---

fetch curMOTranARGCTenders into @TranTenderID, @TenderAccount

;-- ---

Update Transaction_Header set TranTypeID = 2 where TransactionID = @TransactionId

;-- ---

select @customerID = customerID, @tran_total = TranTotal, @status = fStatus, @tran_code_id = TranCodeID
			 from Transaction_Header where TransactionID = @TransactionId

;-- ---

select @TranNumber = TranNumber from Transaction_Header where TransactionID = @TransactionId

;-- ---

select top 1 @ShipID = TransactionID from Transaction_Header 
				where TranNumber = @TranNumber and TranTotal > 0 and MOfstatus = 1
				order by TransactionID desc

;-- ---

Update Transaction_Header set PostVoidRcptID = @ShipID 
						where TransactionID = @TransactionId and PostVoidRcptID = 0

;-- ---

declare curTranDetail cursor for 
			select TranDtlID from Transaction_Detail where TransactionID = @TransactionId and SKU <> 5

;-- ---

fetch curTranDetail into @TranDtlID

;-- ---

declare curMOTranARInv cursor for
		select t.AgencyID, TenderAmount, AuthorizedDate, 
			TenderAccount, c.TenderAuthID
			from Transaction_Tender t 
			inner join Tender_Codes_Location c on t.TenderID = c.TenderCodeLocID		
				where TransactionID = @TransactionId and (c.TenderAuthID = 20 or c.TenderAuthID = 14)

;-- ---

fetch curMOTranARInv into @agency_id, @tend_amt, @tend_date, @TenderAccount, @AuthID
