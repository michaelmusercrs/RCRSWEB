# Check if the JS bundles load without errors
# Fetch the page and extract script src URLs
$r = Invoke-WebRequest -Uri "http://localhost:3000/command-center/meetings/present" -UseBasicParsing -TimeoutSec 120
$scripts = [regex]::Matches($r.Content, 'src="(/_next/[^"]+)"') | ForEach-Object { $_.Groups[1].Value }
Write-Host "Found $($scripts.Count) script bundles"
foreach ($s in $scripts | Select-Object -First 5) {
    try {
        $sr = Invoke-WebRequest -Uri "http://localhost:3000$s" -UseBasicParsing -TimeoutSec 30
        Write-Host "OK $($sr.StatusCode) ($($sr.Content.Length) bytes): $s"
    } catch {
        Write-Host "FAIL: $s - $($_.Exception.Message)"
    }
}
# Also check if style jsx is in the HTML source (potential issue)
if ($r.Content -match "style jsx") { Write-Host "WARNING: Found 'style jsx' in HTML" }
if ($r.Content -match "dangerouslySetInnerHTML") { Write-Host "Found dangerouslySetInnerHTML style" }
