# Configurar tarea programada simple
Write-Host "Configurando tarea programada..." -ForegroundColor Cyan

# Verificar si se ejecuta como administrador
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "ERROR: Este script debe ejecutarse como Administrador" -ForegroundColor Red
    Write-Host "Haz clic derecho en PowerShell y selecciona 'Ejecutar como administrador'" -ForegroundColor Yellow
    Read-Host "Presiona Enter para continuar"
    exit 1
}

$taskName = "Sincronizar ERP a Railway"
$scriptPath = Join-Path (Get-Location) "sync_erp_railway.ps1"
$configPath = Join-Path (Get-Location) "config_sync.ini"

Write-Host "Script: $scriptPath" -ForegroundColor White
Write-Host "Config: $configPath" -ForegroundColor White

# Eliminar tarea existente si existe
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "Eliminando tarea existente..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Crear nueva tarea
try {
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$scriptPath`" -ConfigFile `"$configPath`""
    $trigger = New-ScheduledTaskTrigger -Daily -At "03:30"
    $principal = New-ScheduledTaskPrincipal -UserId (Get-CimInstance -ClassName Win32_ComputerSystem).UserName -LogonType Interactive -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable
    
    $task = Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Sincronizacion automatica de base de datos ERP a Railway"
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "    TAREA PROGRAMADA CREADA" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "OK Nombre: $taskName" -ForegroundColor Green
    Write-Host "OK Ejecucion: Diaria a las 03:30" -ForegroundColor Green
    Write-Host "OK Script: $scriptPath" -ForegroundColor Green
    Write-Host "OK Configuracion: $configPath" -ForegroundColor Green
    Write-Host ""
    Write-Host "Para verificar la tarea:" -ForegroundColor Cyan
    Write-Host "1. Abrir 'Programador de tareas' (taskschd.msc)" -ForegroundColor White
    Write-Host "2. Buscar '$taskName' en la biblioteca" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host "ERROR al crear la tarea programada: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "RECORDATORIOS IMPORTANTES:" -ForegroundColor Yellow
Write-Host "1. Asegurate de que tu PC este encendida a las 03:30" -ForegroundColor White
Write-Host "2. Verifica que la VPN Sophos este conectada" -ForegroundColor White
Write-Host "3. Revisa los logs en sync_log_YYYY-MM-DD.txt" -ForegroundColor White
Write-Host ""

Read-Host "Presiona Enter para continuar" 