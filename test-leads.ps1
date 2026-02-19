$ErrorActionPreference = "Stop"

# Step 1: Auth
Write-Host "=== AUTH ==="
try {
    $auth = Invoke-WebRequest -Uri "http://localhost:3002/api/auth/pin" -Method POST -ContentType "application/json" -Body '{"pin":"1133"}' -UseBasicParsing -SessionVariable sess
    Write-Host "Auth Status: $($auth.StatusCode)"
    Write-Host "Auth Body: $($auth.Content.Substring(0, [Math]::Min(500, $auth.Content.Length)))"
} catch {
    Write-Host "Auth Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Host "Response: $($reader.ReadToEnd())"
    }
    exit 1
}

# Step 2: Create lead
Write-Host "`n=== CREATE LEAD ==="
$leadData = @{
    name = "Test Lead John"
    address = "123 Main St, Huntsville, AL 35801"
    phone = "2565551234"
    email = "testlead@example.com"
    source = "web"
} | ConvertTo-Json

try {
    $lead = Invoke-WebRequest -Uri "http://localhost:3002/api/leads/new" -Method POST -ContentType "application/json" -Body $leadData -UseBasicParsing -WebSession $sess
    Write-Host "Lead Status: $($lead.StatusCode)"
    Write-Host "Lead Body: $($lead.Content.Substring(0, [Math]::Min(800, $lead.Content.Length)))"
} catch {
    Write-Host "Lead Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Host "Response: $($reader.ReadToEnd())"
    }
}

# Step 3: List leads
Write-Host "`n=== LIST LEADS ==="
try {
    $list = Invoke-WebRequest -Uri "http://localhost:3002/api/leads" -UseBasicParsing -WebSession $sess
    Write-Host "List Status: $($list.StatusCode)"
    Write-Host "List Body: $($list.Content.Substring(0, [Math]::Min(800, $list.Content.Length)))"
} catch {
    Write-Host "List Error: $($_.Exception.Message)"
}

# Step 4: Metrics
Write-Host "`n=== METRICS ==="
try {
    $metrics = Invoke-WebRequest -Uri "http://localhost:3002/api/leads/metrics" -UseBasicParsing -WebSession $sess
    Write-Host "Metrics Status: $($metrics.StatusCode)"
    Write-Host "Metrics Body: $($metrics.Content.Substring(0, [Math]::Min(800, $metrics.Content.Length)))"
} catch {
    Write-Host "Metrics Error: $($_.Exception.Message)"
}

# Step 5: Nearby
Write-Host "`n=== NEARBY ==="
try {
    $nearby = Invoke-WebRequest -Uri "http://localhost:3002/api/leads/nearby?address=123+Main+St+Huntsville+AL" -UseBasicParsing -WebSession $sess
    Write-Host "Nearby Status: $($nearby.StatusCode)"
    Write-Host "Nearby Body: $($nearby.Content.Substring(0, [Math]::Min(800, $nearby.Content.Length)))"
} catch {
    Write-Host "Nearby Error: $($_.Exception.Message)"
}

# Step 6: Office portal page
Write-Host "`n=== OFFICE PORTAL ==="
try {
    $portal = Invoke-WebRequest -Uri "http://localhost:3002/portal/office/new-lead" -UseBasicParsing -WebSession $sess
    Write-Host "Portal Status: $($portal.StatusCode)"
    $isHtml = $portal.Content.Contains("<html") -or $portal.Content.Contains("<!DOCTYPE")
    Write-Host "Is HTML page: $isHtml"
} catch {
    Write-Host "Portal Error: $($_.Exception.Message)"
}

Write-Host "`n=== DONE ==="
