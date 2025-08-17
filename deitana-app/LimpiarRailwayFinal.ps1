# LimpiarRailwayFinal.ps1 - Script final para limpiar Railway

Write-Host "========================================" -ForegroundColor Red
Write-Host "    LIMPIAR RAILWAY - VERSIÓN FINAL" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""

# Variables directas
$DB_HOST = "centerbeam.proxy.rlwy.net"
$DB_PORT = "32877"
$DB_USER = "root"
$DB_PASSWORD = "gbrIerodvEYzzDQbgtlQjelgLaLlgPuf"
$DB_NAME = "railway"

# PASO 1: Obtener tablas
Write-Host "PASO 1: Obteniendo lista de tablas..." -ForegroundColor Yellow
$tablesCmd = "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD -e 'SHOW TABLES FROM $DB_NAME;'"
$tables = Invoke-Expression $tablesCmd 2>&1

# Filtrar tablas
$tableList = $tables | Where-Object { $_ -notmatch '^Tables_in_' } | Where-Object { $_ -notmatch '^$' }

Write-Host "Encontradas $($tableList.Count) tablas" -ForegroundColor Cyan

# Mostrar algunas tablas
Write-Host "Primeras 5 tablas:" -ForegroundColor Yellow
$tableList | Select-Object -First 5 | ForEach-Object { Write-Host "  - $_" -ForegroundColor White }

# Confirmar
Write-Host ""
$confirmation = Read-Host "¿Eliminar todas las $($tableList.Count) tablas? (SI/NO)"
if ($confirmation -ne "SI") {
    Write-Host "Cancelado" -ForegroundColor Yellow
    exit
}

# PASO 2: Crear archivo SQL con todos los DROP
Write-Host ""
Write-Host "PASO 2: Creando archivo SQL con comandos DROP..." -ForegroundColor Yellow
$sqlFile = "drop_all_tables.sql"

# Crear contenido SQL
$sqlContent = "USE $DB_NAME;`n"
foreach ($table in $tableList) {
    $sqlContent += "DROP TABLE IF EXISTS $table;`n"
}

$sqlContent | Out-File -FilePath $sqlFile -Encoding UTF8
Write-Host "Archivo SQL creado: $sqlFile" -ForegroundColor Cyan

# PASO 3: Ejecutar archivo SQL
Write-Host ""
Write-Host "PASO 3: Ejecutando comandos DROP..." -ForegroundColor Yellow
$cmd = "Get-Content $sqlFile | mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD"
$result = Invoke-Expression $cmd 2>&1
$exitCode = $LASTEXITCODE

Write-Host "Código de salida: $exitCode" -ForegroundColor Cyan
if ($result) {
    Write-Host "Resultado: $result" -ForegroundColor White
}

# Limpiar archivo temporal
Remove-Item $sqlFile -Force -ErrorAction SilentlyContinue

# PASO 4: Verificar resultado
Write-Host ""
Write-Host "PASO 4: Verificando resultado..." -ForegroundColor Yellow
$checkCmd = "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD -e 'SHOW TABLES FROM $DB_NAME;'"
$checkResult = Invoke-Expression $checkCmd 2>&1
$remainingTables = $checkResult | Where-Object { $_ -notmatch '^Tables_in_' } | Where-Object { $_ -notmatch '^$' }

if ($remainingTables.Count -eq 0) {
    Write-Host "🎉 ¡ÉXITO! Todas las tablas han sido eliminadas" -ForegroundColor Green
} else {
    Write-Host "⚠️  ADVERTENCIA: Quedan $($remainingTables.Count) tablas" -ForegroundColor Red
    Write-Host "Primeras 10 tablas restantes:" -ForegroundColor Red
    $remainingTables | Select-Object -First 10 | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
}
