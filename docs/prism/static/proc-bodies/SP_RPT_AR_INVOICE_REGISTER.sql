-- Recovered from plan cache: SP_RPT_AR_INVOICE_REGISTER
-- 5 unique statements, ordered by statement_start_offset
-- Note: gaps possible if any statements were evicted from the cache.

SELECT TOP 1
  @from_customer = AccountNumber
     FROM Customer_Table
        ORDER BY AccountNumber ASC

;-- ---

SELECT TOP 1
  @to_customer = AccountNumber
     FROM Customer_Table
        ORDER BY AccountNumber DESC

;-- ---

SELECT TOP 1
  @from_account = AgencyNumber
     FROM Acct_Agency
        ORDER BY AgencyNumber ASC

;-- ---

SELECT TOP 1
  @to_account = AgencyNumber
     FROM Acct_Agency
        ORDER BY AgencyNumber DESC

;-- ---

SELECT
         Acct_ARInvoice_Header.InvoiceNumber,
         Acct_ARInvoice_Header.InvoiceDate,
         Acct_ARInvoice_Header.InvoiceAmt + Acct_ARInvoice_Header.Tax AS InvoiceAmt,
         AgencyNumber AS AccountCode,
         Name AS AccountName,
         AccountNumber AS CustomerCode, 
         ISNULL(RTRIM(LastName),'') + ', ' + ISNULL(RTRIM(FirstName),'') AS CustomerName,
         Acct_ARInvoice_Header.CPOAmount AS AmountCharged,
          Acct_ARInvoice_Header.LocationID,
          Location.Description AS LocationDesc
             FROM Acct_ARInvoice_Header
                INNER JOIN Acct_Agency ON Acct_ARInvoice_Header.AgencyID = Acct_Agency.AgencyID
                INNER JOIN Customer_Table ON Acct_ARInvoice_Header.CustomerID = Customer_Table.CustomerID 
                INNER JOIN Location ON Acct_ARInvoice_Header.LocationID = Location.LocationID
                LEFT OUTER JOIN Transaction_Header ON Transaction_Header.TransactionID = Acct_ARInvoice_Header.TransactionID
            --    LEFT OUTER JOIN Acct_ARInvoice_Header PostVoid ON Acct_ARInvoice_Header.ARinvoiceID = PostVoid.PostVoidID
                   WHERE                     
                      (AgencyNumber BETWEEN @from_account AND @to_account) AND
                      (AccountNumber BETWEEN @from_customer AND @to_customer) AND
                       fDebit = @type AND
                     Acct_ARInvoice_Header.CustomerID > 0 and 
                      (Acct_ARInvoice_Header.InvoiceDate BETWEEN @con_start_date AND @con_end_date) AND 
                     (TranCodeID is null or TranCodeID NOT IN (3,4))  AND
                     (Transaction_Header.fstatus <> 4 OR Transaction_Header.fstatus is null) -- 1/10/07 have to check post void status of transaction - if transaction is voided to not include it.
                   /*  (Acct_ARInvoice_Header.PostVoidID = 0 OR Acct_ARInvoice_Header.PostVoidID IS NULL) AND
                     PostVoid.ARInvoiceID IS  NULL*/

      UNION
      SELECT
        InvoiceNumber,
        Acct_ARInvoice_Header.InvoiceDate,
        SUM(ExtPrice) + SUM(TaxAmt) + SUM(FeeAmt) - SUM(CreditAmt) + SUM(DiscountAmt)  AS InvoiceAmt,
        AgencyNumber AS AccountCode,
        Name AS AccountName,
        AccountNumber AS CustomerCode, 
        ISNULL(RTRIM(LastName),'') + ', ' + ISNULL(RTRIM(FirstName),'') AS CustomerName,
        SUM(Acct_ARInvoice_Detail.CPOAmount) AS AmountCharged,
        Acct_ARInvoice_Header.LocationID,
        Location.Description AS LocationDesc
           FROM Acct_ARInvoice_Header
              INNER JOIN Acct_Agency ON Acct_ARInvoice_Header.AgencyID = Acct_Agency.AgencyID
              INNER JOIN Acct_ARInvoice_Detail ON Acct_ARInvoice_Header.ARInvoiceID = Acct_ARInvoice_Detail.ARInvoiceID
              INNER JOIN Customer_Table ON Acct_ARInvoice_Detail.CustomerID = Customer_Table.CustomerID 
              INNER JOIN Location ON Acct_ARInvoice_Header.LocationID = Location.LocationID 
                   WHERE                     
                      (AgencyNumber BETWEEN @from_account AND @to_account) AND
                      (AccountNumber BETWEEN @from_customer AND @to_customer) AND
                       fDebit = @type AND
                      (Acct_ARInvoice_Header.InvoiceDate BETWEEN @con_start_date AND @con_end_date) AND
                      Acct_ARInvoice_Detail.CustomerID > 0 AND
                     (Acct_ARInvoice_Header.CustomerID IS NULL OR Acct_ARInvoice_Header.CustomerID = 0)
                        GROUP BY
                           InvoiceNumber,
                           Acct_ARInvoice_Header.InvoiceDate,
                           AgencyNumber,
                           Name,
                           AccountNumber, 
                           ISNULL(RTRIM(LastName),'') + ', ' + ISNULL(RTRIM(FirstName),''),                         
                           Acct_ARInvoice_Header.LocationID,
                           Location.Description
