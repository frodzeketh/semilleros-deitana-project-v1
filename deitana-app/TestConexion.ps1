# TestConexion.ps1 - Probar conexión básica a MySQL

Write-Host "Probando conexión básica a MySQL..." -ForegroundColor Red

# Variables directas
$DB_HOST = "centerbeam.proxy.rlwy.net"
$DB_PORT = "32877"
$DB_USER = "root"
$DB_PASSWORD = "gbrIerodvEYzzDQbgtlQjelgLaLlgPuf"
$DB_NAME = "railway"

# PRUEBA 1: Conectar y mostrar version
Write-Host ""
Write-Host "PRUEBA 1: Mostrar versión de MySQL" -ForegroundColor Cyan
$cmd1 = "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD -e 'SELECT VERSION();'"
Write-Host "Comando: $cmd1" -ForegroundColor Gray
$result1 = Invoke-Expression $cmd1 2>&1
Write-Host "Código: $LASTEXITCODE" -ForegroundColor White
Write-Host "Resultado: $result1" -ForegroundColor White

# PRUEBA 2: Mostrar bases de datos
Write-Host ""
Write-Host "PRUEBA 2: Mostrar bases de datos" -ForegroundColor Cyan
$cmd2 = "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD -e 'SHOW DATABASES;'"
Write-Host "Comando: $cmd2" -ForegroundColor Gray
$result2 = Invoke-Expression $cmd2 2>&1
Write-Host "Código: $LASTEXITCODE" -ForegroundColor White
Write-Host "Resultado: $result2" -ForegroundColor White

# PRUEBA 3: Conectar a la base de datos específica
Write-Host ""
Write-Host "PRUEBA 3: Conectar a base de datos $DB_NAME" -ForegroundColor Cyan
$cmd3 = "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD -e 'USE $DB_NAME; SELECT DATABASE();'"
Write-Host "Comando: $cmd3" -ForegroundColor Gray
$result3 = Invoke-Expression $cmd3 2>&1
Write-Host "Código: $LASTEXITCODE" -ForegroundColor White
Write-Host "Resultado: $result3" -ForegroundColor White

# PRUEBA 4: Mostrar tablas (comando que sabemos que funciona)
Write-Host ""
Write-Host "PRUEBA 4: Mostrar tablas" -ForegroundColor Cyan
$cmd4 = "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD -e 'SHOW TABLES FROM $DB_NAME;'"
Write-Host "Comando: $cmd4" -ForegroundColor Gray
$result4 = Invoke-Expression $cmd4 2>&1
Write-Host "Código: $LASTEXITCODE" -ForegroundColor White
Write-Host "Primeras 5 líneas del resultado:" -ForegroundColor White
$result4 | Select-Object -First 5 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }

# PRUEBA 5: Probar comando simple sin base de datos
Write-Host ""
Write-Host "PRUEBA 5: Comando simple sin especificar base de datos" -ForegroundColor Cyan
$cmd5 = "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD -e 'SELECT 1;'"
Write-Host "Comando: $cmd5" -ForegroundColor Gray
$result5 = Invoke-Expression $cmd5 2>&1
Write-Host "Código: $LASTEXITCODE" -ForegroundColor White
Write-Host "Resultado: $result5" -ForegroundColor White
