# Warm up auth
Write-Host "Warming auth..."
$auth = Invoke-WebRequest -Uri "http://localhost:3002/api/auth/pin" -Method POST -ContentType "application/json" -Body '{"pin":"1133"}' -UseBasicParsing -TimeoutSec 120
Write-Host "Auth: $($auth.StatusCode)"
Write-Host "Waiting 5s..."
Start-Sleep 5

# Now warm up leads/new with a duplicate (lighter operation)
Write-Host "Testing leads/new..."
$sess = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$cookie = New-Object System.Net.Cookie
# Just use session from auth
$auth2 = Invoke-WebRequest -Uri "http://localhost:3002/api/auth/pin" -Method POST -ContentType "application/json" -Body '{"pin":"1133"}' -UseBasicParsing -TimeoutSec 60 -SessionVariable sess
Write-Host "Re-auth OK"
Start-Sleep 2

$ts = Get-Date -Format "HHmmss"
$leadJson = @{
    name = "Test Lead $ts"
    address = "500 Church St NW, Huntsville, AL 35801"
    phone = "256555$ts"
    email = "test$ts@example.com"
    source = "phone_call"
} | ConvertTo-Json

try {
    $lead = Invoke-WebRequest -Uri "http://localhost:3002/api/leads/new" -Method POST -ContentType "application/json" -Body $leadJson -UseBasicParsing -WebSession $sess -TimeoutSec 120
    Write-Host "Lead Status: $($lead.StatusCode)"
    $leadData = $lead.Content | ConvertFrom-Json
    Write-Host "Success: $($leadData.success)"
    if ($leadData.data.leadId) { Write-Host "Lead ID: $($leadData.data.leadId)" }
    if ($leadData.data.salesRep) { Write-Host "Rep: $($leadData.data.salesRep.name)" }
    if ($leadData.existing) { Write-Host "Existing: matched by $($leadData.data.matchedBy)" }
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Host "Body: $($reader.ReadToEnd().Substring(0, 500))"
    }
}
Write-Host "Done"
