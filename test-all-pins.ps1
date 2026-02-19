$pins = @("1135","1138","1131","1132","1133","1134","1137","1136","2033","2010","2020","2030","2040","2070","2080","2090","2100")
foreach ($pin in $pins) {
    $body = "{`"action`":`"login-pin`",`"pin`":`"$pin`"}"
    $body | Out-File -Encoding utf8 -NoNewline C:\Users\Michael\river-city-roofing\tmp-pin.json
    $result = curl.exe -s -X POST -H "Content-Type: application/json" -d "@C:\Users\Michael\river-city-roofing\tmp-pin.json" http://localhost:3000/api/portal/auth
    $parsed = $result | ConvertFrom-Json
    if ($parsed.success) {
        Write-Host "PIN $pin = $($parsed.user.name) ($($parsed.user.role)) - OK"
    } else {
        Write-Host "PIN $pin = FAILED: $($parsed.error)" -ForegroundColor Red
    }
}
Remove-Item C:\Users\Michael\river-city-roofing\tmp-pin.json -ErrorAction SilentlyContinue
