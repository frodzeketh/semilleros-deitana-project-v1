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
                    $config[$currentSection][$key.Trim()] = $value.Trim()
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
    
    $logFile = "sync_log_$(Get-Date -Format 'yyyy-MM-dd').txt"
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
            Write-Log "✓ $tool encontrado"
        } catch {
            $missing += $tool
            Write-Log "✗ $tool no encontrado" "ERROR"
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
    param([string]$Host)
    
    Write-Log "Verificando conexión VPN..."
    
    try {
        $ping = Test-Connection -ComputerName $Host -Count 1 -Quiet
        if ($ping) {
            Write-Log "✓ Conexión VPN verificada"
            return $true
        } else {
            Write-Log "✗ No se puede conectar al servidor local" "ERROR"
            Write-Log "Verificar que la VPN Sophos esté conectada" "ERROR"
            return $false
        }
    } catch {
        Write-Log "✗ Error al verificar conexión VPN" "ERROR"
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
    $args = @(
        "-h", $local["HOST"],
        "-P", $local["PORT"],
        "-u", $local["USER"],
        "-p$($local['PASSWORD'])",
        $local["DATABASE"],
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
            Write-Log "✓ Exportación completada: $DumpFile ($([math]::Round($size/1MB, 2)) MB)"
            return $true
        } else {
            $error = Get-Content "error.log" -ErrorAction SilentlyContinue
            Write-Log "✗ Error en exportación: $error" "ERROR"
            return $false
        }
    } catch {
        Write-Log "✗ Error al ejecutar mysqldump" "ERROR"
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
    $args = @(
        "-h", $remote["HOST"],
        "-P", $remote["PORT"],
        "-u", $remote["USER"],
        "-p$($remote['PASSWORD'])",
        $remote["DATABASE"]
    )
    
    try {
        $dumpContent = Get-Content $DumpFile -Raw
        $process = Start-Process -FilePath "mysql" -ArgumentList $args -RedirectStandardInput $DumpFile -RedirectStandardError "error_import.log" -NoNewWindow -Wait -PassThru
        
        if ($process.ExitCode -eq 0) {
            Write-Log "✓ Importación a Railway completada"
            return $true
        } else {
            $error = Get-Content "error_import.log" -ErrorAction SilentlyContinue
            Write-Log "✗ Error en importación: $error" "ERROR"
            return $false
        }
    } catch {
        Write-Log "✗ Error al ejecutar mysql" "ERROR"
        return $false
    }
}

# Función para limpiar archivos temporales
function Cleanup-TempFiles {
    param([string]$DumpFile)
    
    Write-Log "Limpiando archivos temporales..."
    
    if (Test-Path $DumpFile) {
        Remove-Item $DumpFile -Force
        Write-Log "✓ Archivo temporal eliminado"
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
    if (-not (Test-VPNConnection -Host $Config["LOCAL_DATABASE"]["HOST"])) {
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
    Write-Host "✓ Base de datos actualizada exitosamente" -ForegroundColor Green
    Write-Host "✓ Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Green
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
        Test-VPNConnection -Host $config["LOCAL_DATABASE"]["HOST"]
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