# Configurador de Tarea Programada para Sincronización Incremental
# Script para automatizar la sincronización incremental diaria

param(
    [switch]$Remove,
    [switch]$Test
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    CONFIGURADOR TAREA INCREMENTAL" -ForegroundColor Cyan
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
function Set-IncrementalScheduledTask {
    Write-Log "Configurando tarea programada para sincronización incremental..."
    
    # Verificar si se ejecuta como administrador
    if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
        Write-Log "⚠ Advertencia: No se ejecuta como administrador" "WARNING"
        Write-Log "La tarea programada debe configurarse manualmente" "WARNING"
        return $false
    }
    
    $taskName = "Sincronización Incremental ERP a Railway"
    $scriptPath = Join-Path (Get-Location) "sync_incremental.ps1"
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
        
        # Configurar para ejecutar a las 2:30 AM hora argentina (GMT-3)
        # En Windows, usar hora local, así que si estás en Argentina, usar 2:30 AM
        # Si estás en otra zona horaria, ajustar según corresponda
        $trigger = New-ScheduledTaskTrigger -Daily -At "02:30"
        
        $principal = New-ScheduledTaskPrincipal -UserId (Get-CimInstance -ClassName Win32_ComputerSystem).UserName -LogonType Interactive -RunLevel Highest
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable
        
        $task = Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Sincronización incremental automática de base de datos ERP a Railway"
        
        Write-Log "✓ Tarea programada creada exitosamente"
        Write-Log "✓ Se ejecutará diariamente a las 02:30 AM"
        return $true
        
    } catch {
        Write-Log "✗ Error al crear tarea programada: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# Función para eliminar tarea programada
function Remove-IncrementalScheduledTask {
    Write-Log "Eliminando tarea programada..."
    
    $taskName = "Sincronización Incremental ERP a Railway"
    
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

# Función para probar sincronización incremental
function Test-IncrementalSync {
    Write-Log "Probando sincronización incremental..."
    
    $scriptPath = Join-Path (Get-Location) "sync_incremental.ps1"
    
    if (-not (Test-Path $scriptPath)) {
        Write-Log "✗ No se encontró el script sync_incremental.ps1" "ERROR"
        return $false
    }
    
    try {
        Write-Log "Ejecutando prueba de sincronización incremental..."
        $result = & powershell.exe -ExecutionPolicy Bypass -File $scriptPath -Test
        
        if ($LASTEXITCODE -eq 0) {
            Write-Log "✓ Prueba de sincronización incremental exitosa"
            return $true
        } else {
            Write-Log "✗ Prueba de sincronización incremental falló" "ERROR"
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
        $success = Remove-IncrementalScheduledTask
        if ($success) {
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Green
            Write-Host "    TAREA ELIMINADA EXITOSAMENTE" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Green
        }
    } elseif ($Test) {
        $success = Test-IncrementalSync
        if ($success) {
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Green
            Write-Host "    PRUEBA EXITOSA" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Green
        }
    } else {
        $success = Set-IncrementalScheduledTask
        
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "    CONFIGURACIÓN COMPLETADA" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        
        if ($success) {
            Write-Host "✅ Tarea programada configurada" -ForegroundColor Green
            Write-Host "✅ Se ejecutará diariamente a las 02:30 AM" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Tarea programada NO configurada" -ForegroundColor Yellow
            Write-Host "   Configurar manualmente en Programador de tareas" -ForegroundColor Yellow
        }
        
        Write-Host ""
        Write-Host "📋 PRÓXIMOS PASOS:" -ForegroundColor Cyan
        Write-Host "1. Probar sincronización incremental:" -ForegroundColor White
        Write-Host "   powershell.exe -ExecutionPolicy Bypass -File 'sync_incremental.ps1' -Test" -ForegroundColor Gray
        Write-Host ""
        Write-Host "2. Instalar Percona Toolkit si es necesario:" -ForegroundColor White
        Write-Host "   powershell.exe -ExecutionPolicy Bypass -File 'sync_incremental.ps1' -InstallTools" -ForegroundColor Gray
        Write-Host ""
        Write-Host "3. Configurar PC para no hibernar durante la noche" -ForegroundColor White
        Write-Host ""
        Write-Host "📚 Documentación: README_SINCRONIZACION.md" -ForegroundColor Cyan
    }
    
} catch {
    Write-Log "Error inesperado: $($_.Exception.Message)" "ERROR"
    exit 1
} 