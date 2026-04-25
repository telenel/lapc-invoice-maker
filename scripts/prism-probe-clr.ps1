param(
    [string]$Root = 'C:\Program Files (x86)\WinPRISM'
)

$ErrorActionPreference = 'Stop'

$targets = Get-ChildItem -Path $Root -Include @('*.exe','*.dll') -File -Recurse |
    Sort-Object FullName

$results = foreach ($f in $targets) {
    $isClr = $false
    $assemblyName = $null
    $runtime = $null
    $err = $null
    try {
        $asm = [Reflection.AssemblyName]::GetAssemblyName($f.FullName)
        $isClr = $true
        $assemblyName = $asm.FullName
    } catch [System.BadImageFormatException] {
        $isClr = $false
        $err = 'native'
    } catch {
        $err = $_.Exception.Message
    }

    [pscustomobject]@{
        File         = $f.Name
        SizeKB       = [int]($f.Length / 1KB)
        IsDotNet     = $isClr
        AssemblyName = $assemblyName
        Note         = $err
    }
}

$results | Format-Table -AutoSize | Out-String -Width 240
"`n--- Summary ---"
"Total files:     {0}" -f $results.Count
".NET assemblies: {0}" -f ($results | Where-Object IsDotNet).Count
"Native modules:  {0}" -f ($results | Where-Object { -not $_.IsDotNet }).Count
