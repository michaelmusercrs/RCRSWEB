$conns = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($conns) {
    foreach ($c in $conns) {
        $proc = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
        Write-Host "Port 3000: PID=$($c.OwningProcess) State=$($c.State) Process=$($proc.ProcessName)"
    }
} else {
    Write-Host "Port 3000: NOT IN USE"
}
