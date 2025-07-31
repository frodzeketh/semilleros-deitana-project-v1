# Configurador Automático de Tarea Programada
# Este script configura la sincronización automática sin intervención manual

param(
    [switch]$Remove,
    [switch]$Test
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    CONFIGURADOR AUTOMÁTICO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Función para escribir log
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    
    if ($Level -eq "ERROR") {
        Write-Host $logMessage -ForegroundColor Red
    } elseif ($Level -eq "WARNING") {
        Write-Host $logMessage -ForegroundColor Yellow
    } else {
        Write-Host $logMessage -ForegroundColor Green
    }
}

# Función para configurar tarea programada
function Set-AutomaticScheduledTask {
    Write-Log "Configurando tarea programada automática..."
    
    # Verificar si se ejecuta como administrador
    if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
        Write-Log "⚠ Advertencia: No se ejecuta como administrador" "WARNING"
        Write-Log "La tarea programada debe configurarse manualmente" "WARNING"
        return $false
    }
    
    $taskName = "Sincronización Automática ERP a Railway"
    $scriptPath = Join-Path (Get-Location) "sync_erp_railway.ps1"
    $configPath = Join-Path (Get-Location) "config_sync.ini"
    
    # Eliminar tarea existente si existe
    $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Write-Log "Eliminando tarea existente..."
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    }
    
    # Crear nueva tarea
    try {
        $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$scriptPath`" -ConfigFile `"$configPath`""
        
        # Configurar para ejecutar diariamente a las 03:00 AM
        $trigger = New-ScheduledTaskTrigger -Daily -At "03:00"
        
        $principal = New-ScheduledTaskPrincipal -UserId (Get-CimInstance -ClassName Win32_ComputerSystem).UserName -LogonType Interactive -RunLevel Highest
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable
        
        $task = Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Sincronización automática diaria de base de datos ERP a Railway"
        
        Write-Log "✓ Tarea programada creada exitosamente"
        Write-Log "✓ Se ejecutará diariamente a las 03:00 AM"
        return $true
        
    } catch {
        Write-Log "✗ Error al crear tarea programada: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# Función para eliminar tarea programada
function Remove-AutomaticScheduledTask {
    Write-Log "Eliminando tarea programada..."
    
    $taskName = "Sincronización Automática ERP a Railway"
    
    try {
        $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        if ($existingTask) {
            Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
            Write-Log "✓ Tarea programada eliminada"
            return $true
        } else {
            Write-Log "⚠ No se encontró la tarea programada" "WARNING"
            return $false
        }
    } catch {
        Write-Log "✗ Error al eliminar tarea programada: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# Función para probar sincronización
function Test-AutomaticSync {
    Write-Log "Probando sincronización automática..."
    
    $scriptPath = Join-Path (Get-Location) "sync_erp_railway.ps1"
    
    if (-not (Test-Path $scriptPath)) {
        Write-Log "✗ No se encontró el script sync_erp_railway.ps1" "ERROR"
        return $false
    }
    
    try {
        Write-Log "Ejecutando prueba de sincronización..."
        $result = & powershell.exe -ExecutionPolicy Bypass -File $scriptPath -Test
        
        if ($LASTEXITCODE -eq 0) {
            Write-Log "✓ Prueba de sincronización exitosa"
            return $true
        } else {
            Write-Log "✗ Prueba de sincronización falló" "ERROR"
            return $false
        }
    } catch {
        Write-Log "✗ Error al ejecutar prueba: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# Ejecución principal
try {
    if ($Remove) {
        $success = Remove-AutomaticScheduledTask
        if ($success) {
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Green
            Write-Host "    TAREA ELIMINADA EXITOSAMENTE" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Green
        }
    } elseif ($Test) {
        $success = Test-AutomaticSync
        if ($success) {
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Green
            Write-Host "    PRUEBA EXITOSA" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Green
        }
    } else {
        $success = Set-AutomaticScheduledTask
        
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "    CONFIGURACIÓN COMPLETADA" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        
        if ($success) {
            Write-Host "✅ Tarea programada configurada" -ForegroundColor Green
            Write-Host "✅ Se ejecutará diariamente a las 03:00 AM" -ForegroundColor Green
            Write-Host "✅ Sincronización automática activada" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Tarea programada NO configurada" -ForegroundColor Yellow
            Write-Host "   Configurar manualmente en Programador de tareas" -ForegroundColor Yellow
        }
        
        Write-Host ""
        Write-Host "📋 PRÓXIMOS PASOS:" -ForegroundColor Cyan
        Write-Host "1. Verificar que la PC esté encendida a las 03:00 AM" -ForegroundColor White
        Write-Host "2. Asegurar que la VPN Sophos esté conectada" -ForegroundColor White
        Write-Host "3. Revisar logs en: %TEMP%\sync_log_YYYY-MM-DD.txt" -ForegroundColor White
        Write-Host ""
        Write-Host "📚 Para probar manualmente:" -ForegroundColor Cyan
        Write-Host "   powershell.exe -ExecutionPolicy Bypass -File 'sync_erp_railway.ps1'" -ForegroundColor Gray
    }
    
} catch {
    Write-Log "Error inesperado: $($_.Exception.Message)" "ERROR"
    exit 1
} 