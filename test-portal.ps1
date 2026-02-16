$base = "http://localhost:3002"

# Login
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
try {
    $r = Invoke-WebRequest -Uri "$base/api/portal/auth" -Method POST -ContentType "application/json" -Body '{"action":"login-pin","pin":"1135"}' -WebSession $session -UseBasicParsing
    Write-Host "LOGIN: $($r.StatusCode) - $($r.Content.Substring(0, [Math]::Min(100, $r.Content.Length)))" -ForegroundColor Green
} catch {
    Write-Host "LOGIN FAILED: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    exit 1
}

# Test API endpoints
$apis = @(
    @{Method="GET"; Path="/api/portal/dashboard"},
    @{Method="GET"; Path="/api/portal/monday-notes"},
    @{Method="GET"; Path="/api/portal/inventory"},
    @{Method="GET"; Path="/api/portal/users"},
    @{Method="GET"; Path="/api/portal/jobs"},
    @{Method="GET"; Path="/api/portal/training"}
)

foreach ($api in $apis) {
    try {
        $r = Invoke-WebRequest -Uri "$base$($api.Path)" -Method $api.Method -WebSession $session -UseBasicParsing
        $preview = $r.Content.Substring(0, [Math]::Min(120, $r.Content.Length))
        Write-Host "OK $($api.Method) $($api.Path): $($r.StatusCode) - $preview" -ForegroundColor Green
    } catch {
        $code = $_.Exception.Response.StatusCode
        try { $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream()); $body = $reader.ReadToEnd(); $preview = $body.Substring(0, [Math]::Min(200, $body.Length)) } catch { $preview = "no body" }
        Write-Host "FAIL $($api.Method) $($api.Path): $code - $preview" -ForegroundColor Red
    }
}

# Test page renders
$pages = @(
    "/portal/dashboard",
    "/portal/my-profile",
    "/portal/monday-notes",
    "/portal/sales/leads",
    "/portal/sales/performance",
    "/portal/sales/customers",
    "/portal/inventory/management",
    "/portal/admin/lead-distro",
    "/portal/admin/team",
    "/portal/admin/portal-settings",
    "/portal/training",
    "/portal/quizzes"
)

foreach ($page in $pages) {
    try {
        $r = Invoke-WebRequest -Uri "$base$page" -Method GET -WebSession $session -UseBasicParsing
        # Check if it's a real page (not redirect to login or 404 content)
        if ($r.Content -match "404" -and $r.Content -match "Page Not Found") {
            Write-Host "404  PAGE $page" -ForegroundColor Red
        } else {
            Write-Host "OK   PAGE $page : $($r.StatusCode)" -ForegroundColor Green
        }
    } catch {
        $code = $_.Exception.Response.StatusCode
        Write-Host "FAIL PAGE $page : $code" -ForegroundColor Red
    }
}
