# Verificador de Tarea Programada
# Script para verificar el estado sin interrumpir

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    VERIFICADOR DE TAREA PROGRAMADA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$taskName = "Sincronizacion ERP 2AM"

# Verificar si la tarea existe
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if (-not $task) {
    Write-Host "ERROR: La tarea '$taskName' no existe" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Tarea encontrada: $taskName" -ForegroundColor Green

# Obtener información detallada
$taskInfo = Get-ScheduledTaskInfo -TaskName $taskName

Write-Host ""
Write-Host "INFORMACIÓN DE LA TAREA:" -ForegroundColor Yellow
Write-Host "Estado: $($task.State)" -ForegroundColor White
Write-Host "Habilitada: $($task.Enabled)" -ForegroundColor White
Write-Host "Última ejecución: $($taskInfo.LastRunTime)" -ForegroundColor White
Write-Host "Próxima ejecución: $($taskInfo.NextRunTime)" -ForegroundColor White
Write-Host "Resultado último: $($taskInfo.LastTaskResult)" -ForegroundColor White
Write-Host "Ejecuciones perdidas: $($taskInfo.NumberOfMissedRuns)" -ForegroundColor White

Write-Host ""
Write-Host "VERIFICANDO PROCESOS ACTIVOS..." -ForegroundColor Yellow

# Verificar procesos relacionados
$processes = Get-Process | Where-Object {$_.ProcessName -eq "powershell" -or $_.ProcessName -eq "mysqldump" -or $_.ProcessName -eq "mysql"}

if ($processes) {
    Write-Host "✅ Procesos activos encontrados:" -ForegroundColor Green
    $processes | ForEach-Object {
        Write-Host "  - $($_.ProcessName) (PID: $($_.Id)) - CPU: $([math]::Round($_.CPU, 2))s" -ForegroundColor White
    }
} else {
    Write-Host "❌ No hay procesos activos relacionados" -ForegroundColor Red
}

Write-Host ""
Write-Host "VERIFICANDO LOGS RECIENTES..." -ForegroundColor Yellow

# Verificar logs recientes
$logs = Get-ChildItem $env:TEMP | Where-Object {$_.Name -like "*sync_log*" -and $_.LastWriteTime -gt (Get-Date).AddHours(-2)} | Sort-Object LastWriteTime -Descending

if ($logs) {
    Write-Host "✅ Logs recientes encontrados:" -ForegroundColor Green
    $logs | ForEach-Object {
        Write-Host "  - $($_.Name) - Última modificación: $($_.LastWriteTime)" -ForegroundColor White
    }
} else {
    Write-Host "❌ No hay logs recientes" -ForegroundColor Red
}

Write-Host ""
Write-Host "VERIFICANDO ARCHIVOS TEMPORALES..." -ForegroundColor Yellow

# Verificar archivos temporales de sincronización
$tempFiles = Get-ChildItem | Where-Object {$_.Name -like "*erp_dump*" -or $_.Name -like "*error*"} | Sort-Object LastWriteTime -Descending

if ($tempFiles) {
    Write-Host "✅ Archivos temporales encontrados:" -ForegroundColor Green
    $tempFiles | ForEach-Object {
        Write-Host "  - $($_.Name) - Tamaño: $([math]::Round($_.Length/1MB, 2)) MB - Última modificación: $($_.LastWriteTime)" -ForegroundColor White
    }
} else {
    Write-Host "❌ No hay archivos temporales de sincronización" -ForegroundColor Red
}

Write-Host ""
Write-Host "DIAGNÓSTICO:" -ForegroundColor Cyan

if ($taskInfo.LastRunTime -eq "30-11-1999 0:00:00") {
    Write-Host "❌ La tarea nunca se ha ejecutado" -ForegroundColor Red
    Write-Host "Posibles causas:" -ForegroundColor Yellow
    Write-Host "  - La PC no estaba encendida a las 02:00 AM" -ForegroundColor White
    Write-Host "  - La VPN no estaba conectada" -ForegroundColor White
    Write-Host "  - Problema con los permisos de la tarea" -ForegroundColor White
} else {
    Write-Host "✅ La tarea se ha ejecutado anteriormente" -ForegroundColor Green
}

Write-Host ""
Write-Host "RECOMENDACIONES:" -ForegroundColor Yellow
Write-Host "1. Verificar que la PC esté encendida a las 02:00 AM" -ForegroundColor White
Write-Host "2. Verificar que la VPN Sophos esté conectada" -ForegroundColor White
Write-Host "3. Probar ejecutar manualmente: powershell.exe -ExecutionPolicy Bypass -File 'sync_simple.ps1'" -ForegroundColor White

Write-Host ""
Read-Host "Presiona Enter para continuar" 