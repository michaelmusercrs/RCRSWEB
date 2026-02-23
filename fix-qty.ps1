$f = "lib\unified-inventory-service.ts"
$c = Get-Content $f -Raw
$map = @{
  "INV-0026" = 40; "INV-0027" = 30; "INV-0028" = 80; "INV-0029" = 55
  "INV-0030" = 75; "INV-0031" = 50; "INV-0032" = 60; "INV-0033" = 35
  "INV-0034" = 25; "INV-0035" = 20; "INV-0036" = 30; "INV-0037" = 12
  "INV-0038" = 8; "INV-0039" = 10; "INV-0040" = 12; "INV-0041" = 25; "INV-0042" = 15
}
foreach ($id in $map.Keys) {
  $qty = $map[$id]
  $pattern = "($id.*?currentQty: )0"
  $replace = "`${1}$qty"
  $c = [regex]::Replace($c, $pattern, $replace)
}
[System.IO.File]::WriteAllText((Resolve-Path $f).Path, $c)
Write-Host "Done"
