# Verificar importacion a Railway
Write-Host "Verificando importacion a Railway..." -ForegroundColor Cyan

$railwayHost = "centerbeam.proxy.rlwy.net"
$railwayPort = "32877"
$railwayUser = "root"
$railwayPass = "gbrIerodvEYzzDQbgtlQjelgLaLlgPuf"
$railwayDb = "railway"

try {
    $result = & mysql -h $railwayHost -P $railwayPort -u $railwayUser "-p$railwayPass" $railwayDb -e "SELECT COUNT(*) as total_tables FROM information_schema.tables WHERE table_schema = 'railway';" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "OK Conexion a Railway exitosa" -ForegroundColor Green
        Write-Host "Resultado: $result" -ForegroundColor White
        
        # Verificar si hay tablas
        if ($result -match "\d+") {
            Write-Host "OK Se encontraron tablas en Railway" -ForegroundColor Green
        } else {
            Write-Host "ADVERTENCIA: No se encontraron tablas" -ForegroundColor Yellow
        }
    } else {
        Write-Host "ERROR en conexion a Railway" -ForegroundColor Red
        Write-Host "Error: $result" -ForegroundColor Red
    }
} catch {
    Write-Host "ERROR al verificar Railway: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Limpieza de archivos temporales..." -ForegroundColor Yellow

if (Test-Path "test_dump.sql") {
    Remove-Item "test_dump.sql" -Force
    Write-Host "OK Archivo temporal eliminado" -ForegroundColor Green
}

Write-Host ""
Write-Host "Test completado!" -ForegroundColor Green
Read-Host "Presiona Enter para continuar" 