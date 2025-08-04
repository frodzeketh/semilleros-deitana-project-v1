# Script para ver el progreso REAL de carga
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    VER PROGRESO REAL DE CARGA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Buscar archivos de dump existentes
$dumpFiles = Get-ChildItem -Path "." -Filter "erp_dump_*.sql" | Sort-Object LastWriteTime -Descending

if ($dumpFiles.Count -eq 0) {
    Write-Host "No se encontraron archivos de dump para monitorear." -ForegroundColor Yellow
    Write-Host "Ejecuta primero la sincronización para ver el progreso real." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Presiona Enter para continuar"
    exit
}

$latestDump = $dumpFiles[0]
Write-Host "Monitoreando archivo: $($latestDump.Name)" -ForegroundColor Green
Write-Host "Tamaño actual: $([math]::Round($latestDump.Length/1MB, 2)) MB" -ForegroundColor Green
Write-Host ""

$startTime = Get-Date
$lastSize = $latestDump.Length
$targetSize = 960 * 1MB # 960 MB en bytes

Write-Host "Iniciando monitoreo en tiempo real..." -ForegroundColor Yellow
Write-Host ""

while ($true) {
    if (Test-Path $latestDump.FullName) {
        $currentSize = (Get-Item $latestDump.FullName).Length
        $sizeMB = [math]::Round($currentSize / 1MB, 2)
        $percent = [math]::Round(($currentSize / $targetSize) * 100, 1)
        
        $elapsed = (Get-Date) - $startTime
        $speedMBps = if ($elapsed.TotalSeconds -gt 0) { [math]::Round($sizeMB / $elapsed.TotalSeconds, 2) } else { 0 }
        
        Write-Host "Cargando: $sizeMB MB de 960 MB ($percent%) - Velocidad: $speedMBps MB/s" -ForegroundColor Green
        
        if ($currentSize -gt $lastSize) {
            $lastSize = $currentSize
        }
        
        if ($currentSize >= $targetSize) {
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Green
            Write-Host "    CARGA COMPLETADA" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Green
            Write-Host "Total: $sizeMB MB" -ForegroundColor Green
            Write-Host "Tiempo total: $([math]::Round($elapsed.TotalSeconds, 0)) segundos" -ForegroundColor Green
            break
        }
    } else {
        Write-Host "Archivo no encontrado. ¿Se completó la exportación?" -ForegroundColor Yellow
        break
    }
    
    Start-Sleep -Seconds 2
}

Write-Host ""
Read-Host "Presiona Enter para continuar" 