param(
    [string] $Root = 'C:\Program Files (x86)\WinPRISM',
    [string] $Pattern = '^(WPAdmin\.exe|WinPrism\.exe|ItemMnt\.dll|VendMnt\.dll|WPInv\.dll|WPData\.dll|WPPdt\.dll|WPComm\.dll|WPPosCmn\.dll|WPUtility\.dll|WPBuyBack\.dll|WPCredit\.dll|WPTender\.dll|WA_AP\.dll|WA_AR\.dll|WA_GL\.dll|WACommon\.dll)$',
    [int] $MinLen = 6,
    [string] $OutDir = ''
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($OutDir)) {
    $scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $repoRoot = Split-Path -Parent $scriptRoot
    $OutDir = Join-Path $repoRoot 'docs/prism/strings'
}

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

$Files = Get-ChildItem -Path $Root -File |
    Where-Object { $_.Name -match $Pattern } |
    Select-Object -ExpandProperty FullName

if (-not $Files) { throw "No files matched in $Root" }

function Get-AsciiRuns {
    param([string]$Path, [int]$MinLen)
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $sb    = New-Object System.Text.StringBuilder
    $runs  = New-Object System.Collections.Generic.List[string]
    foreach ($b in $bytes) {
        if ($b -ge 0x20 -and $b -lt 0x7F) {
            [void]$sb.Append([char]$b)
        } else {
            if ($sb.Length -ge $MinLen) { $runs.Add($sb.ToString()) }
            [void]$sb.Clear()
        }
    }
    if ($sb.Length -ge $MinLen) { $runs.Add($sb.ToString()) }
    ,$runs
}

function Get-Utf16Runs {
    param([string]$Path, [int]$MinLen)
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $sb    = New-Object System.Text.StringBuilder
    $runs  = New-Object System.Collections.Generic.List[string]
    for ($i = 0; $i -lt ($bytes.Length - 1); $i += 2) {
        $lo = $bytes[$i]; $hi = $bytes[$i+1]
        if ($hi -eq 0 -and $lo -ge 0x20 -and $lo -lt 0x7F) {
            [void]$sb.Append([char]$lo)
        } else {
            if ($sb.Length -ge $MinLen) { $runs.Add($sb.ToString()) }
            [void]$sb.Clear()
        }
    }
    if ($sb.Length -ge $MinLen) { $runs.Add($sb.ToString()) }
    ,$runs
}

foreach ($file in $Files) {
    if (-not (Test-Path $file)) { Write-Host "SKIP $file (not found)"; continue }

    $name = [IO.Path]::GetFileName($file)
    $ascii = Get-AsciiRuns -Path $file -MinLen $MinLen
    $utf16 = Get-Utf16Runs -Path $file -MinLen $MinLen
    $all   = @($ascii) + @($utf16) | Sort-Object -Unique

    $allOut = Join-Path $OutDir "$name.strings.txt"
    $all | Set-Content -Path $allOut -Encoding utf8

    # SQL-flavored filter
    $sqlPattern = '(?i)\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE|EXEC(UTE)?|FROM\s+\w|JOIN\s+\w|WHERE\s+\w|sp_\w|fn_\w|SP_\w|CMD_\w|tbl\w|UPDLOCK|ROWLOCK|HOLDLOCK)\b'
    $sql = $all | Where-Object { $_ -match $sqlPattern }
    $sqlOut = Join-Path $OutDir "$name.sql.txt"
    $sql | Set-Content -Path $sqlOut -Encoding utf8

    # Stored-proc name filter (standalone token OR after EXEC)
    $procPattern = '^(SP_|sp_|fn_|FN_|CMD_|E_|NB_|PB_)[A-Za-z0-9_]{2,}$'
    $procsStandalone = $all | Where-Object { $_ -match $procPattern }
    $procsExec = $all |
        Select-String -Pattern '(?i)\bEXEC(UTE)?\s+(?:dbo\.)?([A-Za-z_][A-Za-z0-9_]+)' -AllMatches |
        ForEach-Object { $_.Matches } |
        ForEach-Object { $_.Groups[2].Value }
    $procs = @($procsStandalone) + @($procsExec) | Sort-Object -Unique
    $procsOut = Join-Path $OutDir "$name.procs.txt"
    $procs | Set-Content -Path $procsOut -Encoding utf8

    "{0,-30} total={1,6}  sql-ish={2,5}  procs={3,4}" -f $name, $all.Count, $sql.Count, $procs.Count
}

"`nWrote outputs under $OutDir"
