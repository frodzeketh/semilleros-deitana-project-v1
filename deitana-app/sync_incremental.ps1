# Sincronizador Incremental ERP -> Railway
# Script de PowerShell para sincronización incremental usando Percona Toolkit

param(
    [string]$ConfigFile = "config_sync.ini",
    [switch]$Test,
    [switch]$Verbose,
    [switch]$InstallTools
)

# Configuración de codificación
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    SINCRONIZADOR INCREMENTAL ERP -> RAILWAY" -ForegroundColor Cyan
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
                    $key = $key.Trim() # Mantener mayúsculas/minúsculas originales
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
    
    # Guardar el log en la carpeta temporal del sistema
    $logFile = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "sync_incremental_log_$(Get-Date -Format 'yyyy-MM-dd').txt")
    Add-Content -Path $logFile -Value $logMessage
}

# Función para verificar herramientas
function Test-RequiredTools {
    Write-Log "Verificando herramientas requeridas..."
    
    $tools = @("pt-table-sync", "pt-table-checksum")
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
        Write-Log "Instalar Percona Toolkit desde: https://www.percona.com/downloads/percona-toolkit/" "ERROR"
        return $false
    }
    
    return $true
}

# Función para instalar Percona Toolkit
function Install-PerconaToolkit {
    Write-Log "Instalando Percona Toolkit..."
    
    try {
        # URL correcta para Windows x86_64
        $downloadUrl = "https://downloads.percona.com/downloads/percona-toolkit/3.5.5/binary/windows/x86_64/percona-toolkit-3.5.5_x86_64.zip"
        $tempFile = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "percona-toolkit.zip")
        
        Write-Log "Descargando Percona Toolkit para Windows..."
        Write-Log "URL: $downloadUrl"
        
        # Crear directorio de destino
        $extractPath = "$env:USERPROFILE\percona-toolkit"
        if (-not (Test-Path $extractPath)) {
            New-Item -ItemType Directory -Path $extractPath -Force
        }
        
        # Descargar archivo
        Write-Log "Descargando archivo..."
        Invoke-WebRequest -Uri $downloadUrl -OutFile $tempFile -UseBasicParsing
        
        # Extraer archivo
        Write-Log "Extrayendo archivo..."
        Expand-Archive -Path $tempFile -DestinationPath $extractPath -Force
        
        # Agregar al PATH
        $binPath = "$extractPath\bin"
        if (Test-Path $binPath) {
            $env:PATH += ";$binPath"
            [Environment]::SetEnvironmentVariable("PATH", $env:PATH, [EnvironmentVariableTarget]::User)
            Write-Log "OK Percona Toolkit instalado en: $extractPath"
            Write-Log "OK Agregado al PATH: $binPath"
        } else {
            Write-Log "ERROR: No se encontró la carpeta bin en: $extractPath" "ERROR"
            return $false
        }
        
        # Limpiar archivo temporal
        if (Test-Path $tempFile) {
            Remove-Item $tempFile -Force
        }
        
        return $true
        
    } catch {
        Write-Log "ERROR al instalar Percona Toolkit: $($_.Exception.Message)" "ERROR"
        Write-Log "Intentando descarga manual desde: https://www.percona.com/downloads/percona-toolkit/" "ERROR"
        return $false
    }
}

# Función para sincronizar tabla incremental
function Sync-TableIncremental {
    param(
        [hashtable]$Config,
        [string]$TableName
    )
    
    Write-Log "Sincronizando tabla incremental: $TableName"
    
    $local = $Config["LOCAL_DATABASE"]
    $remote = $Config["RAILWAY_DATABASE"]
    
    # Construir DSN (Data Source Name) para ambas bases
    $localDsn = "h=$($local['HOST']),P=$($local['PORT']),u=$($local['USER']),p=$($local['PASSWORD']),D=$($local['DATABASE'])"
    $remoteDsn = "h=$($remote['HOST']),P=$($remote['PORT']),u=$($remote['USER']),p=$($remote['PASSWORD']),D=$($remote['DATABASE'])"
    
    # Comando pt-table-sync para sincronización incremental
    $args = @(
        "--sync-to-master",
        "--replicate=percona.checksums",
        "--print",
        "--execute",
        "--tables=$TableName",
        "D=$($local['database']),t=$TableName,$localDsn",
        "D=$($remote['database']),t=$TableName,$remoteDsn"
    )
    
    try {
        $process = Start-Process -FilePath "pt-table-sync" -ArgumentList $args -RedirectStandardOutput "sync_output.log" -RedirectStandardError "sync_error.log" -NoNewWindow -Wait -PassThru
        
        if ($process.ExitCode -eq 0) {
            Write-Log "OK Tabla $TableName sincronizada incrementalmente"
            return $true
        } else {
            $errorContent = Get-Content "sync_error.log" -ErrorAction SilentlyContinue
            Write-Log ("ERROR en sincronización de tabla {0}: {1}" -f $TableName, $errorContent) "ERROR"
            return $false
        }
    } catch {
        Write-Log "ERROR al ejecutar pt-table-sync para tabla $TableName" "ERROR"
        return $false
    }
}

# Función para obtener lista de tablas
function Get-TableList {
    param([hashtable]$Config)
    
    Write-Log "Obteniendo lista de tablas..."
    
    $local = $Config["LOCAL_DATABASE"]
    $args = @(
        "-h", $local["HOST"],
        "-P", $local["PORT"],
        "-u", $local["USER"],
        "-p$($local['PASSWORD'])",
        "-e", "SHOW TABLES;",
        $local["DATABASE"]
    )
    
    try {
        $result = & mysql @args 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            $tables = $result | Where-Object { $_ -match '^\w+$' } | ForEach-Object { $_.Trim() }
            Write-Log "OK Encontradas $($tables.Count) tablas"
            return $tables
        } else {
            Write-Log "ERROR al obtener lista de tablas: $result" "ERROR"
            return @()
        }
    } catch {
        Write-Log "ERROR al ejecutar consulta de tablas" "ERROR"
        return @()
    }
}

# Función principal de sincronización incremental
function Start-IncrementalSync {
    param([hashtable]$Config)
    
    Write-Log "Iniciando sincronización incremental..."
    
    # Verificar herramientas
    if (-not (Test-RequiredTools)) {
        if ($InstallTools) {
            if (-not (Install-PerconaToolkit)) {
                return $false
            }
        } else {
            Write-Log "Instalar Percona Toolkit o usar -InstallTools" "ERROR"
            return $false
        }
    }
    
    # Obtener lista de tablas
    $tables = Get-TableList -Config $Config
    if ($tables.Count -eq 0) {
        Write-Log "No se encontraron tablas para sincronizar" "ERROR"
        return $false
    }
    
    # Sincronizar cada tabla incrementalmente
    $successCount = 0
    $errorCount = 0
    
    foreach ($table in $tables) {
        if (Sync-TableIncremental -Config $Config -TableName $table) {
            $successCount++
        } else {
            $errorCount++
        }
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "    SINCRONIZACIÓN INCREMENTAL COMPLETADA" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "OK Tablas sincronizadas exitosamente: $successCount" -ForegroundColor Green
    if ($errorCount -gt 0) {
        Write-Host "ERROR Tablas con errores: $errorCount" -ForegroundColor Red
    }
    Write-Host "OK Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Green
    Write-Host ""
    
    Write-Log "SINCRONIZACIÓN INCREMENTAL COMPLETADA - Exitosas: $successCount, Errores: $errorCount"
    return ($errorCount -eq 0)
}

# Ejecución principal
try {
    # Leer configuración
    $config = Read-IniFile -FilePath $ConfigFile
    
    Write-Host "[DEBUG] Configuración cargada:" -ForegroundColor Yellow
    foreach ($section in $config.Keys) {
        Write-Host ("[DEBUG] Sección: {0}" -f $section) -ForegroundColor Yellow
        foreach ($key in $config[$section].Keys) {
            Write-Host ("[DEBUG]   {0} = '{1}'" -f $key, $config[$section][$key]) -ForegroundColor Yellow
        }
    }
    
    if ($config.Count -eq 0) {
        Write-Log "No se pudo leer el archivo de configuración: $ConfigFile" "ERROR"
        exit 1
    }
    
    Write-Log "Configuración cargada desde: $ConfigFile"
    
    # Modo test
    if ($Test) {
        Write-Log "MODO TEST - Solo verificando conexiones y herramientas"
        Test-RequiredTools
        Get-TableList -Config $config
        exit 0
    }
    
    # Ejecutar sincronización incremental
    $success = Start-IncrementalSync -Config $config
    
    if (-not $success) {
        Write-Log "SINCRONIZACIÓN INCREMENTAL FALLÓ" "ERROR"
        exit 1
    }
    
} catch {
    Write-Log "Error inesperado: $($_.Exception.Message)" "ERROR"
    exit 1
} 