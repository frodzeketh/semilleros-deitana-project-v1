# Sincronizador ERP -> Railway
# Script de PowerShell para automatizar la sincronización de bases de datos

param(
    [string]$ConfigFile = "config_sync.ini",
    [switch]$Test,
    [switch]$Verbose
)

# Configuración de codificación
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    SINCRONIZADOR ERP -> RAILWAY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Función para leer configuración INI
function Read-IniFile {
    param([string]$FilePath)
    
    $config = @{}
    $currentSection = ""
    
    if (Test-Path $FilePath) {
        Get-Content $FilePath | ForEach-Object {
            $line = $_.Trim()
            if ($line -and -not $line.StartsWith("#")) {
                if ($line.StartsWith("[") -and $line.EndsWith("]")) {
                    $currentSection = $line.Substring(1, $line.Length - 2)
                    $config[$currentSection] = @{}
                } elseif ($line.Contains("=") -and $currentSection) {
                    $key, $value = $line.Split("=", 2)
                    $key = $key.Trim().ToLower() # Forzar minúsculas
                    $config[$currentSection][$key] = $value.Trim()
                }
            }
        }
    }
    
    return $config
}

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
    
    # Guardar el log SOLO en la carpeta temporal del sistema
    $logFile = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "sync_log_$(Get-Date -Format 'yyyy-MM-dd').txt")
    Add-Content -Path $logFile -Value $logMessage
}

# Función para verificar herramientas
function Test-RequiredTools {
    Write-Log "Verificando herramientas requeridas..."
    
    $tools = @("mysqldump", "mysql")
    $missing = @()
    
    foreach ($tool in $tools) {
        try {
            $null = Get-Command $tool -ErrorAction Stop
            Write-Log "OK $tool encontrado"
        } catch {
            $missing += $tool
            Write-Log "ERROR $tool no encontrado" "ERROR"
        }
    }
    
    if ($missing.Count -gt 0) {
        Write-Log "Herramientas faltantes: $($missing -join ', ')" "ERROR"
        Write-Log "Instalar MySQL Client o agregar al PATH" "ERROR"
        return $false
    }
    
    return $true
}

# Función para verificar conexión VPN
function Test-VPNConnection {
    param([string]$TargetHost)
    
    Write-Log "Verificando conexión VPN..."
    
    try {
        $ping = Test-Connection -ComputerName $TargetHost -Count 1 -Quiet
        if ($ping) {
            Write-Log "OK Conexión VPN verificada"
            return $true
        } else {
            Write-Log "ERROR No se puede conectar al servidor local" "ERROR"
            Write-Log "Verificar que la VPN Sophos esté conectada" "ERROR"
            return $false
        }
    } catch {
        Write-Log "ERROR al verificar conexión VPN" "ERROR"
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
    
    $local = $Config["LOCAL_DATABASE"]
    Write-Host "[DEBUG] LOCAL_DATABASE config:"
    foreach ($key in $local.Keys) {
        Write-Host ("[DEBUG] {0} = '{1}'" -f $key, $local[$key])
    }
    $args = @(
        "-h", $local["db_host"],
        "-P", $local["port"],
        "-u", $local["user"],
        "-p$($local['password'])",
        $local["database"],
        "--single-transaction",
        "--routines",
        "--triggers",
        "--add-drop-database",
        "--create-options"
    )
    
    try {
        $process = Start-Process -FilePath "mysqldump" -ArgumentList $args -RedirectStandardOutput $DumpFile -RedirectStandardError "error.log" -NoNewWindow -Wait -PassThru
        
        if ($process.ExitCode -eq 0) {
            $size = (Get-Item $DumpFile).Length
            Write-Log ("OK Exportación completada: {0} ({1} MB)" -f $DumpFile, [math]::Round($size/1MB, 2))
            return $true
        } else {
            $error = Get-Content "error.log" -ErrorAction SilentlyContinue
            Write-Log "ERROR en exportación: $error" "ERROR"
            return $false
        }
    } catch {
        Write-Log "ERROR al ejecutar mysqldump" "ERROR"
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
    
    $remote = $Config["RAILWAY_DATABASE"]
    Write-Host "[DEBUG] RAILWAY_DATABASE config:"
    foreach ($key in $remote.Keys) {
        Write-Host ("[DEBUG] {0} = '{1}'" -f $key, $remote[$key])
    }
    $args = @(
        "-h", $remote["db_host"],
        "-P", $remote["port"],
        "-u", $remote["user"],
        "-p$($remote['password'])",
        $remote["database"]
    )
    
    try {
        $process = Start-Process -FilePath "mysql" -ArgumentList $args -RedirectStandardInput $DumpFile -RedirectStandardError "error_import.log" -NoNewWindow -Wait -PassThru
        
        if ($process.ExitCode -eq 0) {
            Write-Log "OK Importación a Railway completada"
            return $true
        } else {
            $error = Get-Content "error_import.log" -ErrorAction SilentlyContinue
            Write-Log "ERROR en importación: $error" "ERROR"
            return $false
        }
    } catch {
        Write-Log "ERROR al ejecutar mysql" "ERROR"
        return $false
    }
}

# Función para limpiar archivos temporales
function Cleanup-TempFiles {
    param([string]$DumpFile)
    
    Write-Log "Limpiando archivos temporales..."
    
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
    
    # Verificar herramientas
    if (-not (Test-RequiredTools)) {
        return $false
    }
    
    # Verificar VPN
    if (-not (Test-VPNConnection -TargetHost $Config["LOCAL_DATABASE"]["db_host"])) {
        return $false
    }
    
    # Exportar base local
    if (-not (Export-Database -Config $Config -DumpFile $dumpFile)) {
        return $false
    }
    
    # Importar a Railway
    if (-not (Import-Database -Config $Config -DumpFile $dumpFile)) {
        return $false
    }
    
    # Limpiar archivos temporales
    Cleanup-TempFiles -DumpFile $dumpFile
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "    SINCRONIZACIÓN COMPLETADA" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "OK Base de datos actualizada exitosamente" -ForegroundColor Green
    Write-Host ("OK Fecha: {0}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')) -ForegroundColor Green
    Write-Host ""
    
    Write-Log "SINCRONIZACIÓN EXITOSA"
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
        Test-VPNConnection -TargetHost $config["LOCAL_DATABASE"]["db_host"]
        exit 0
    }
    
    # Ejecutar sincronización
    $success = Start-Sync -Config $config
    
    if (-not $success) {
        Write-Log "SINCRONIZACIÓN FALLÓ" "ERROR"
        exit 1
    }
    
} catch {
    Write-Log "Error inesperado: $($_.Exception.Message)" "ERROR"
    exit 1
} 