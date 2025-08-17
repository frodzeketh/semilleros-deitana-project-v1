# MostrarYEliminar.ps1 - Script para mostrar y eliminar tablas

Write-Host "========================================" -ForegroundColor Red
Write-Host "    MOSTRAR Y ELIMINAR TABLAS RAILWAY" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""

# Configuración
$config = @{
    HOST = "centerbeam.proxy.rlwy.net"
    PORT = "32877"
    USER = "root"
    PASSWORD = "gbrIerodvEYzzDQbgtlQjelgLaLlgPuf"
    DATABASE = "railway"
}

# PASO 1: Mostrar todas las tablas
Write-Host "PASO 1: Obteniendo lista de tablas..." -ForegroundColor Yellow
$tablesCmd = "mysql -h $($config.HOST) -P $($config.PORT) -u $($config.USER) -p$($config.PASSWORD) -e 'SHOW TABLES FROM $($config.DATABASE);'"
Write-Host "Comando: $tablesCmd" -ForegroundColor Gray

$tables = Invoke-Expression $tablesCmd 2>&1
$exitCode = $LASTEXITCODE

Write-Host "Código de salida: $exitCode" -ForegroundColor Cyan
Write-Host "Resultado completo:" -ForegroundColor Cyan
$tables | ForEach-Object { Write-Host "  $_" -ForegroundColor White }

# Filtrar tablas
$tableList = $tables | Where-Object { $_ -notmatch '^Tables_in_' } | Where-Object { $_ -notmatch '^$' }

Write-Host ""
Write-Host "Tablas encontradas: $($tableList.Count)" -ForegroundColor Green
Write-Host "Primeras 10 tablas:" -ForegroundColor Yellow
$tableList | Select-Object -First 10 | ForEach-Object { Write-Host "  - $_" -ForegroundColor White }

# PASO 2: Probar eliminación de una tabla
Write-Host ""
Write-Host "PASO 2: Probando eliminación de una tabla..." -ForegroundColor Yellow
$testTable = $tableList[0]
Write-Host "Probando con tabla: $testTable" -ForegroundColor Cyan

# Probar comando de eliminación
$testSql = "DROP TABLE IF EXISTS \`$($config.DATABASE)\`.\`$testTable\`;"
Write-Host "SQL generado: $testSql" -ForegroundColor Gray
$testCmd = "mysql -h $($config.HOST) -P $($config.PORT) -u $($config.USER) -p$($config.PASSWORD) -e '$testSql'"

Write-Host "Comando de prueba: $testCmd" -ForegroundColor Gray

$testResult = Invoke-Expression $testCmd 2>&1
$testExitCode = $LASTEXITCODE

Write-Host "Código de salida: $testExitCode" -ForegroundColor Cyan
Write-Host "Resultado de prueba:" -ForegroundColor Cyan
$testResult | ForEach-Object { Write-Host "  $_" -ForegroundColor White }

# Verificar si la tabla se eliminó
Write-Host ""
Write-Host "Verificando si la tabla se eliminó..." -ForegroundColor Yellow
$checkCmd = "mysql -h $($config.HOST) -P $($config.PORT) -u $($config.USER) -p$($config.PASSWORD) -e 'SHOW TABLES FROM $($config.DATABASE) LIKE `"$testTable`";'"
$checkResult = Invoke-Expression $checkCmd 2>&1
$checkExitCode = $LASTEXITCODE

Write-Host "Código de verificación: $checkExitCode" -ForegroundColor Cyan
Write-Host "Resultado de verificación:" -ForegroundColor Cyan
$checkResult | ForEach-Object { Write-Host "  $_" -ForegroundColor White }

if ($checkResult -match $testTable) {
    Write-Host "❌ La tabla $testTable NO se eliminó" -ForegroundColor Red
} else {
    Write-Host "✅ La tabla $testTable SÍ se eliminó" -ForegroundColor Green
}

# PASO 3: Preguntar si continuar
Write-Host ""
$continuar = Read-Host "¿Continuar eliminando todas las tablas? (SI/NO)"
if ($continuar -ne "SI") {
    Write-Host "Cancelado" -ForegroundColor Yellow
    exit
}

# PASO 4: Eliminar todas las tablas
Write-Host ""
Write-Host "PASO 4: Eliminando todas las tablas..." -ForegroundColor Yellow

$successCount = 0
$errorCount = 0

foreach ($table in $tableList) {
    Write-Host "Eliminando: $table" -ForegroundColor Yellow
    
    $sql = "DROP TABLE IF EXISTS \`$($config.DATABASE)\`.\`$table\`;"
    $cmd = "mysql -h $($config.HOST) -P $($config.PORT) -u $($config.USER) -p$($config.PASSWORD) -e '$sql'"
    
    $result = Invoke-Expression $cmd 2>&1
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Write-Host "  ✅ $table eliminada (código: $exitCode)" -ForegroundColor Green
        $successCount++
    } else {
        Write-Host "  ❌ Error eliminando $table (código: $exitCode)" -ForegroundColor Red
        Write-Host "     Error: $result" -ForegroundColor Red
        $errorCount++
    }
}

# PASO 5: Verificar resultado final
Write-Host ""
Write-Host "PASO 5: Verificando resultado final..." -ForegroundColor Yellow
Write-Host "Resumen: $successCount eliminadas, $errorCount errores" -ForegroundColor Cyan

$finalCmd = "mysql -h $($config.HOST) -P $($config.PORT) -u $($config.USER) -p$($config.PASSWORD) -e 'SHOW TABLES FROM $($config.DATABASE);'"
$finalResult = Invoke-Expression $finalCmd 2>&1
$finalTables = $finalResult | Where-Object { $_ -notmatch '^Tables_in_' } | Where-Object { $_ -notmatch '^$' }

if ($finalTables.Count -eq 0) {
    Write-Host "🎉 ¡ÉXITO! Todas las tablas han sido eliminadas" -ForegroundColor Green
} else {
    Write-Host "⚠️  ADVERTENCIA: Quedan $($finalTables.Count) tablas sin eliminar" -ForegroundColor Red
    Write-Host "Tablas restantes:" -ForegroundColor Red
    $finalTables | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
}
