# Instalador Automático del Sincronizador ERP → Railway
# Este script configura todo el sistema de sincronización automáticamente

param(
    [switch]$SkipChecks,
    [switch]$Force
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    INSTALADOR SINCRONIZADOR ERP" -ForegroundColor Cyan
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
        Write-Log "Instalar MySQL Client desde: https://dev.mysql.com/downloads/mysql/" "ERROR"
        return $false
    }
    
    return $true
}

# Función para verificar VPN
function Test-VPNConnection {
    Write-Log "Verificando conexión VPN..."
    
    try {
        $ping = Test-Connection -ComputerName "127.0.0.1" -Count 1 -Quiet
        if ($ping) {
            Write-Log "✓ Conexión local verificada"
            return $true
        } else {
            Write-Log "⚠ Advertencia: No se puede conectar al servidor local" "WARNING"
            Write-Log "Verificar que la VPN Sophos esté conectada" "WARNING"
            return $false
        }
    } catch {
        Write-Log "⚠ Advertencia: Error al verificar conexión VPN" "WARNING"
        return $false
    }
}

# Función para configurar credenciales
function Set-Credentials {
    Write-Log "Configurando credenciales..."
    
    Write-Host ""
    Write-Host "CONFIGURACIÓN DE CREDENCIALES" -ForegroundColor Yellow
    Write-Host "=============================" -ForegroundColor Yellow
    
    $localHost = Read-Host "Host local (Enter para 127.0.0.1)" 
    if (-not $localHost) { $localHost = "127.0.0.1" }
    
    $localPort = Read-Host "Puerto local (Enter para 3306)"
    if (-not $localPort) { $localPort = "3306" }
    
    $localUser = Read-Host "Usuario local (Enter para root)"
    if (-not $localUser) { $localUser = "root" }
    
    $localPass = Read-Host "Contraseña local" -AsSecureString
    $localPassPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($localPass))
    
    $localDb = Read-Host "Base de datos local (Enter para erp_global)"
    if (-not $localDb) { $localDb = "erp_global" }
    
    # Crear archivo de configuración
    $configContent = @"
[LOCAL_DATABASE]
# Configuración de la base de datos local del ERP
HOST=$localHost
PORT=$localPort
USER=$localUser
PASSWORD=$localPassPlain
DATABASE=$localDb

[RAILWAY_DATABASE]
# Configuración de Railway (desde db.js)
HOST=centerbeam.proxy.rlwy.net
PORT=32877
USER=root
PASSWORD=gbrIerodvEYzzDQbgtlQjelgLaLlgPuf
DATABASE=railway

[SYNC_SETTINGS]
# Configuración de sincronización
BACKUP_RETENTION_DAYS=7
LOG_RETENTION_DAYS=30
COMPRESS_DUMP=true
"@
    
    $configContent | Out-File -FilePath "config_sync.ini" -Encoding UTF8
    Write-Log "✓ Archivo de configuración creado"
    
    return $true
}

# Función para probar conexión
function Test-DatabaseConnection {
    Write-Log "Probando conexión a base de datos..."
    
    try {
        # Leer configuración
        $config = @{}
        $currentSection = ""
        
        Get-Content "config_sync.ini" | ForEach-Object {
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
        
        # Probar conexión local
        $local = $config["LOCAL_DATABASE"]
        $args = @("-h", $local["HOST"], "-P", $local["PORT"], "-u", $local["USER"], "-p$($local['PASSWORD'])", "-e", "SELECT 1;")
        
        $process = Start-Process -FilePath "mysql" -ArgumentList $args -RedirectStandardError "test_error.log" -NoNewWindow -Wait -PassThru
        
        if ($process.ExitCode -eq 0) {
            Write-Log "✓ Conexión local exitosa"
        } else {
            $error = Get-Content "test_error.log" -ErrorAction SilentlyContinue
            Write-Log "✗ Error en conexión local: $error" "ERROR"
            return $false
        }
        
        # Limpiar archivo de error
        if (Test-Path "test_error.log") {
            Remove-Item "test_error.log" -Force
        }
        
        return $true
        
    } catch {
        Write-Log "✗ Error al probar conexión: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# Función para configurar tarea programada
function Set-ScheduledTask {
    Write-Log "Configurando tarea programada..."
    
    # Verificar si se ejecuta como administrador
    if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
        Write-Log "⚠ Advertencia: No se ejecuta como administrador" "WARNING"
        Write-Log "La tarea programada debe configurarse manualmente" "WARNING"
        return $false
    }
    
    $taskName = "Sincronizar ERP a Railway"
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
        $trigger = New-ScheduledTaskTrigger -Daily -At "03:30"
        $principal = New-ScheduledTaskPrincipal -UserId (Get-CimInstance -ClassName Win32_ComputerSystem).UserName -LogonType Interactive -RunLevel Highest
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable
        
        $task = Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Sincronización automática de base de datos ERP a Railway"
        
        Write-Log "✓ Tarea programada creada exitosamente"
        return $true
        
    } catch {
        Write-Log "✗ Error al crear tarea programada: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# Función principal de instalación
function Start-Installation {
    Write-Log "Iniciando instalación del sincronizador..."
    
    # Verificar herramientas
    if (-not $SkipChecks) {
        if (-not (Test-RequiredTools)) {
            Write-Log "Instalación cancelada por falta de herramientas" "ERROR"
            return $false
        }
        
        if (-not (Test-VPNConnection)) {
            $response = Read-Host "¿Continuar sin VPN? (s/N)"
            if ($response -ne "s" -and $response -ne "S") {
                Write-Log "Instalación cancelada" "ERROR"
                return $false
            }
        }
    }
    
    # Configurar credenciales
    if (-not (Set-Credentials)) {
        Write-Log "Error al configurar credenciales" "ERROR"
        return $false
    }
    
    # Probar conexión
    if (-not (Test-DatabaseConnection)) {
        Write-Log "Error al conectar a la base de datos" "ERROR"
        return $false
    }
    
    # Configurar tarea programada
    $taskCreated = Set-ScheduledTask
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "    INSTALACIÓN COMPLETADA" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    
    if ($taskCreated) {
        Write-Host "✅ Tarea programada configurada" -ForegroundColor Green
        Write-Host "✅ Se ejecutará diariamente a las 03:30" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Tarea programada NO configurada" -ForegroundColor Yellow
        Write-Host "   Configurar manualmente en Programador de tareas" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "📋 PRÓXIMOS PASOS:" -ForegroundColor Cyan
    Write-Host "1. Probar sincronización manual:" -ForegroundColor White
    Write-Host "   powershell.exe -ExecutionPolicy Bypass -File 'sync_erp_railway.ps1' -Test" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Verificar logs:" -ForegroundColor White
    Write-Host "   Get-Content 'sync_log_$(Get-Date -Format 'yyyy-MM-dd').txt' -Tail 10" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. Configurar PC para no hibernar durante la noche" -ForegroundColor White
    Write-Host ""
    Write-Host "📚 Documentación: README_SINCRONIZACION.md" -ForegroundColor Cyan
    
    return $true
}

# Ejecución principal
try {
    $success = Start-Installation
    
    if ($success) {
        Write-Host ""
        Write-Host "🎉 ¡Instalación completada exitosamente!" -ForegroundColor Green
        Write-Host "Tu asistente IA tendrá datos actualizados automáticamente" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "❌ Instalación falló" -ForegroundColor Red
        Write-Host "Revisar errores y intentar nuevamente" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Log "Error inesperado durante la instalación: $($_.Exception.Message)" "ERROR"
    exit 1
} 