-- Recovered from plan cache: SP_RPT_AR_INVOICE_ADDTIONAL_INFOMATION
-- 1 unique statements, ordered by statement_start_offset
-- Note: gaps possible if any statements were evicted from the cache.

SELECT 
   Acct_ARInvoice_Header.InvoiceNumber AS InvoiceNumber,
   UserName,
   Acct_ARInvoice_Header.InvoiceDate,
   SUM(Qty) AS TotalItems,
   COUNT(Qty) AS TotalLines,
   CASE
      Acct_ARInvoice_Header.fTaxExempt
         WHEN 0 THEN 'NO'
         WHEN 1 THEN 'YES'
         ELSE 'NO'
    END AS TaxExempt,
   CASE
      Acct_ARInvoice_Header.fManualTax
         WHEN 0 THEN 'NO'
         WHEN 1 THEN 'YES'
         ELSE 'NO'
    END AS ManualTax,
    PostVoid.InvoiceNumber AS PostVoid,
    StatusDesc,
    ISNULL(AccountNumber,'Multiple') AS CustomerID,
    RTRIM(ISNULL(FirstName,'Multiple')) + ' ' + RTRIM(ISNULL(LastName,'Customers')) AS CustName,
    Acct_ARInvoice_Header.RequestNumber,
    AgencyNumber,
    Acct_ARInvoice_Header.InvoiceAmt,
    ISNULL(SUM(FeeAmt),0) AS TotShip,
    ISNULL(SUM(ItmDiscount),0) AS ItemDisc,
    CASE
       Acct_ARInvoice_Header.InvDiscountPercent
          WHEN 0 THEN CONVERT(money,0.0)
          ELSE CONVERT(MONEY,ISNULL(Acct_ARInvoice_Header.InvDiscountPercent,0) * ISNULL(Acct_ARInvoice_Header.InvoiceAmt,0))
    END AS InvoiceDiscount,
    Acct_ARInvoice_Header.Tax,
    Acct_ARInvoice_Header.TaxExemptTotal,
    Acct_ARInvoice_Header.CPOAmount,
    Acct_ARInvoice_Header.CheckAmount,
    ISNULL(SUM(Acct_ARInvoice_Detail.DiscountAmt),0.00) AS DiscountDetail,
    SUM(Acct_ARInvoice_Detail.ExtPrice) as ExtPrice   
      FROM Acct_ARInvoice_Header
         LEFT OUTER JOIN prism_security.dbo.PrismUser ON Acct_ARInvoice_Header.UserID = prism_security.dbo.PrismUser.SUID
         INNER JOIN Acct_ARInvoice_Detail ON Acct_ARInvoice_Header.ARInvoiceID = Acct_ARInvoice_Detail.ARInvoiceID
         LEFT OUTER JOIN Acct_ARInvoice_Header PostVoid ON Acct_ARInvoice_Header.ARInvoiceID = PostVoid.PostVoidID 
         INNER JOIN Status_Codes ON Acct_ARInvoice_Header.fStatus = Status_Codes.StatusID AND ModuleID = 13101
         LEFT OUTER JOIN Customer_Table ON Acct_ARInvoice_Header.CustomerID= Customer_Table.CustomerID
         INNER JOIN Acct_Agency ON Acct_ARInvoice_Header.AgencyID = Acct_Agency.AgencyID
             WHERE Acct_ARInvoice_Header.ARInvoiceID = @invoice_id
                 GROUP BY
                  Acct_ARInvoice_Header.InvoiceNumber,
                  UserName,
                  Acct_ARInvoice_Header.InvoiceDate,
                  Acct_ARInvoice_Header.fTaxExempt,
                  Acct_ARInvoice_Header.fManualTax,
                  PostVoid.InvoiceNumber,
                  StatusDesc,
                  AccountNumber,
                  FirstName,
                  LastName,
                  Acct_ARInvoice_Header.RequestNumber,
                  AgencyNumber,
                  Acct_ARInvoice_Header.InvoiceAmt,
                  Acct_ARInvoice_Header.InvDiscountPercent,                 
                  Acct_ARInvoice_Header.Tax,
                  Acct_ARInvoice_Header.TaxExemptTotal,
                  Acct_ARInvoice_Header.CPOAmount,
                  Acct_ARInvoice_Header.CheckAmount
