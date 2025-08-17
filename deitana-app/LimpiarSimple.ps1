# LimpiarSimple.ps1 - Script simple para limpiar Railway

Write-Host "Limpiando Railway..." -ForegroundColor Red

# Variables
$DB_HOST = "centerbeam.proxy.rlwy.net"
$DB_PORT = "32877"
$DB_USER = "root"
$DB_PASSWORD = "gbrIerodvEYzzDQbgtlQjelgLaLlgPuf"
$DB_NAME = "railway"

# Obtener tablas
Write-Host "Obteniendo tablas..." -ForegroundColor Yellow
$tablesCmd = "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD -e 'SHOW TABLES FROM $DB_NAME;'"
$tables = Invoke-Expression $tablesCmd 2>&1
$tableList = $tables | Where-Object { $_ -notmatch '^Tables_in_' } | Where-Object { $_ -notmatch '^$' }

Write-Host "Encontradas $($tableList.Count) tablas" -ForegroundColor Cyan

# Confirmar
$confirmation = Read-Host "Eliminar todas las tablas? (SI/NO)"
if ($confirmation -ne "SI") {
    Write-Host "Cancelado" -ForegroundColor Yellow
    exit
}

# Crear archivo SQL
$sqlFile = "drop_tables.sql"
$sqlContent = "USE $DB_NAME;`n"
foreach ($table in $tableList) {
    $sqlContent += "DROP TABLE IF EXISTS $table;`n"
}
$sqlContent | Out-File -FilePath $sqlFile -Encoding UTF8

# Ejecutar
Write-Host "Ejecutando DROP..." -ForegroundColor Yellow
$cmd = "Get-Content $sqlFile | mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD"
$result = Invoke-Expression $cmd 2>&1

# Limpiar archivo
Remove-Item $sqlFile -Force -ErrorAction SilentlyContinue

# Verificar
Write-Host "Verificando..." -ForegroundColor Yellow
$checkCmd = "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD -e 'SHOW TABLES FROM $DB_NAME;'"
$checkResult = Invoke-Expression $checkCmd 2>&1
$remainingTables = $checkResult | Where-Object { $_ -notmatch '^Tables_in_' } | Where-Object { $_ -notmatch '^$' }

if ($remainingTables.Count -eq 0) {
    Write-Host "EXITO! Todas las tablas eliminadas" -ForegroundColor Green
} else {
    Write-Host "ADVERTENCIA: Quedan $($remainingTables.Count) tablas" -ForegroundColor Red
}
