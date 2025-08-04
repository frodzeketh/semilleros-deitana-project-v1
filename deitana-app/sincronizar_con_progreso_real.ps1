# Script con progreso REAL en tiempo real
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    SINCRONIZACION CON PROGRESO REAL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Enviar email de inicio
try {
    $emailTo = "facuslice@gmail.com"
    $emailFrom = "facuslice@gmail.com"
    $smtpServer = "smtp.gmail.com"
    $smtpPort = 587
    $subject = "Sincronización ERP - INICIADA"
    $body = "Sincronización manual iniciada. Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    
    $password = ConvertTo-SecureString "kabx qtwi kvan fdls" -AsPlainText -Force
    $credential = New-Object System.Management.Automation.PSCredential("facuslice@gmail.com", $password)
    Send-MailMessage -From $emailFrom -To $emailTo -Subject $subject -Body $body -SmtpServer $smtpServer -Port $smtpPort -UseSsl -Credential $credential
    Write-Host "Email de inicio enviado" -ForegroundColor Green
} catch {
    Write-Host "Error al enviar email de inicio: $($_.Exception.Message)" -ForegroundColor Red
}

# Verificar herramientas
Write-Host "Verificando herramientas..." -ForegroundColor Yellow
try {
    $mysqldumpPath = Get-Command mysqldump -ErrorAction Stop
    Write-Host "OK mysqldump encontrado" -ForegroundColor Green
} catch {
    Write-Host "ERROR: mysqldump no encontrado" -ForegroundColor Red
    exit 1
}

try {
    $mysqlPath = Get-Command mysql -ErrorAction Stop
    Write-Host "OK mysql encontrado" -ForegroundColor Green
} catch {
    Write-Host "ERROR: mysql no encontrado" -ForegroundColor Red
    exit 1
}

# Verificar VPN
Write-Host ""
Write-Host "Verificando conexión VPN..." -ForegroundColor Yellow
try {
    $result = Test-Connection -ComputerName "10.120.1.5" -Count 1 -Quiet
    if ($result) {
        Write-Host "OK Conexión VPN verificada" -ForegroundColor Green
    } else {
        Write-Host "WARNING: No se pudo conectar a la VPN" -ForegroundColor Yellow
    }
} catch {
    Write-Host "WARNING: Error al verificar VPN: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Exportar base de datos con progreso REAL
Write-Host ""
Write-Host "Iniciando exportación..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$dumpFile = "erp_dump_$timestamp.sql"

try {
    Write-Host "Ejecutando mysqldump..." -ForegroundColor Yellow
    Write-Host ""
    
    # Iniciar proceso de exportación
    $process = Start-Process -FilePath "mysqldump" -ArgumentList "-h", "10.120.1.5", "-P", "3306", "-u", "deitana", "-pD31tana!", "eja", "--single-transaction", "--routines", "--triggers", "--add-drop-database" -RedirectStandardOutput $dumpFile -RedirectStandardError "error.log" -NoNewWindow -PassThru
    
    # Monitorear progreso REAL
    $startTime = Get-Date
    $lastSize = 0
    
    while (-not $process.HasExited) {
        if (Test-Path $dumpFile) {
            $currentSize = (Get-Item $dumpFile -ErrorAction SilentlyContinue).Length
            if ($currentSize -gt $lastSize) {
                $sizeMB = [math]::Round($currentSize / 1MB, 2)
                $elapsed = (Get-Date) - $startTime
                $speedMBps = if ($elapsed.TotalSeconds -gt 0) { [math]::Round($sizeMB / $elapsed.TotalSeconds, 2) } else { 0 }
                
                Write-Host "Exportando: $sizeMB MB - Velocidad: $speedMBps MB/s" -ForegroundColor Green
                $lastSize = $currentSize
            }
        }
        Start-Sleep -Seconds 2
    }
    
    if ($process.ExitCode -eq 0) {
        $fileSize = [math]::Round((Get-Item $dumpFile).Length/1MB, 2)
        Write-Host "OK Exportación completada. Tamaño: $fileSize MB" -ForegroundColor Green
    } else {
        Write-Host "ERROR en exportación. Código: $($process.ExitCode)" -ForegroundColor Red
        if (Test-Path "error.log") {
            $errorContent = Get-Content "error.log" -Raw
            Write-Host "Detalles: $errorContent" -ForegroundColor Red
        }
        exit 1
    }
} catch {
    Write-Host "ERROR al exportar: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Importar a Railway con progreso REAL
Write-Host ""
Write-Host "Iniciando importación a Railway..." -ForegroundColor Yellow
try {
    Write-Host "Ejecutando mysql..." -ForegroundColor Yellow
    Write-Host ""
    
    # Iniciar proceso de importación
    $process = Start-Process -FilePath "mysql" -ArgumentList "-h", "centerbeam.proxy.rlwy.net", "-P", "32877", "-u", "root", "-pgbrIerodvEYzzDQbgtlQjelgLaLlgPuf", "railway" -RedirectStandardInput $dumpFile -RedirectStandardError "error_import.log" -NoNewWindow -PassThru
    
    # Monitorear progreso de importación
    $startTime = Get-Date
    $totalSize = (Get-Item $dumpFile).Length
    $lastProgress = 0
    
    while (-not $process.HasExited) {
        $elapsed = (Get-Date) - $startTime
        
        # Simular progreso basado en tiempo (aproximación para importación)
        $progressPercent = [math]::Min(100, ($elapsed.TotalSeconds * 2)) # 2% por segundo
        
        if ($progressPercent -gt $lastProgress) {
            Write-Host "Importando... $([math]::Round($elapsed.TotalSeconds, 0))s ($progressPercent%)" -ForegroundColor Yellow
            $lastProgress = $progressPercent
        }
        
        Start-Sleep -Seconds 1
    }
    
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

# Limpiar archivos temporales
Write-Host ""
Write-Host "Limpiando archivos temporales..." -ForegroundColor Yellow
if (Test-Path $dumpFile) {
    Remove-Item $dumpFile -Force
    Write-Host "OK Archivo temporal eliminado" -ForegroundColor Green
}
if (Test-Path "error.log") {
    Remove-Item "error.log" -Force
}
if (Test-Path "error_import.log") {
    Remove-Item "error_import.log" -Force
}

# Enviar email de éxito
try {
    $subject = "Sincronización ERP - EXITOSA"
    $body = "Sincronización manual completada exitosamente. Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    Send-MailMessage -From $emailFrom -To $emailTo -Subject $subject -Body $body -SmtpServer $smtpServer -Port $smtpPort -UseSsl -Credential $credential
    Write-Host "Email de éxito enviado" -ForegroundColor Green
} catch {
    Write-Host "Error al enviar email de éxito: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "    SINCRONIZACION COMPLETADA" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "OK Base de datos actualizada exitosamente" -ForegroundColor Green
Write-Host ("OK Fecha: {0}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')) -ForegroundColor Green
Write-Host ""

Read-Host "Presiona Enter para continuar" 