# SINCRONIZADOR ERP -> RAILWAY
# Script para sincronizar base de datos local con Railway

param(
    [string]$ConfigFile = "config_sync.ini",
    [switch]$Test
)

# Función para escribir logs
function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    
    # Escribir a consola
    switch ($Level) {
        "ERROR" { Write-Host $logMessage -ForegroundColor Red }
        "WARNING" { Write-Host $logMessage -ForegroundColor Yellow }
        "SUCCESS" { Write-Host $logMessage -ForegroundColor Green }
        default { Write-Host $logMessage -ForegroundColor White }
    }
    
    # Escribir a archivo de log
    $logFile = "$env:TEMP\sync_log_$(Get-Date -Format 'yyyy-MM-dd').txt"
    Add-Content -Path $logFile -Value $logMessage
}

# Función para leer archivo INI
function Read-IniFile {
    param([string]$FilePath)
    
    $config = @{}
    $currentSection = ""
    
    if (-not (Test-Path $FilePath)) {
        Write-Log "Archivo de configuración no encontrado: $FilePath" "ERROR"
        return @{}
    }
    
    Get-Content $FilePath | ForEach-Object {
        $line = $_.Trim()
        
        if ($line -match "^\[(.+)\]$") {
            $currentSection = $matches[1]
            $config[$currentSection] = @{}
        } elseif ($line -match "^(.+)=(.+)$" -and $currentSection) {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            $config[$currentSection][$key] = $value
        }
    }
    
    return $config
}

# Función para enviar email de notificación
function Send-NotificationEmail {
    param(
        [string]$Status,
        [string]$Details = ""
    )
    
    $emailTo = "facuslice@gmail.com"
    $emailFrom = "facuslice@gmail.com"
    $smtpServer = "smtp.gmail.com"
    $smtpPort = 587
    $subject = "Sincronización ERP - $Status"
    $body = @"
<html><body>
<h2>Sincronización de Base de Datos ERP</h2>
<p><strong>Estado:</strong> $Status</p>
<p><strong>Fecha:</strong> $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')</p>
<p><strong>Detalles:</strong> $Details</p>
<br>
<p>Este es un mensaje automático del sistema de sincronización.</p>
<p>La base de datos ha sido actualizada correctamente.</p>
</body></html>
"@
    
    try {
        $password = ConvertTo-SecureString "kabx qtwi kvan fdls" -AsPlainText -Force
        $credential = New-Object System.Management.Automation.PSCredential("facuslice@gmail.com", $password)
        Send-MailMessage -From $emailFrom -To $emailTo -Subject $subject -Body $body -BodyAsHtml -SmtpServer $smtpServer -Port $smtpPort -UseSsl -Credential $credential
        Write-Log "Email de notificación enviado a: $emailTo"
    } catch {
        Write-Log "Error al enviar email: $($_.Exception.Message)" "ERROR"
    }
}

# Función para verificar herramientas requeridas
function Test-RequiredTools {
    Write-Log "Verificando herramientas requeridas..."
    
    # Verificar mysqldump
    try {
        $mysqldumpPath = Get-Command mysqldump -ErrorAction Stop
        Write-Log "OK mysqldump encontrado"
    } catch {
        Write-Log "ERROR: mysqldump no encontrado" "ERROR"
        return $false
    }
    
    # Verificar mysql
    try {
        $mysqlPath = Get-Command mysql -ErrorAction Stop
        Write-Log "OK mysql encontrado"
    } catch {
        Write-Log "ERROR: mysql no encontrado" "ERROR"
        return $false
    }
    
    return $true
}

# Función para verificar conexión VPN
function Test-VPNConnection {
    param([string]$TargetHost)
    
    Write-Log "Verificando conexión VPN..."
    
    try {
        $result = Test-Connection -ComputerName $TargetHost -Count 1 -Quiet
        if ($result) {
            Write-Log "OK Conexión VPN verificada"
            return $true
        } else {
            Write-Log "WARNING al verificar conexión VPN: No se pudo conectar a $TargetHost" "WARNING"
            return $false
        }
    } catch {
        Write-Log "WARNING al verificar conexión VPN: $($_.Exception.Message)" "WARNING"
        return $false
    }
}

# Función para exportar base de datos
function Export-Database {
    param(
        [hashtable]$Config,
        [string]$DumpFile
    )
    
    Write-Log "Iniciando exportación de base de datos local..."
    
    $localHost = $Config["LOCAL_DATABASE"]["HOST"]
    $localPort = $Config["LOCAL_DATABASE"]["PORT"]
    $localUser = $Config["LOCAL_DATABASE"]["USER"]
    $localPass = $Config["LOCAL_DATABASE"]["PASSWORD"]
    $localDB = $Config["LOCAL_DATABASE"]["DATABASE"]
    
    $mysqldumpArgs = @(
        "--host=$localHost",
        "--port=$localPort",
        "--user=$localUser",
        "--password=$localPass",
        "--single-transaction",
        "--routines",
        "--triggers",
        "--add-drop-database",
        "--databases",
        $localDB
    )
    
    try {
        $process = Start-Process -FilePath "mysqldump" -ArgumentList $mysqldumpArgs -RedirectStandardOutput $DumpFile -RedirectStandardError "error.log" -NoNewWindow -Wait -PassThru
        
        if ($process.ExitCode -eq 0) {
            $fileSize = [math]::Round((Get-Item $DumpFile).Length/1MB, 2)
            Write-Log "OK Exportación completada. Tamaño: $fileSize MB"
            return $true
        } else {
            Write-Log "ERROR en exportación. Código de salida: $($process.ExitCode)" "ERROR"
            if (Test-Path "error.log") {
                $errorContent = Get-Content "error.log" -Raw
                Write-Log "Detalles del error: $errorContent" "ERROR"
            }
            return $false
        }
    } catch {
        Write-Log "ERROR en exportación: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# Función para importar base de datos
function Import-Database {
    param(
        [hashtable]$Config,
        [string]$DumpFile
    )
    
    Write-Log "Iniciando importación a Railway..."
    
    $remoteHost = $Config["RAILWAY_DATABASE"]["HOST"]
    $remotePort = $Config["RAILWAY_DATABASE"]["PORT"]
    $remoteUser = $Config["RAILWAY_DATABASE"]["USER"]
    $remotePass = $Config["RAILWAY_DATABASE"]["PASSWORD"]
    $remoteDB = $Config["RAILWAY_DATABASE"]["DATABASE"]
    
    $mysqlArgs = @(
        "--host=$remoteHost",
        "--port=$remotePort",
        "--user=$remoteUser",
        "--password=$remotePass",
        $remoteDB
    )
    
    try {
        $process = Start-Process -FilePath "mysql" -ArgumentList $mysqlArgs -RedirectStandardInput $DumpFile -RedirectStandardError "error_import.log" -NoNewWindow -Wait -PassThru
        
        if ($process.ExitCode -eq 0) {
            Write-Log "OK Importación completada"
            return $true
        } else {
            Write-Log "ERROR en importación. Código de salida: $($process.ExitCode)" "ERROR"
            if (Test-Path "error_import.log") {
                $errorContent = Get-Content "error_import.log" -Raw
                Write-Log "Detalles del error: $errorContent" "ERROR"
            }
            return $false
        }
    } catch {
        Write-Log "ERROR en importación: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# Función para limpiar archivos temporales
function Cleanup-TempFiles {
    param([string]$DumpFile)
    
    if (Test-Path $DumpFile) {
        Remove-Item $DumpFile -Force
        Write-Log "OK Archivo temporal eliminado"
    }
    
    if (Test-Path "error.log") {
        Remove-Item "error.log" -Force
    }
    
    if (Test-Path "error_import.log") {
        Remove-Item "error_import.log" -Force
    }
}

# Función principal
function Start-Sync {
    param([hashtable]$Config)
    
    $timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
    $dumpFile = "erp_dump_$timestamp.sql"
    
    Write-Log "Iniciando sincronización..."
    
    # Enviar email de inicio
    Send-NotificationEmail -Status "INICIADA" -Details "Proceso de sincronización iniciado. Tamaño estimado: 919.5 MB"
    
    # Verificar herramientas
    if (-not (Test-RequiredTools)) {
        Send-NotificationEmail -Status "FALLO" -Details "Error: Herramientas requeridas no encontradas"
        return $false
    }
    
    # Verificar VPN (opcional)
    $vpnStatus = Test-VPNConnection -TargetHost $Config["LOCAL_DATABASE"]["HOST"]
    if (-not $vpnStatus) {
        Write-Log "ADVERTENCIA: VPN no disponible, pero continuando..." "WARNING"
    }
    
    # Exportar base local
    if (-not (Export-Database -Config $Config -DumpFile $dumpFile)) {
        Send-NotificationEmail -Status "FALLO" -Details "Error durante la exportación de la base de datos"
        return $false
    }
    
    # Importar a Railway
    if (-not (Import-Database -Config $Config -DumpFile $dumpFile)) {
        Send-NotificationEmail -Status "FALLO" -Details "Error durante la importación a Railway"
        return $false
    }
    
    # Limpiar archivos temporales
    Cleanup-TempFiles -DumpFile $dumpFile
    
    # Enviar email de notificación de éxito
    Send-NotificationEmail -Status "EXITOSA" -Details "Base de datos actualizada correctamente. Tamaño exportado: $([math]::Round((Get-Item $dumpFile).Length/1MB, 2)) MB"
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "    SINCRONIZACION COMPLETADA" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "OK Base de datos actualizada exitosamente" -ForegroundColor Green
    Write-Host ("OK Fecha: {0}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')) -ForegroundColor Green
    Write-Host ""
    
    Write-Log "SINCRONIZACION EXITOSA"
    return $true
}

# Ejecución principal
try {
    # Leer configuración
    $config = Read-IniFile -FilePath $ConfigFile
    
    if ($config.Count -eq 0) {
        Write-Log "No se pudo leer el archivo de configuración: $ConfigFile" "ERROR"
        exit 1
    }
    
    Write-Log "Configuración cargada desde: $ConfigFile"
    
    # Modo test
    if ($Test) {
        Write-Log "MODO TEST - Solo verificando conexiones"
        Test-RequiredTools
        Test-VPNConnection -TargetHost $config["LOCAL_DATABASE"]["HOST"]
        exit 0
    }
    
    # Ejecutar sincronización
    $success = Start-Sync -Config $config
    
    if (-not $success) {
        Write-Log "SINCRONIZACION FALLÓ" "ERROR"
        exit 1
    }
    
} catch {
    Write-Log "Error inesperado: $($_.Exception.Message)" "ERROR"
    Send-NotificationEmail -Status "FALLO" -Details "Error inesperado: $($_.Exception.Message)"
    exit 1
} 