$ErrorActionPreference = "Stop"

# Auth
$auth = Invoke-WebRequest -Uri "http://localhost:3002/api/auth/pin" -Method POST -ContentType "application/json" -Body '{"pin":"1133"}' -UseBasicParsing -SessionVariable sess
Write-Host "Auth OK"

# Nearby (POST)
Write-Host "=== NEARBY ==="
$nearbyJson = @{ address = "123 Main St, Huntsville, AL 35801" } | ConvertTo-Json
try {
    $nearby = Invoke-WebRequest -Uri "http://localhost:3002/api/leads/nearby" -Method POST -ContentType "application/json" -Body $nearbyJson -UseBasicParsing -WebSession $sess -TimeoutSec 30
    Write-Host "Nearby Status: $($nearby.StatusCode)"
    Write-Host "Nearby Body: $($nearby.Content.Substring(0, [Math]::Min(1500, $nearby.Content.Length)))"
} catch {
    Write-Host "Nearby Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Host "Response: $($reader.ReadToEnd())"
    }
}
