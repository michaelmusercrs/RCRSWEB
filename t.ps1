try {
    $r = Invoke-WebRequest -Uri 'http://localhost:3000/' -UseBasicParsing -TimeoutSec 20
    Write-Host "Status: $($r.StatusCode)"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}
