# TestMetodos.ps1 - Probar diferentes métodos para eliminar tablas

Write-Host "Probando diferentes métodos para eliminar tablas..." -ForegroundColor Red

# Variables directas
$DB_HOST = "centerbeam.proxy.rlwy.net"
$DB_PORT = "32877"
$DB_USER = "root"
$DB_PASSWORD = "gbrIerodvEYzzDQbgtlQjelgLaLlgPuf"
$DB_NAME = "railway"
$testTable = "alb-compra"

Write-Host "Probando con tabla: $testTable" -ForegroundColor Yellow

# MÉTODO 1: DROP TABLE simple
Write-Host ""
Write-Host "MÉTODO 1: DROP TABLE simple" -ForegroundColor Cyan
$sql1 = "DROP TABLE $DB_NAME.$testTable;"
$cmd1 = "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD -e '$sql1'"
Write-Host "Comando: $cmd1" -ForegroundColor Gray
$result1 = Invoke-Expression $cmd1 2>&1
Write-Host "Código: $LASTEXITCODE, Resultado: $result1" -ForegroundColor White

# MÉTODO 2: DROP TABLE IF EXISTS simple
Write-Host ""
Write-Host "MÉTODO 2: DROP TABLE IF EXISTS simple" -ForegroundColor Cyan
$sql2 = "DROP TABLE IF EXISTS $DB_NAME.$testTable;"
$cmd2 = "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD -e '$sql2'"
Write-Host "Comando: $cmd2" -ForegroundColor Gray
$result2 = Invoke-Expression $cmd2 2>&1
Write-Host "Código: $LASTEXITCODE, Resultado: $result2" -ForegroundColor White

# MÉTODO 3: TRUNCATE TABLE
Write-Host ""
Write-Host "MÉTODO 3: TRUNCATE TABLE" -ForegroundColor Cyan
$sql3 = "TRUNCATE TABLE $DB_NAME.$testTable;"
$cmd3 = "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD -e '$sql3'"
Write-Host "Comando: $cmd3" -ForegroundColor Gray
$result3 = Invoke-Expression $cmd3 2>&1
Write-Host "Código: $LASTEXITCODE, Resultado: $result3" -ForegroundColor White

# MÉTODO 4: DELETE FROM
Write-Host ""
Write-Host "MÉTODO 4: DELETE FROM" -ForegroundColor Cyan
$sql4 = "DELETE FROM $DB_NAME.$testTable;"
$cmd4 = "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD -e '$sql4'"
Write-Host "Comando: $cmd4" -ForegroundColor Gray
$result4 = Invoke-Expression $cmd4 2>&1
Write-Host "Código: $LASTEXITCODE, Resultado: $result4" -ForegroundColor White

# MÉTODO 5: Usar archivo SQL
Write-Host ""
Write-Host "MÉTODO 5: Usar archivo SQL" -ForegroundColor Cyan
$sqlFile = "test_drop.sql"
"DROP TABLE IF EXISTS $DB_NAME.$testTable;" | Out-File -FilePath $sqlFile -Encoding UTF8
$cmd5 = "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD $DB_NAME < $sqlFile"
Write-Host "Comando: $cmd5" -ForegroundColor Gray
$result5 = Invoke-Expression $cmd5 2>&1
Write-Host "Código: $LASTEXITCODE, Resultado: $result5" -ForegroundColor White
Remove-Item $sqlFile -Force -ErrorAction SilentlyContinue

# MÉTODO 6: Usar pipe con Get-Content
Write-Host ""
Write-Host "MÉTODO 6: Usar pipe con Get-Content" -ForegroundColor Cyan
$sqlFile2 = "test_drop2.sql"
"DROP TABLE IF EXISTS $DB_NAME.$testTable;" | Out-File -FilePath $sqlFile2 -Encoding UTF8
$cmd6 = "Get-Content $sqlFile2 | mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD $DB_NAME"
Write-Host "Comando: $cmd6" -ForegroundColor Gray
$result6 = Invoke-Expression $cmd6 2>&1
Write-Host "Código: $LASTEXITCODE, Resultado: $result6" -ForegroundColor White
Remove-Item $sqlFile2 -Force -ErrorAction SilentlyContinue

# Verificar si la tabla sigue existiendo
Write-Host ""
Write-Host "Verificando si la tabla sigue existiendo..." -ForegroundColor Yellow
$checkCmd = "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD -e 'SHOW TABLES FROM $DB_NAME LIKE `"$testTable`";'"
$checkResult = Invoke-Expression $checkCmd 2>&1
Write-Host "Resultado de verificación: $checkResult" -ForegroundColor White
