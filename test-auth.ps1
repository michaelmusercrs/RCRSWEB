$body = @{action="login-pin";pin="1135"} | ConvertTo-Json
$resp = Invoke-WebRequest -Uri "http://localhost:3000/api/portal/auth" -Method POST -ContentType "application/json" -Body $body -UseBasicParsing
Write-Host "STATUS: $($resp.StatusCode)"
Write-Host $resp.Content
