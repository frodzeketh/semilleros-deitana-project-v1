# Configurador de Tarea Programada para Sincronización ERP -> Railway
# Este script configura automáticamente una tarea programada en Windows

param(
    [string]$TaskName = "Sincronizar ERP a Railway",
    [string]$ScriptPath = "sync_erp_railway.ps1",
    [string]$ConfigPath = "config_sync.ini",
    [string]$StartTime = "03:30",
    [switch]$Force
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    CONFIGURADOR DE TAREA PROGRAMADA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar si se ejecuta como administrador
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "ERROR: Este script debe ejecutarse como Administrador" -ForegroundColor Red
    Write-Host "Haz clic derecho en PowerShell y selecciona 'Ejecutar como administrador'" -ForegroundColor Yellow
    exit 1
}

# Obtener ruta completa del script
$scriptFullPath = Join-Path (Get-Location) $ScriptPath
$configFullPath = Join-Path (Get-Location) $ConfigPath

# Verificar que los archivos existan
if (-not (Test-Path $scriptFullPath)) {
    Write-Host "ERROR: No se encontró el script: $scriptFullPath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $configFullPath)) {
    Write-Host "ERROR: No se encontró el archivo de configuración: $configFullPath" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Script encontrado: $scriptFullPath" -ForegroundColor Green
Write-Host "✓ Configuración encontrada: $configFullPath" -ForegroundColor Green

# Verificar si la tarea ya existe
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($existingTask -and -not $Force) {
    Write-Host "La tarea '$TaskName' ya existe." -ForegroundColor Yellow
    $response = Read-Host "¿Deseas sobrescribirla? (s/N)"
    if ($response -ne "s" -and $response -ne "S") {
        Write-Host "Operación cancelada." -ForegroundColor Yellow
        exit 0
    }
}

# Eliminar tarea existente si existe
if ($existingTask) {
    Write-Host "Eliminando tarea existente..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Crear acción para ejecutar PowerShell
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$scriptFullPath`" -ConfigFile `"$configFullPath`""

# Crear trigger diario
$trigger = New-ScheduledTaskTrigger -Daily -At $StartTime

# Configurar el usuario actual
$principal = New-ScheduledTaskPrincipal -UserId (Get-CimInstance -ClassName Win32_ComputerSystem).UserName -LogonType Interactive -RunLevel Highest

# Configurar configuración de la tarea
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable

# Crear la tarea
try {
    $task = Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Sincronización automática de base de datos ERP a Railway"
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "    TAREA PROGRAMADA CREADA" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✓ Nombre: $TaskName" -ForegroundColor Green
    Write-Host "✓ Ejecución: Diaria a las $StartTime" -ForegroundColor Green
    Write-Host "✓ Script: $scriptFullPath" -ForegroundColor Green
    Write-Host "✓ Configuración: $configFullPath" -ForegroundColor Green
    Write-Host ""
    Write-Host "Para verificar la tarea:" -ForegroundColor Cyan
    Write-Host "1. Abrir 'Programador de tareas' (taskschd.msc)" -ForegroundColor White
    Write-Host "2. Buscar '$TaskName' en la biblioteca" -ForegroundColor White
    Write-Host ""
    Write-Host "Para probar manualmente:" -ForegroundColor Cyan
    Write-Host "powershell.exe -ExecutionPolicy Bypass -File `"$scriptFullPath`" -Test" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host "ERROR al crear la tarea programada: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Crear script de prueba rápida
$testScript = @"
# Script de prueba rápida para sincronización
Write-Host "Probando sincronización ERP -> Railway..." -ForegroundColor Cyan
powershell.exe -ExecutionPolicy Bypass -File "$scriptFullPath" -Test
Write-Host "Presiona cualquier tecla para continuar..."
`$null = `$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
"@

$testScript | Out-File -FilePath "probar_sincronizacion.ps1" -Encoding UTF8

Write-Host "✓ Script de prueba creado: probar_sincronizacion.ps1" -ForegroundColor Green
Write-Host ""
Write-Host "RECORDATORIOS IMPORTANTES:" -ForegroundColor Yellow
Write-Host "1. Asegúrate de que tu PC esté encendida a las $StartTime" -ForegroundColor White
Write-Host "2. Verifica que la VPN Sophos esté conectada" -ForegroundColor White
Write-Host "3. Revisa los logs en sync_log_YYYY-MM-DD.txt" -ForegroundColor White
Write-Host "4. Modifica config_sync.ini si cambias las credenciales" -ForegroundColor White 