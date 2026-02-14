
# Script to remove console.log statements, converting catch-block ones to console.error
$root = "C:\Users\Michael\river-city-roofing"
$dirs = @("app", "lib")
$totalRemoved = 0
$totalConverted = 0

foreach ($dir in $dirs) {
    $files = Get-ChildItem -Recurse -Include *.ts,*.tsx -Path (Join-Path $root $dir)
    foreach ($file in $files) {
        $lines = Get-Content $file.FullName -Raw
        if ($lines -notmatch 'console\.log') { continue }
        
        $content = Get-Content $file.FullName
        $newContent = @()
        $inCatchBlock = $false
        $braceDepth = 0
        $catchBraceStart = 0
        
        for ($i = 0; $i -lt $content.Count; $i++) {
            $line = $content[$i]
            
            # Track if we're inside a catch block
            if ($line -match '\bcatch\b') {
                $inCatchBlock = $true
                $catchBraceStart = $braceDepth
            }
            
            # Count braces
            $opens = ([regex]::Matches($line, '\{')).Count
            $closes = ([regex]::Matches($line, '\}')).Count
            $braceDepth += $opens - $closes
            
            if ($inCatchBlock -and $braceDepth -le $catchBraceStart -and $closes -gt 0) {
                $inCatchBlock = $false
            }
            
            if ($line -match '^\s*console\.log\(') {
                if ($inCatchBlock) {
                    # Convert to console.error in catch blocks
                    $newLine = $line -replace 'console\.log\(', 'console.error('
                    $newContent += $newLine
                    $totalConverted++
                } else {
                    # Remove the line entirely
                    $totalRemoved++
                    continue
                }
            } else {
                $newContent += $line
            }
        }
        
        Set-Content $file.FullName -Value ($newContent -join "`n") -NoNewline
    }
}

Write-Host "Removed: $totalRemoved console.log statements"
Write-Host "Converted to console.error: $totalConverted"
