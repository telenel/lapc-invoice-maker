-- Recovered from plan cache: TUI_Acct_Agency
-- 4 unique statements, ordered by statement_start_offset
-- Note: gaps possible if any statements were evicted from the cache.

declare curAgency cursor for
	select AgencyID, AgencyNumber, TextbookValidation from inserted

;-- ---

fetch curAgency into @agency_id, @agency_num, @textbookValidation

;-- ---

if @textbookValidation > 0 and exists(select * from deleted where AgencyID = @agency_id and TextbookValidation = 0)

;-- ---

fetch curAgency into @agency_id, @agency_num, @TextbookValidation
