# Auth then create lead
$auth = Invoke-WebRequest -Uri "http://localhost:3002/api/auth/pin" -Method POST -ContentType "application/json" -Body '{"pin":"1133"}' -UseBasicParsing -TimeoutSec 60 -SessionVariable sess
Write-Host "Auth OK"

$ts = Get-Date -Format "HHmmss"
$leadJson = @{
    name = "Test Lead $ts"
    address = "500 Church St NW, Huntsville, AL 35801"
    phone = "256555$ts"
    email = "test$ts@example.com"
    source = "phone_call"
} | ConvertTo-Json

Write-Host "Creating lead..."
try {
    $lead = Invoke-WebRequest -Uri "http://localhost:3002/api/leads/new" -Method POST -ContentType "application/json" -Body $leadJson -UseBasicParsing -WebSession $sess -TimeoutSec 120
    Write-Host "Lead Status: $($lead.StatusCode)"
    Write-Host "Body (first 1500): $($lead.Content.Substring(0, [Math]::Min(1500, $lead.Content.Length)))"
} catch {
    Write-Host "Lead Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Host "Response: $($reader.ReadToEnd())"
    }
}
