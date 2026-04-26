# Extract MFC recordset column bindings from a WinPRISM binary by scanning
# bytes in original order around the [dbo].[<TableName>] anchor. Output is
# the contiguous column list MFC binds for that recordset — the same column
# list MFC composes its SELECT/INSERT/UPDATE from at runtime.
#
# Usage:
#   prism-extract-mfc-recordset.ps1 -Tables Acct_Agency,Acct_Agency_Customer
#   prism-extract-mfc-recordset.ps1 -Tables Acct_Agency -Bins 'C:\Program Files (x86)\WinPRISM\WPData.dll'
param(
    [string[]] $Tables = @('Acct_Agency'),
    [string[]] $Bins = @(),
    [int]      $Window = 6000,
    [int]      $MinLen = 4
)
$ErrorActionPreference = 'Stop'

if (-not $Bins) {
    $Bins = Get-ChildItem 'C:\Program Files (x86)\WinPRISM' -File -Filter '*.dll' |
        Where-Object { $_.Name -match '^(WA_AR|WPData|WACommon|ItemMnt|VendMnt|WPInv|WPPdt|WPComm|WPPosCmn|WPUtility|WPBuyBack|WPCredit|WPTender|WA_AP|WA_GL)\.dll$' } |
        Select-Object -ExpandProperty FullName
    $Bins += 'C:\Program Files (x86)\WinPRISM\WPAdmin.exe'
    $Bins += 'C:\Program Files (x86)\WinPRISM\WinPrism.exe'
}

function Get-NeighborhoodHits {
    param([string]$Path, [string]$Anchor, [int]$Window, [int]$MinLen)
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $sb = New-Object System.Text.StringBuilder ($bytes.Length)
    for ($i = 0; $i -lt $bytes.Length; $i++) {
        $b = $bytes[$i]
        if ($b -ge 0x20 -and $b -lt 0x7F) {
            [void]$sb.Append([char]$b)
        } else {
            [void]$sb.Append('`')
        }
    }
    $text = $sb.ToString()
    $hits = @()
    $idx = 0
    while (($idx = $text.IndexOf($Anchor, $idx)) -ge 0) {
        $start = [Math]::Max(0, $idx - $Window)
        $end = [Math]::Min($text.Length, $idx + $Window)
        $slice = $text.Substring($start, $end - $start)
        $runs = $slice -split '`+' | Where-Object { $_.Length -ge $MinLen }
        $hits += [pscustomobject]@{ Offset = $idx; Runs = $runs }
        $idx += $Anchor.Length
    }
    return $hits
}

foreach ($table in $Tables) {
    $anchor = "[dbo].[$table]"
    Write-Host ""
    Write-Host "############################################################"
    Write-Host "# Table: $table   anchor: $anchor"
    Write-Host "############################################################"
    foreach ($bin in $Bins) {
        if (-not (Test-Path $bin)) { continue }
        $hits = Get-NeighborhoodHits -Path $bin -Anchor $anchor -Window $Window -MinLen $MinLen
        if ($hits.Count -eq 0) { continue }
        Write-Host ""
        Write-Host ("==> {0}  ({1} anchor hit(s))" -f (Split-Path $bin -Leaf), $hits.Count)
        $hitNum = 0
        foreach ($h in $hits) {
            $hitNum++
            Write-Host ""
            Write-Host ("--- hit #{0} at offset 0x{1:X} ---" -f $hitNum, $h.Offset)
            $anchorIndex = -1
            for ($j = 0; $j -lt $h.Runs.Count; $j++) {
                if ($h.Runs[$j] -eq $anchor) { $anchorIndex = $j; break }
            }
            if ($anchorIndex -lt 0) { continue }
            $colCount = 0
            for ($j = $anchorIndex + 1; $j -lt $h.Runs.Count; $j++) {
                $r = $h.Runs[$j]
                # Stop at next [dbo].[<other>] or at MFC method export prefix
                if ($r -match '^\[dbo\]\.\[' -and $r -ne $anchor) { break }
                if ($r -match '^\?(GetDefaultSQL|GetDefaultConnect)') { break }
                # Print any bracketed identifier (column or m_param) or SQL fragment
                if ($r -match '^\[[A-Za-z_][A-Za-z0-9_ ]*\]$' -or $r -match '^\[m_param' -or $r -match '^\[paramAgencyID\]$') {
                    Write-Host ("  [{0,3}] {1}" -f $colCount, $r)
                    $colCount++
                } elseif ($r -match 'SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN' -and $r.Length -lt 250) {
                    # Show short SQL fragments inline so we don't lose the literal procs/SQL
                    Write-Host ("       SQL: {0}" -f $r)
                }
                if ($colCount -gt 100) { break }
            }
        }
    }
}
