$ErrorActionPreference = "Stop"

# Auth
$auth = Invoke-WebRequest -Uri "http://localhost:3002/api/auth/pin" -Method POST -ContentType "application/json" -Body '{"pin":"1133"}' -UseBasicParsing -SessionVariable sess
$token = ($auth.Content | ConvertFrom-Json).accessToken
Write-Host "Auth OK, token obtained"

# Create lead with valid source
Write-Host "`n=== CREATE LEAD ==="
$leadJson = @{
    name = "Test Lead John"
    address = "123 Main St, Huntsville, AL 35801"
    phone = "2565551234"
    email = "testlead@example.com"
    source = "phone_call"
} | ConvertTo-Json
try {
    $lead = Invoke-WebRequest -Uri "http://localhost:3002/api/leads/new" -Method POST -ContentType "application/json" -Body $leadJson -UseBasicParsing -WebSession $sess
    Write-Host "Lead Status: $($lead.StatusCode)"
    Write-Host "Lead Body: $($lead.Content.Substring(0, [Math]::Min(1200, $lead.Content.Length)))"
} catch {
    Write-Host "Lead Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Host "Response: $($reader.ReadToEnd())"
    }
}

# Nearby (POST)
Write-Host "`n=== NEARBY ==="
$nearbyJson = @{ address = "123 Main St, Huntsville, AL 35801" } | ConvertTo-Json
try {
    $nearby = Invoke-WebRequest -Uri "http://localhost:3002/api/leads/nearby" -Method POST -ContentType "application/json" -Body $nearbyJson -UseBasicParsing -WebSession $sess
    Write-Host "Nearby Status: $($nearby.StatusCode)"
    Write-Host "Nearby Body: $($nearby.Content.Substring(0, [Math]::Min(1200, $nearby.Content.Length)))"
} catch {
    Write-Host "Nearby Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Host "Response: $($reader.ReadToEnd())"
    }
}

Write-Host "`n=== DONE ==="
