-- Recovered from plan cache: SP_ARAcctResendToPos
-- 11 unique statements, ordered by statement_start_offset
-- Recovered 2026-04-25 via scripts/prism-probe-proc-body.ts
-- Note: gaps possible if any statements were evicted from the cache.
--
-- Signature: SP_ARAcctResendToPos(@AgencyID int)
-- Side effect: writes to dbo.pos_update (the register sync queue).
--
-- pos_update.type encoding (from this body):
--   type = 3 → Customer (Customer_Table.CustomerID)
--   type = 4 → Agency-Customer linkage (Acct_Agency_Customer.AgencyCustID)
--   type = 6 → Agency (Acct_Agency.AgencyID)
--
-- For a freshly-cloned agency with no Acct_Agency_Customer rows yet, only
-- type-6 entries are emitted (one per location). Customer linkages and
-- customer profiles are queued only when those rows exist.

delete pos_update where code = @AgencyID and type = 6

;-- ---

delete pos_update where code in (Select AgencyCustID from Acct_Agency_Customer where AgencyID = @AgencyID) and type = 4

;-- ---

declare curResendToPOS cursor for
  select locationid from location

;-- ---

fetch curResendToPOS into @location_id

;-- ---

insert into pos_update (code, type, pos_flag, locationid, deletekey, fdelete)
			select AgencyID, 6, @POSUpdateFlag, @location_id, AgencyNumber, 0
			  from acct_agency where AgencyID = @AgencyID

;-- ---

insert into pos_update (code, type, pos_flag, locationid, deletekey, fdelete)
			select AgencyCustID, 4, @POSUpdateFlag, @location_id,  left(AccountNumber, 25) + left(AgencyNumber, 25), 0
				from Acct_Agency_Customer a
					inner join Customer_Table c on c.CustomerID = a.CustomerID
					inner join Acct_Agency ag on ag.AgencyID = a.AgencyID
				where ag.AgencyID = @AgencyID

;-- ---

declare curResendCustomer cursor for
		  select CustomerID from Acct_Agency_Customer where AgencyID = @AgencyID

;-- ---

fetch curResendCustomer into @customerID

;-- ---

if exists(select * from pos_update where code = @CustomerID and type = 3 and locationid = @location_id)

;-- ---

update Pos_update
				  set POS_Flag = @POSUpdateFlag,  fDelete = 0
				  where code = @CustomerID and type = 3 and locationid = @location_id

;-- ---

insert into pos_update (code, type, pos_flag, locationid, deletekey, fdelete)
				  select CustomerID, 3, @POSUpdateFlag, @location_id, AccountNumber, 0
				  from Customer_Table where CustomerID = @customerID
