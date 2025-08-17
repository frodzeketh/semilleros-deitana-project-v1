# TestSimple.ps1 - Script simple para probar

Write-Host "Probando comando MySQL simple..." -ForegroundColor Red

# Variables directas
$DB_HOST = "centerbeam.proxy.rlwy.net"
$DB_PORT = "32877"
$DB_USER = "root"
$DB_PASSWORD = "gbrIerodvEYzzDQbgtlQjelgLaLlgPuf"
$DB_NAME = "railway"
$testTable = "alb-compra"

Write-Host "Probando con tabla: $testTable" -ForegroundColor Yellow
Write-Host "Base de datos: $DB_NAME" -ForegroundColor Cyan

# Construir el comando SQL CORRECTO
$sql = "DROP TABLE IF EXISTS \`$DB_NAME\`.\`$testTable\`;"
Write-Host "SQL generado: $sql" -ForegroundColor Cyan

# Construir el comando completo
$cmd = "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD -e '$sql'"
Write-Host "Comando completo:" -ForegroundColor Cyan
Write-Host $cmd -ForegroundColor White

# Ejecutar
Write-Host ""
Write-Host "Ejecutando comando..." -ForegroundColor Yellow

$result = Invoke-Expression $cmd 2>&1
$exitCode = $LASTEXITCODE

Write-Host "Código de salida: $exitCode" -ForegroundColor Cyan
Write-Host "Resultado completo:" -ForegroundColor Cyan
if ($result) {
    $result | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
} else {
    Write-Host "  (Sin resultado)" -ForegroundColor Gray
}

# Probar también con comillas dobles
Write-Host ""
Write-Host "Probando con comillas dobles..." -ForegroundColor Yellow
$cmd2 = "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD -e `"$sql`""
Write-Host "Comando con comillas dobles:" -ForegroundColor Cyan
Write-Host $cmd2 -ForegroundColor White

$result2 = Invoke-Expression $cmd2 2>&1
$exitCode2 = $LASTEXITCODE

Write-Host "Código de salida: $exitCode2" -ForegroundColor Cyan
Write-Host "Resultado con comillas dobles:" -ForegroundColor Cyan
if ($result2) {
    $result2 | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
} else {
    Write-Host "  (Sin resultado)" -ForegroundColor Gray
}
