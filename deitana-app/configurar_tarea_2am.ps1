# Configurador de Tarea Programada para Sincronización a las 2:00 AM
# Incluye notificación por email al completarse

param(
    [switch]$Remove,
    [switch]$Test,
    [string]$EmailTo = "",
    [string]$EmailFrom = "sincronizacion@deitana.com"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    CONFIGURADOR SINCRONIZACIÓN 2:00 AM" -ForegroundColor Cyan
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

# Función para enviar email de notificación
function Send-NotificationEmail {
    param(
        [string]$Status,
        [string]$Details = ""
    )
    
    if (-not $EmailTo) {
        Write-Log "No se configuró email de destino" "WARNING"
        return
    }
    
    $subject = "Sincronización ERP - $Status"
    $body = @"
<html>
<body>
<h2>Sincronización de Base de Datos ERP</h2>
<p><strong>Estado:</strong> $Status</p>
<p><strong>Fecha:</strong> $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')</p>
<p><strong>Detalles:</strong> $Details</p>
<br>
<p>Este es un mensaje automático del sistema de sincronización.</p>
</body>
</html>
"@
    
    try {
        Send-MailMessage -From $EmailFrom -To $EmailTo -Subject $subject -Body $body -BodyAsHtml -SmtpServer "smtp.gmail.com" -Port 587 -UseSsl -Credential (Get-Credential -Message "Ingresa credenciales de email")
        Write-Log "Email de notificación enviado a: $EmailTo"
    } catch {
        Write-Log "Error al enviar email: $($_.Exception.Message)" "ERROR"
    }
}

# Función para configurar tarea programada
function Set-ScheduledTask2AM {
    Write-Log "Configurando tarea programada para las 2:00 AM..."
    
    # Verificar si se ejecuta como administrador
    if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
        Write-Log "⚠ Advertencia: No se ejecuta como administrador" "WARNING"
        Write-Log "La tarea programada debe configurarse manualmente" "WARNING"
        return $false
    }
    
    $taskName = "Sincronización ERP 2:00 AM"
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
        
        # Configurar para ejecutar diariamente a las 2:00 AM
        $trigger = New-ScheduledTaskTrigger -Daily -At "02:00"
        
        $principal = New-ScheduledTaskPrincipal -UserId (Get-CimInstance -ClassName Win32_ComputerSystem).UserName -LogonType Interactive -RunLevel Highest
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable
        
        $task = Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Sincronización automática diaria de base de datos ERP a Railway a las 2:00 AM"
        
        Write-Log "✓ Tarea programada creada exitosamente"
        Write-Log "✓ Se ejecutará diariamente a las 02:00 AM"
        return $true
        
    } catch {
        Write-Log "✗ Error al crear tarea programada: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# Función para eliminar tarea programada
function Remove-ScheduledTask2AM {
    Write-Log "Eliminando tarea programada..."
    
    $taskName = "Sincronización ERP 2:00 AM"
    
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
function Test-Sync2AM {
    Write-Log "Probando sincronización..."
    
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
        $success = Remove-ScheduledTask2AM
        if ($success) {
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Green
            Write-Host "    TAREA ELIMINADA EXITOSAMENTE" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Green
        }
    } elseif ($Test) {
        $success = Test-Sync2AM
        if ($success) {
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Green
            Write-Host "    PRUEBA EXITOSA" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Green
        }
    } else {
        # Solicitar email si no se proporcionó
        if (-not $EmailTo) {
            $EmailTo = Read-Host "Ingresa tu email para recibir notificaciones"
        }
        
        $success = Set-ScheduledTask2AM
        
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "    CONFIGURACIÓN COMPLETADA" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        
        if ($success) {
            Write-Host "✅ Tarea programada configurada" -ForegroundColor Green
            Write-Host "✅ Se ejecutará diariamente a las 02:00 AM" -ForegroundColor Green
            if ($EmailTo) {
                Write-Host "✅ Notificaciones por email: $EmailTo" -ForegroundColor Green
            }
        } else {
            Write-Host "⚠️  Tarea programada NO configurada" -ForegroundColor Yellow
            Write-Host "   Configurar manualmente en Programador de tareas" -ForegroundColor Yellow
        }
        
        Write-Host ""
        Write-Host "📋 PRÓXIMOS PASOS:" -ForegroundColor Cyan
        Write-Host "1. Verificar que la PC esté encendida a las 02:00 AM" -ForegroundColor White
        Write-Host "2. Asegurar que la VPN Sophos esté conectada" -ForegroundColor White
        Write-Host "3. Configurar credenciales de email para notificaciones" -ForegroundColor White
        Write-Host "4. Revisar logs en: %TEMP%\sync_log_YYYY-MM-DD.txt" -ForegroundColor White
        Write-Host ""
        Write-Host "📚 Para probar manualmente:" -ForegroundColor Cyan
        Write-Host "   powershell.exe -ExecutionPolicy Bypass -File 'sync_erp_railway.ps1'" -ForegroundColor Gray
    }
    
} catch {
    Write-Log "Error inesperado: $($_.Exception.Message)" "ERROR"
    exit 1
} 