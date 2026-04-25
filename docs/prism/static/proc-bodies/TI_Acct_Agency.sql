-- Recovered from plan cache: TI_Acct_Agency
-- 1 unique statements, ordered by statement_start_offset
-- Note: gaps possible if any statements were evicted from the cache.

INSERT Acct_Agency_Tax_Codes (AgencyID, TaxCodeID)
			SELECT i.AgencyID, t.TaxCodeID
			FROM inserted i INNER JOIN Tax_Codes t on 1=1
