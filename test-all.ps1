$pins = @("1135","1138","1131","1132","1133","1134","2020","2010","2030","2040","2050")
foreach ($pin in $pins) {
    $body = @{action="login-pin";pin=$pin} | ConvertTo-Json
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:3000/api/portal/auth" -Method POST -ContentType "application/json" -Body $body -UseBasicParsing
        $data = $resp.Content | ConvertFrom-Json
        if ($data.success) { Write-Host "OK $pin -> $($data.user.name) ($($data.user.role))" }
        else { Write-Host "FAIL $pin -> $($data.error)" }
    } catch {
        Write-Host "ERR $pin -> $($_.Exception.Message)"
    }
}
Write-Host "---"
# Test presentation page
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/command-center/meetings/present" -UseBasicParsing
    Write-Host "Presentation page: $($r.StatusCode) ($($r.Content.Length) bytes)"
} catch { Write-Host "Presentation page: ERROR $($_.Exception.Message)" }
# Test inventory
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/command-center/inventory" -UseBasicParsing
    Write-Host "Inventory API: $($r.StatusCode)"
} catch { Write-Host "Inventory API: $($_.Exception.Response.StatusCode.value__)" }
