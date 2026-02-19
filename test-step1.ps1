# Just auth
$auth = Invoke-WebRequest -Uri "http://localhost:3002/api/auth/pin" -Method POST -ContentType "application/json" -Body '{"pin":"1133"}' -UseBasicParsing -TimeoutSec 60
Write-Host "Auth Status: $($auth.StatusCode)"
$data = $auth.Content | ConvertFrom-Json
Write-Host "User: $($data.user.name)"
Write-Host "Token: $($data.accessToken.Substring(0, 20))..."
