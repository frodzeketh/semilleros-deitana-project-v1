# TestPermisos.ps1 - Probar diferentes enfoques considerando permisos

Write-Host "Probando diferentes enfoques para eliminar tablas..." -ForegroundColor Red

# Variables directas
$DB_HOST = "centerbeam.proxy.rlwy.net"
$DB_PORT = "32877"
$DB_USER = "root"
$DB_PASSWORD = "gbrIerodvEYzzDQbgtlQjelgLaLlgPuf"
$DB_NAME = "railway"
$testTable = "alb-compra"

Write-Host "Probando con tabla: $testTable" -ForegroundColor Yellow

# PRUEBA 1: Verificar permisos del usuario
Write-Host ""
Write-Host "PRUEBA 1: Verificar permisos del usuario" -ForegroundColor Cyan
$cmd1 = "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD -e 'SHOW GRANTS FOR CURRENT_USER();'"
Write-Host "Comando: $cmd1" -ForegroundColor Gray
$result1 = Invoke-Expression $cmd1 2>&1
Write-Host "Código: $LASTEXITCODE" -ForegroundColor White
Write-Host "Permisos:" -ForegroundColor White
$result1 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }

# PRUEBA 2: Verificar si podemos hacer SELECT en la tabla
Write-Host ""
Write-Host "PRUEBA 2: Verificar acceso SELECT a la tabla" -ForegroundColor Cyan
$cmd2 = "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD -e 'SELECT COUNT(*) FROM $DB_NAME.$testTable;'"
Write-Host "Comando: $cmd2" -ForegroundColor Gray
$result2 = Invoke-Expression $cmd2 2>&1
Write-Host "Código: $LASTEXITCODE" -ForegroundColor White
Write-Host "Resultado: $result2" -ForegroundColor White

# PRUEBA 3: Probar DROP sin especificar base de datos (usando USE)
Write-Host ""
Write-Host "PRUEBA 3: DROP usando USE" -ForegroundColor Cyan
$cmd3 = "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD -e 'USE $DB_NAME; DROP TABLE IF EXISTS $testTable;'"
Write-Host "Comando: $cmd3" -ForegroundColor Gray
$result3 = Invoke-Expression $cmd3 2>&1
Write-Host "Código: $LASTEXITCODE" -ForegroundColor White
Write-Host "Resultado: $result3" -ForegroundColor White

# PRUEBA 4: Probar con backticks en el nombre de tabla
Write-Host ""
Write-Host "PRUEBA 4: DROP con backticks en nombre de tabla" -ForegroundColor Cyan
$cmd4 = "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD -e 'USE $DB_NAME; DROP TABLE IF EXISTS \`$testTable\`;'"
Write-Host "Comando: $cmd4" -ForegroundColor Gray
$result4 = Invoke-Expression $cmd4 2>&1
Write-Host "Código: $LASTEXITCODE" -ForegroundColor White
Write-Host "Resultado: $result4" -ForegroundColor White

# PRUEBA 5: Probar con comillas dobles en el comando
Write-Host ""
Write-Host "PRUEBA 5: DROP con comillas dobles" -ForegroundColor Cyan
$cmd5 = "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD -e `"USE $DB_NAME; DROP TABLE IF EXISTS $testTable;`""
Write-Host "Comando: $cmd5" -ForegroundColor Gray
$result5 = Invoke-Expression $cmd5 2>&1
Write-Host "Código: $LASTEXITCODE" -ForegroundColor White
Write-Host "Resultado: $result5" -ForegroundColor White

# PRUEBA 6: Verificar si la tabla sigue existiendo
Write-Host ""
Write-Host "PRUEBA 6: Verificar si la tabla sigue existiendo" -ForegroundColor Cyan
$cmd6 = "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD -e 'SHOW TABLES FROM $DB_NAME LIKE `"$testTable`";'"
$result6 = Invoke-Expression $cmd6 2>&1
Write-Host "Código: $LASTEXITCODE" -ForegroundColor White
Write-Host "Resultado: $result6" -ForegroundColor White

if ($result6 -match $testTable) {
    Write-Host "❌ La tabla $testTable SÍ sigue existiendo" -ForegroundColor Red
} else {
    Write-Host "✅ La tabla $testTable NO existe (fue eliminada)" -ForegroundColor Green
}
