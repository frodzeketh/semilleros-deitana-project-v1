# TestRailway.ps1 - Script simple para probar Railway

$config = @{
    HOST = "centerbeam.proxy.rlwy.net"
    PORT = "32877"
    USER = "root"
    PASSWORD = "gbrIerodvEYzzDQbgtlQjelgLaLlgPuf"
    DATABASE = "railway"
}

Write-Host "Probando conexion a Railway..." -ForegroundColor Yellow

# Probar conexion
$testCmd = "mysql -h $($config.HOST) -P $($config.PORT) -u $($config.USER) -p$($config.PASSWORD) -e 'SELECT 1;'"
$result = Invoke-Expression $testCmd 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Conexion OK" -ForegroundColor Green
    
    # Ver tablas
    Write-Host "Listando tablas..." -ForegroundColor Yellow
    $tablesCmd = "mysql -h $($config.HOST) -P $($config.PORT) -u $($config.USER) -p$($config.PASSWORD) -e 'SHOW TABLES FROM $($config.DATABASE);'"
    $tables = Invoke-Expression $tablesCmd 2>&1
    
    $tableCount = ($tables | Where-Object { $_ -match '^\w+$' } | Where-Object { $_ -notmatch 'Tables_in_' }).Count
    Write-Host "Tablas encontradas: $tableCount" -ForegroundColor Cyan
    
    # Mostrar primeras 10 tablas
    $firstTables = $tables | Where-Object { $_ -match '^\w+$' } | Where-Object { $_ -notmatch 'Tables_in_' } | Select-Object -First 10
    foreach ($table in $firstTables) {
        Write-Host "  - $table" -ForegroundColor White
    }
    
} else {
    Write-Host "Error de conexion: $result" -ForegroundColor Red
}
