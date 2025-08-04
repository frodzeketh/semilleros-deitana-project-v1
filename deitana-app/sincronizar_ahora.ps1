# Script simple para sincronizar manualmente
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    SINCRONIZACION MANUAL ERP" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Función para mostrar progreso
function Show-Progress {
    param(
        [string]$Activity,
        [string]$Status,
        [int]$PercentComplete,
        [string]$CurrentOperation
    )
    
    Write-Progress -Activity $Activity -Status $Status -PercentComplete $PercentComplete -CurrentOperation $CurrentOperation
    Write-Host "[$PercentComplete%] $CurrentOperation" -ForegroundColor Yellow
}

# Enviar email de inicio
Show-Progress -Activity "Sincronización ERP" -Status "Iniciando proceso" -PercentComplete 5 -CurrentOperation "Enviando email de inicio"
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
Show-Progress -Activity "Sincronización ERP" -Status "Verificando herramientas" -PercentComplete 10 -CurrentOperation "Verificando mysqldump"
try {
    $mysqldumpPath = Get-Command mysqldump -ErrorAction Stop
    Write-Host "OK mysqldump encontrado" -ForegroundColor Green
} catch {
    Write-Host "ERROR: mysqldump no encontrado" -ForegroundColor Red
    exit 1
}

Show-Progress -Activity "Sincronización ERP" -Status "Verificando herramientas" -PercentComplete 15 -CurrentOperation "Verificando mysql"
try {
    $mysqlPath = Get-Command mysql -ErrorAction Stop
    Write-Host "OK mysql encontrado" -ForegroundColor Green
} catch {
    Write-Host "ERROR: mysql no encontrado" -ForegroundColor Red
    exit 1
}

# Verificar VPN
Show-Progress -Activity "Sincronización ERP" -Status "Verificando conexión" -PercentComplete 20 -CurrentOperation "Verificando conexión VPN"
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

# Exportar base de datos
Show-Progress -Activity "Sincronización ERP" -Status "Exportando base de datos" -PercentComplete 25 -CurrentOperation "Iniciando exportación"
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$dumpFile = "erp_dump_$timestamp.sql"

try {
    Show-Progress -Activity "Sincronización ERP" -Status "Exportando base de datos" -PercentComplete 30 -CurrentOperation "Ejecutando mysqldump"
    $process = Start-Process -FilePath "mysqldump" -ArgumentList "-h", "10.120.1.5", "-P", "3306", "-u", "deitana", "-pD31tana!", "eja", "--single-transaction", "--routines", "--triggers", "--add-drop-database" -RedirectStandardOutput $dumpFile -RedirectStandardError "error.log" -NoNewWindow -Wait -PassThru
    
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

# Importar a Railway
Show-Progress -Activity "Sincronización ERP" -Status "Importando a Railway" -PercentComplete 60 -CurrentOperation "Iniciando importación"
try {
    Show-Progress -Activity "Sincronización ERP" -Status "Importando a Railway" -PercentComplete 70 -CurrentOperation "Ejecutando mysql"
    $process = Start-Process -FilePath "mysql" -ArgumentList "-h", "centerbeam.proxy.rlwy.net", "-P", "32877", "-u", "root", "-pgbrIerodvEYzzDQbgtlQjelgLaLlgPuf", "railway" -RedirectStandardInput $dumpFile -RedirectStandardError "error_import.log" -NoNewWindow -Wait -PassThru
    
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
Show-Progress -Activity "Sincronización ERP" -Status "Limpiando archivos" -PercentComplete 85 -CurrentOperation "Eliminando archivos temporales"
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
Show-Progress -Activity "Sincronización ERP" -Status "Finalizando" -PercentComplete 90 -CurrentOperation "Enviando email de éxito"
try {
    $subject = "Sincronización ERP - EXITOSA"
    $body = "Sincronización manual completada exitosamente. Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    Send-MailMessage -From $emailFrom -To $emailTo -Subject $subject -Body $body -SmtpServer $smtpServer -Port $smtpPort -UseSsl -Credential $credential
    Write-Host "Email de éxito enviado" -ForegroundColor Green
} catch {
    Write-Host "Error al enviar email de éxito: $($_.Exception.Message)" -ForegroundColor Red
}

Show-Progress -Activity "Sincronización ERP" -Status "Completado" -PercentComplete 100 -CurrentOperation "Proceso finalizado"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "    SINCRONIZACION COMPLETADA" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "OK Base de datos actualizada exitosamente" -ForegroundColor Green
Write-Host ("OK Fecha: {0}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')) -ForegroundColor Green
Write-Host ""

Read-Host "Presiona Enter para continuar" 