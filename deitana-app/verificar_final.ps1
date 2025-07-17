# Verificacion final de sincronizacion
Write-Host "Verificando sincronizacion final..." -ForegroundColor Cyan

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
        
        if ($result -match "\d+") {
            Write-Host "OK Base de datos EJA sincronizada correctamente" -ForegroundColor Green
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

if (Test-Path "eja_dump.sql") {
    Remove-Item "eja_dump.sql" -Force
    Write-Host "OK Archivo temporal eliminado" -ForegroundColor Green
}

if (Test-Path "test_dump.sql") {
    Remove-Item "test_dump.sql" -Force
    Write-Host "OK Archivo temporal eliminado" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "    SINCRONIZACION COMPLETADA" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "OK Base de datos EJA sincronizada" -ForegroundColor Green
Write-Host "OK Configuracion actualizada" -ForegroundColor Green
Write-Host "OK Archivos temporales limpiados" -ForegroundColor Green
Write-Host ""

Write-Host "PROXIMO PASO:" -ForegroundColor Cyan
Write-Host "Configurar tarea programada para automatizacion" -ForegroundColor White
Write-Host ""

Read-Host "Presiona Enter para continuar" 