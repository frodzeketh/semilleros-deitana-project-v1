# Configurador Manual Simple
# Ejecutar como Administrador

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    CONFIGURADOR MANUAL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar administrador
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin) {
    Write-Host "ERROR: Necesitas ejecutar como Administrador" -ForegroundColor Red
    Write-Host ""
    Write-Host "COMO HACERLO:" -ForegroundColor Yellow
    Write-Host "1. Presiona Windows + R" -ForegroundColor White
    Write-Host "2. Escribe: powershell" -ForegroundColor White
    Write-Host "3. Presiona Ctrl + Shift + Enter" -ForegroundColor White
    Write-Host "4. Confirma con 'Si'" -ForegroundColor White
    Write-Host "5. Ejecuta este script de nuevo" -ForegroundColor White
    Read-Host "Presiona Enter"
    exit 1
}

Write-Host "Configurando tarea programada..." -ForegroundColor Green

$taskName = "Sincronizacion ERP 2:00 AM"
$scriptPath = Join-Path (Get-Location) "sync_simple.ps1"

# Eliminar tarea existente si existe
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "Eliminando tarea existente..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Crear tarea programada de forma manual
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -Daily -At "02:00"
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

try {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Sincronizacion automatica diaria de base de datos ERP a Railway a las 2:00 AM"
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "    CONFIGURACION COMPLETADA!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "OK Tarea programada creada" -ForegroundColor Green
    Write-Host "OK Se ejecutara diariamente a las 02:00 AM" -ForegroundColor Green
    Write-Host "OK Email configurado: facuslice@gmail.com" -ForegroundColor Green
    Write-Host "OK Base de datos se sincronizara automaticamente" -ForegroundColor Green
    Write-Host ""
    Write-Host "REQUISITOS:" -ForegroundColor Cyan
    Write-Host "PC encendida a las 02:00 AM" -ForegroundColor White
    Write-Host "VPN Sophos conectada" -ForegroundColor White
    Write-Host ""
    Write-Host "LISTO! Ya no necesitas hacer nada mas." -ForegroundColor Green
    
} catch {
    Write-Host ""
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "CONFIGURACION MANUAL:" -ForegroundColor Yellow
    Write-Host "1. Abrir 'Programador de tareas'" -ForegroundColor White
    Write-Host "2. Crear tarea: 'Sincronizacion ERP 2:00 AM'" -ForegroundColor White
    Write-Host "3. Programar: Diariamente a las 02:00 AM" -ForegroundColor White
    Write-Host "4. Accion: powershell.exe -ExecutionPolicy Bypass -File sync_simple.ps1" -ForegroundColor White
}

Write-Host ""
Read-Host "Presiona Enter para continuar" 