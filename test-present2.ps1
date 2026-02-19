Write-Host "Testing presentation page..."
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/command-center/meetings/present" -UseBasicParsing -TimeoutSec 120
    Write-Host "STATUS: $($r.StatusCode) SIZE: $($r.Content.Length)"
    if ($r.Content -match "Unhandled Runtime Error") { Write-Host "HAS RUNTIME ERROR in SSR" }
    if ($r.Content -match "__next") { Write-Host "OK: Next.js rendered" }
    if ($r.Content -match "leaderboard") { Write-Host "HAS: leaderboard" }
    if ($r.Content -match "SalesCompetition") { Write-Host "HAS: SalesCompetition" }
    if ($r.Content -match "bible") { Write-Host "HAS: bible" }
    if ($r.Content -match "weather") { Write-Host "HAS: weather" }
    if ($r.Content -match "style") { Write-Host "HAS: style tags" }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        Write-Host "HTTP: $($_.Exception.Response.StatusCode.value__)"
    }
}
