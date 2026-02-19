$ErrorActionPreference = "Stop"

# Auth
Write-Host "=== AUTH ==="
$auth = Invoke-WebRequest -Uri "http://localhost:3002/api/auth/pin" -Method POST -ContentType "application/json" -Body '{"pin":"1133"}' -UseBasicParsing -SessionVariable sess
$authData = $auth.Content | ConvertFrom-Json
Write-Host "Auth: $($authData.success) - $($authData.user.name) ($($authData.user.role))"

# Create NEW lead (unique phone)
Write-Host "`n=== CREATE LEAD ==="
$ts = Get-Date -Format "HHmmss"
$leadJson = @{
    name = "Test Lead $ts"
    address = "500 Church St NW, Huntsville, AL 35801"
    phone = "256555$ts"
    email = "test$ts@example.com"
    source = "phone_call"
    notes = "Test lead created by automation"
} | ConvertTo-Json
try {
    $lead = Invoke-WebRequest -Uri "http://localhost:3002/api/leads/new" -Method POST -ContentType "application/json" -Body $leadJson -UseBasicParsing -WebSession $sess -TimeoutSec 30
    Write-Host "Lead Status: $($lead.StatusCode)"
    $leadData = $lead.Content | ConvertFrom-Json
    Write-Host "Success: $($leadData.success)"
    Write-Host "Lead ID: $($leadData.data.leadId)"
    Write-Host "Assigned Rep: $($leadData.data.salesRep.name) ($($leadData.data.salesRep.slug))"
    Write-Host "Portal URL: $($leadData.data.portalUrl)"
    Write-Host "Created: $($leadData.data.createdAt)"
    if ($leadData.existing) { Write-Host "NOTE: Lead already existed (matched by $($leadData.data.matchedBy))" }
} catch {
    Write-Host "Lead Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Host "Response: $($reader.ReadToEnd())"
    }
}

# List leads
Write-Host "`n=== LIST LEADS ==="
try {
    $list = Invoke-WebRequest -Uri "http://localhost:3002/api/leads" -UseBasicParsing -WebSession $sess -TimeoutSec 15
    $listData = $list.Content | ConvertFrom-Json
    Write-Host "Total leads: $($listData.leads.Count)"
    foreach ($l in $listData.leads | Select-Object -First 3) {
        Write-Host "  - $($l.leadId): $($l.customerName) -> $($l.assignedRep) [$($l.status)]"
    }
} catch {
    Write-Host "List Error: $($_.Exception.Message)"
}

# Metrics
Write-Host "`n=== METRICS ==="
try {
    $metrics = Invoke-WebRequest -Uri "http://localhost:3002/api/leads/metrics" -UseBasicParsing -WebSession $sess -TimeoutSec 15
    $metricsData = $metrics.Content | ConvertFrom-Json
    $kpis = $metricsData.data.kpis
    Write-Host "Total Leads: $($kpis.totalLeads) | Today: $($kpis.leadsToday) | Conv Rate: $($kpis.conversionRate)% | Avg Response: $($kpis.avgResponseMinutes)min"
    Write-Host "Active Reps:"
    foreach ($r in $metricsData.data.reps | Select-Object -First 5) {
        Write-Host "  - $($r.repName): $($r.totalLeads) leads, receiving=$($r.isReceivingLeads)"
    }
} catch {
    Write-Host "Metrics Error: $($_.Exception.Message)"
}

# Nearby
Write-Host "`n=== NEARBY ==="
$nearbyJson = @{ address = "500 Church St NW, Huntsville, AL 35801"; radiusMiles = 5 } | ConvertTo-Json
try {
    $nearby = Invoke-WebRequest -Uri "http://localhost:3002/api/leads/nearby" -Method POST -ContentType "application/json" -Body $nearbyJson -UseBasicParsing -WebSession $sess -TimeoutSec 30
    $nearbyData = $nearby.Content | ConvertFrom-Json
    Write-Host "Nearby Status: $($nearby.StatusCode)"
    Write-Host "Geocoded: $($nearbyData.data.geocoded.formattedAddress)"
    Write-Host "Exact matches: $($nearbyData.data.exactMatches)"
    Write-Host "Same street: $($nearbyData.data.sameStreetCount)"
    Write-Host "Nearby contacts: $($nearbyData.data.nearbyCount)"
    foreach ($r in $nearbyData.data.nearbyByRep) {
        Write-Host "  - $($r.repSlug): $($r.count) nearby, closest $($r.closestMiles)mi"
    }
} catch {
    Write-Host "Nearby Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $respBody = $reader.ReadToEnd()
        Write-Host "Response: $($respBody.Substring(0, [Math]::Min(500, $respBody.Length)))"
    }
}

# Office portal page
Write-Host "`n=== OFFICE PORTAL ==="
try {
    $portal = Invoke-WebRequest -Uri "http://localhost:3002/portal/office/new-lead" -UseBasicParsing -WebSession $sess -TimeoutSec 15
    Write-Host "Portal Status: $($portal.StatusCode) (HTML page loaded)"
} catch {
    Write-Host "Portal Error: $($_.Exception.Message)"
}

Write-Host "`n=== ALL TESTS COMPLETE ==="
