# Script simple y robusto para sincronizar ERP
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    SINCRONIZACION SIMPLE ERP" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuración
$erpHost = "10.120.1.5"
$erpPort = "3306"
$erpUser = "deitana"
$erpPass = "D31tana!"
$erpDb = "eja"

$railwayHost = "centerbeam.proxy.rlwy.net"
$railwayPort = "32877"
$railwayUser = "root"
$railwayPass = "gbrIerodvEYzzDQbgtlQjelgLaLlgPuf"
$railwayDb = "railway"

# Verificar herramientas
Write-Host "Verificando herramientas..." -ForegroundColor Yellow
try {
    $null = Get-Command mysqldump -ErrorAction Stop
    Write-Host "OK mysqldump encontrado" -ForegroundColor Green
} catch {
    Write-Host "ERROR: mysqldump no encontrado" -ForegroundColor Red
    Write-Host "Instalar MySQL Client" -ForegroundColor Yellow
    exit 1
}

try {
    $null = Get-Command mysql -ErrorAction Stop
    Write-Host "OK mysql encontrado" -ForegroundColor Green
} catch {
    Write-Host "ERROR: mysql no encontrado" -ForegroundColor Red
    Write-Host "Instalar MySQL Client" -ForegroundColor Yellow
    exit 1
}

# Verificar VPN
Write-Host ""
Write-Host "Verificando VPN..." -ForegroundColor Yellow
try {
    $ping = Test-Connection -ComputerName $erpHost -Count 2 -Quiet
    if ($ping) {
        Write-Host "OK VPN conectada" -ForegroundColor Green
    } else {
        Write-Host "ERROR: VPN no conectada" -ForegroundColor Red
        Write-Host "Conectar VPN Sophos antes de continuar" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "ERROR: No se puede conectar al servidor ERP" -ForegroundColor Red
    exit 1
}

# Crear archivo temporal
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$dumpFile = "erp_dump_$timestamp.sql"

Write-Host ""
Write-Host "Iniciando exportación..." -ForegroundColor Yellow
Write-Host "Esto puede tomar varios minutos..." -ForegroundColor White

try {
    # Exportar con timeout extendido
    $process = Start-Process -FilePath "mysqldump" -ArgumentList "-h", $erpHost, "-P", $erpPort, "-u", $erpUser, "-p$erpPass", $erpDb, "--single-transaction", "--routines", "--triggers", "--add-drop-database", "--max_allowed_packet=1G", "--net_read_timeout=3600", "--net_write_timeout=3600" -RedirectStandardOutput $dumpFile -RedirectStandardError "error_export.log" -NoNewWindow -Wait -PassThru
    
    if ($process.ExitCode -eq 0) {
        $fileSize = [math]::Round((Get-Item $dumpFile).Length/1MB, 2)
        Write-Host "OK Exportación completada. Tamaño: $fileSize MB" -ForegroundColor Green
    } else {
        Write-Host "ERROR en exportación. Código: $($process.ExitCode)" -ForegroundColor Red
        if (Test-Path "error_export.log") {
            $errorContent = Get-Content "error_export.log" -Raw
            Write-Host "Detalles: $errorContent" -ForegroundColor Red
        }
        exit 1
    }
} catch {
    Write-Host "ERROR al exportar: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Iniciando importación a Railway..." -ForegroundColor Yellow
Write-Host "Esto puede tomar varios minutos..." -ForegroundColor White

try {
    # Importar con timeout extendido
    $process = Start-Process -FilePath "mysql" -ArgumentList "-h", $railwayHost, "-P", $railwayPort, "-u", $railwayUser, "-p$railwayPass", $railwayDb, "--max_allowed_packet=1G", "--net_read_timeout=3600", "--net_write_timeout=3600" -RedirectStandardInput $dumpFile -RedirectStandardError "error_import.log" -NoNewWindow -Wait -PassThru
    
    if ($process.ExitCode -eq 0) {
        Write-Host "OK Importación completada" -ForegroundColor Green
    } else {
        Write-Host "ERROR en importación. Código: $($process.ExitCode)" -ForegroundColor Red
        if (Test-Path "error_import.log") {
            $errorContent = Get-Content "error_import.log" -Raw
            Write-Host "Detalles: $errorContent" -ForegroundColor Red
        }
        exit 1
    }
} catch {
    Write-Host "ERROR al importar: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Limpiar archivos
Write-Host ""
Write-Host "Limpiando archivos temporales..." -ForegroundColor Yellow
if (Test-Path $dumpFile) {
    Remove-Item $dumpFile -Force
    Write-Host "OK Archivo temporal eliminado" -ForegroundColor Green
}
if (Test-Path "error_export.log") {
    Remove-Item "error_export.log" -Force
}
if (Test-Path "error_import.log") {
    Remove-Item "error_import.log" -Force
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "    SINCRONIZACION COMPLETADA" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "OK Base de datos actualizada exitosamente" -ForegroundColor Green
Write-Host ("OK Fecha: {0}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')) -ForegroundColor Green
Write-Host ""

Read-Host "Presiona Enter para continuar" 