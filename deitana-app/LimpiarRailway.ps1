# LimpiarRailway.ps1
# Script de PowerShell para eliminar todas las tablas de Railway

param(
    [string]$ConfigFile = "config_sync.ini",
    [switch]$Force
)

Write-Host "========================================" -ForegroundColor Red
Write-Host "    ELIMINADOR DE TABLAS RAILWAY" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""

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
                    $key = $key.Trim()
                    $config[$currentSection][$key] = $value.Trim()
                }
            }
        }
    }
    
    return $config
}

function Test-RequiredTools {
    Write-Log "Verificando herramientas requeridas..."
    
    try {
        $null = Get-Command mysql -ErrorAction Stop
        Write-Log "OK mysql encontrado"
        return $true
    } catch {
        Write-Log "ERROR mysql no encontrado. Instalar MySQL Client" "ERROR"
        return $false
    }
}

function Test-RailwayConnection {
    param($RailwayConfig)
    
    Write-Log "Verificando conexion a Railway..."
    
    $cmd = "mysql -h $($RailwayConfig.HOST) -P $($RailwayConfig.PORT) -u $($RailwayConfig.USER) -p$($RailwayConfig.PASSWORD) -e 'SELECT 1;'"
    try {
        $output = Invoke-Expression $cmd
        if ($LASTEXITCODE -eq 0) {
            Write-Log "OK Conexion a Railway verificada"
            return $true
        } else {
            Write-Log "ERROR No se puede conectar a Railway" "ERROR"
            return $false
        }
    } catch {
        Write-Log "ERROR Error al conectar a Railway: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

function Get-DatabaseTables {
    param($RailwayConfig)
    Write-Log "Obteniendo lista de tablas..."

    $cmd = "mysql -h $($RailwayConfig.HOST) -P $($RailwayConfig.PORT) -u $($RailwayConfig.USER) -p$($RailwayConfig.PASSWORD) -N -e 'SHOW TABLES FROM $($RailwayConfig.DATABASE);'"
    try {
        $output = Invoke-Expression $cmd | Where-Object { $_ -ne "" }
        if ($LASTEXITCODE -eq 0) {
            Write-Log "OK Encontradas $($output.Count) tablas"
            return $output
        } else {
            Write-Log "ERROR Error al obtener tablas" "ERROR"
            return @()
        }
    } catch {
        Write-Log "ERROR Error al obtener tablas: $($_.Exception.Message)" "ERROR"
        return @()
    }
}

function Clear-RailwayDatabase {
    param($RailwayConfig, [string[]]$Tables)
    
    Write-Log "Eliminando todas las tablas en una sola consulta..." "WARNING"
    if ($Tables.Count -eq 0) {
        Write-Log "No hay tablas para eliminar" "WARNING"
        return $false
    }

    # Construir el comando DROP TABLE masivo
    $dropList = ($Tables | ForEach-Object { '`' + $_ + '`' }) -join ", "
    $dropSQL = "SET FOREIGN_KEY_CHECKS=0; DROP TABLE IF EXISTS $dropList; SET FOREIGN_KEY_CHECKS=1;"

    $cmd = "mysql -h $($RailwayConfig.HOST) -P $($RailwayConfig.PORT) -u $($RailwayConfig.USER) -p$($RailwayConfig.PASSWORD) -D $($RailwayConfig.DATABASE) -e '$dropSQL'"
    try {
        $output = Invoke-Expression $cmd
        if ($LASTEXITCODE -eq 0) {
            Write-Log "OK Todas las tablas eliminadas correctamente" "INFO"
            return $true
        } else {
            Write-Log "ERROR Error al eliminar tablas" "ERROR"
            return $false
        }
    } catch {
        Write-Log "ERROR Error al eliminar tablas: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

function Main {
    Write-Log "Iniciando proceso de eliminacion de Railway..."
    
    Write-Log "Leyendo configuracion desde $ConfigFile"
    $config = Read-IniFile -FilePath $ConfigFile
    
    if (-not $config.ContainsKey("RAILWAY_DATABASE")) {
        Write-Log "ERROR No se encontro la seccion RAILWAY_DATABASE en $ConfigFile" "ERROR"
        exit 1
    }
    
    $railwayConfig = $config["RAILWAY_DATABASE"]
    
    $requiredParams = @("HOST", "PORT", "USER", "PASSWORD", "DATABASE")
    foreach ($param in $requiredParams) {
        if (-not $railwayConfig.ContainsKey($param) -or [string]::IsNullOrEmpty($railwayConfig[$param])) {
            Write-Log "ERROR Parametro requerido faltante: $param" "ERROR"
            exit 1
        }
    }
    
    Write-Log "Configuracion Railway cargada correctamente"
    
    if (-not (Test-RequiredTools)) {
        Write-Log "ERROR Herramientas requeridas no disponibles" "ERROR"
        exit 1
    }
    
    if (-not (Test-RailwayConnection -RailwayConfig $railwayConfig)) {
        Write-Log "ERROR No se puede conectar a Railway" "ERROR"
        exit 1
    }
    
    $tables = Get-DatabaseTables -RailwayConfig $railwayConfig
    if ($tables.Count -eq 0) {
        Write-Log "WARNING No se encontraron tablas para eliminar" "WARNING"
        exit 0
    }
    
    Write-Host ""
    Write-Host "TABLAS QUE SE VAN A ELIMINAR:" -ForegroundColor Yellow
    foreach ($table in $tables) {
        Write-Host "  - $table" -ForegroundColor Yellow
    }
    Write-Host ""
    
    if (-not $Force) {
        Write-Host "Estas seguro de que quieres ELIMINAR TODAS las tablas de Railway?" -ForegroundColor Red
        Write-Host "Esta accion NO se puede deshacer y eliminara TODAS las tablas y datos." -ForegroundColor Red
        Write-Host ""
        $confirmation = Read-Host "Escribe 'SI' para confirmar (cualquier otra cosa para cancelar)"
        
        if ($confirmation -ne "SI") {
            Write-Log "Operacion cancelada por el usuario" "WARNING"
            exit 0
        }
    }
    
    Write-Host ""
    Write-Log "Iniciando eliminacion de $($tables.Count) tablas..."
    
    $success = Clear-RailwayDatabase -RailwayConfig $railwayConfig -Tables $tables
    
    if ($success) {
        Write-Host ""
        Write-Log "ELIMINACION COMPLETADA EXITOSAMENTE!" "INFO"
        Write-Log "Todas las tablas de Railway han sido eliminadas" "INFO"
    } else {
        Write-Host ""
        Write-Log "Eliminacion completada con errores" "WARNING"
        Write-Log "Revisa los logs para mas detalles" "WARNING"
        exit 1
    }
}

try {
    Main
} catch {
    Write-Log "ERROR Error critico: $($_.Exception.Message)" "ERROR"
    exit 1
}
