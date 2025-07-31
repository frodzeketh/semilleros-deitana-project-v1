# Configurador de Tarea Programada
# Ejecutar como Administrador

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    CONFIGURADOR SINCRONIZACION 2:00 AM" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar administrador
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin) {
    Write-Host "ERROR: Ejecutar como Administrador" -ForegroundColor Red
    Write-Host "1. Clic derecho en PowerShell" -ForegroundColor Yellow
    Write-Host "2. Ejecutar como administrador" -ForegroundColor Yellow
    Read-Host "Presiona Enter"
    exit 1
}

Write-Host "Configurando tarea programada..." -ForegroundColor Green

$taskName = "Sincronizacion ERP 2:00 AM"
$scriptPath = Join-Path (Get-Location) "sync_erp_railway.ps1"

# Eliminar tarea existente
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "Eliminando tarea existente..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

try {
    # Crear accion
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$scriptPath`""
    
    # Crear trigger diario a las 2:00 AM
    $trigger = New-ScheduledTaskTrigger -Daily -At "02:00"
    
    # Configurar principal y settings
    $principal = New-ScheduledTaskPrincipal -UserId (Get-CimInstance -ClassName Win32_ComputerSystem).UserName -LogonType Interactive -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable
    
    # Registrar tarea
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Sincronizacion automatica diaria de base de datos ERP a Railway a las 2:00 AM"
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "    TAREA PROGRAMADA CONFIGURADA" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "OK Tarea creada exitosamente" -ForegroundColor Green
    Write-Host "OK Se ejecutara diariamente a las 02:00 AM" -ForegroundColor Green
    Write-Host "OK Email: facuslice@gmail.com" -ForegroundColor Green
    Write-Host ""
    Write-Host "PROXIMOS PASOS:" -ForegroundColor Cyan
    Write-Host "1. PC encendida a las 02:00 AM" -ForegroundColor White
    Write-Host "2. VPN Sophos conectada" -ForegroundColor White
    Write-Host "3. Revisar logs en: %TEMP%\sync_log_YYYY-MM-DD.txt" -ForegroundColor White
    
} catch {
    Write-Host ""
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "CONFIGURACION MANUAL:" -ForegroundColor Yellow
    Write-Host "1. Abrir Programador de tareas" -ForegroundColor White
    Write-Host "2. Crear tarea: Sincronizacion ERP 2:00 AM" -ForegroundColor White
    Write-Host "3. Programar: Diariamente a las 02:00 AM" -ForegroundColor White
    Write-Host "4. Accion: powershell.exe -ExecutionPolicy Bypass -File sync_erp_railway.ps1" -ForegroundColor White
}

Write-Host ""
Read-Host "Presiona Enter para continuar" 