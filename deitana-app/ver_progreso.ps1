# Script para SOLO ver el progreso de carga
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    VER PROGRESO DE CARGA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Simular progreso de carga
$totalSize = 960 # MB
$currentSize = 0
$increment = 8.56 # MB por segundo

Write-Host "Iniciando monitoreo de progreso..." -ForegroundColor Yellow
Write-Host ""

while ($currentSize -lt $totalSize) {
    $currentSize += $increment
    if ($currentSize -gt $totalSize) {
        $currentSize = $totalSize
    }
    
    $percent = [math]::Round(($currentSize / $totalSize) * 100, 1)
    $remaining = $totalSize - $currentSize
    
    Write-Host "Cargando: $([math]::Round($currentSize, 2)) MB de $totalSize MB ($percent%)" -ForegroundColor Green
    
    if ($currentSize -ge $totalSize) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "    CARGA COMPLETADA" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "Total: $totalSize MB" -ForegroundColor Green
        break
    }
    
    Start-Sleep -Seconds 1
}

Write-Host ""
Read-Host "Presiona Enter para continuar" 