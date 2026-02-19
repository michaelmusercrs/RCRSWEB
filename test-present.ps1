try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/command-center/meetings/present" -UseBasicParsing -TimeoutSec 30
    Write-Host "STATUS: $($r.StatusCode) SIZE: $($r.Content.Length)"
    # Check for error patterns
    if ($r.Content -match "Unhandled Runtime Error") { Write-Host "ERROR: Has runtime error in HTML" }
    elseif ($r.Content -match "__next") { Write-Host "OK: Next.js page rendered" }
    # Check for key content
    if ($r.Content -match "leaderboard") { Write-Host "HAS: leaderboard reference" }
    if ($r.Content -match "SalesCompetition") { Write-Host "HAS: SalesCompetition reference" }
    if ($r.Content -match "bible") { Write-Host "HAS: bible reference" }
    if ($r.Content -match "weather") { Write-Host "HAS: weather reference" }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
}
