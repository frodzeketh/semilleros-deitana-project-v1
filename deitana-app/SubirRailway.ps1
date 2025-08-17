
# SubirRailway.ps1
# Basado en la logica del batch para exportar e importar solo la tabla acciones_com

# Funcion para enviar email de notificacion
function Send-NotificationEmail {
    param(
        [string]$Status,
        [string]$Details
    )
    
    $emailTo = "facuslice@gmail.com"
    $emailFrom = "facuslice@gmail.com"
    $smtpServer = "smtp.gmail.com"
    $smtpPort = 587
    $subject = "Sincronización Railway - $Status"
    $body = @"
<html><body>
<h2>Sincronización de Base de Datos Railway</h2>
<p><strong>Estado:</strong> $Status</p>
<p><strong>Fecha:</strong> $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')</p>
<p><strong>Detalles:</strong> $Details</p>
<br>
<p>Este es un mensaje automático del sistema de sincronización.</p>
</body></html>
"@
    
    try {
        Write-Host "Enviando notificacion por email..." -ForegroundColor Yellow
        $password = ConvertTo-SecureString "kabx qtwi kvan fdls" -AsPlainText -Force
        $credential = New-Object System.Management.Automation.PSCredential("facuslice@gmail.com", $password)
        Send-MailMessage -From $emailFrom -To $emailTo -Subject $subject -Body $body -BodyAsHtml -SmtpServer $smtpServer -Port $smtpPort -UseSsl -Credential $credential
        Write-Host "OK Notificacion enviada a: $emailTo" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "ERROR al enviar notificacion: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Funcion para leer archivo INI
function ConvertFrom-Ini {
    param([string]$Content)
    $ini = @{}
    $currentSection = ""
    
    foreach ($line in $Content -split "`r?`n") {
        $line = $line.Trim()
        if ($line -match "^\[(.+)\]$") {
            $currentSection = $matches[1]
            $ini[$currentSection] = @{}
        } elseif ($line -match "^(.+)=(.+)$" -and $currentSection) {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            $ini[$currentSection][$key] = $value
        }
    }
    return $ini
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    SUBIR BASE DE DATOS EJA A RAILWAY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Leer configuracion desde config_sync.ini
$configPath = "config_sync.ini"
if (Test-Path $configPath) {
    $configContent = Get-Content $configPath -Raw
    Write-Host "Contenido del archivo config_sync.ini:" -ForegroundColor Gray
    Write-Host $configContent -ForegroundColor Gray
    Write-Host ""
    
    $config = ConvertFrom-Ini -Content $configContent
    Write-Host "Configuracion parseada:" -ForegroundColor Gray
    $config | ConvertTo-Json -Depth 3 | Write-Host -ForegroundColor Gray
    Write-Host ""
    
    $LOCAL_HOST = $config.LOCAL_DATABASE.HOST
    $LOCAL_PORT = $config.LOCAL_DATABASE.PORT
    $LOCAL_USER = $config.LOCAL_DATABASE.USER
    $LOCAL_PASS = $config.LOCAL_DATABASE.PASSWORD
    $LOCAL_DB   = $config.LOCAL_DATABASE.DATABASE
    # Ya no especificamos tabla, exportaremos toda la base de datos

    $REMOTE_HOST = $config.RAILWAY_DATABASE.HOST
    $REMOTE_PORT = $config.RAILWAY_DATABASE.PORT
    $REMOTE_USER = $config.RAILWAY_DATABASE.USER
    $REMOTE_PASS = $config.RAILWAY_DATABASE.PASSWORD
    $REMOTE_DB   = $config.RAILWAY_DATABASE.DATABASE
} else {
    Write-Host "ERROR: No se encontro el archivo config_sync.ini" -ForegroundColor Red
    exit 1
}

# Mostrar configuracion leida
Write-Host "Configuracion local: $LOCAL_USER@${LOCAL_HOST}:${LOCAL_PORT}/${LOCAL_DB}" -ForegroundColor Yellow
Write-Host "Configuracion Railway: $REMOTE_USER@${REMOTE_HOST}:${REMOTE_PORT}/${REMOTE_DB}" -ForegroundColor Yellow
Write-Host ""

$FECHA = Get-Date -Format "yyyy-MM-dd"
$HORA  = Get-Date -Format "HH-mm-ss"
$DUMPFILE = "eja_completa_${FECHA}_${HORA}.sql"

Write-Host "Exportando base de datos '$LOCAL_DB' completa desde la base local..." -ForegroundColor Yellow
$dumpCmd = "mysqldump -h $LOCAL_HOST -P $LOCAL_PORT -u $LOCAL_USER -p$LOCAL_PASS $LOCAL_DB > $DUMPFILE"
Invoke-Expression $dumpCmd
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $DUMPFILE)) {
    Write-Host "ERROR: Fallo la exportacion de la base de datos local" -ForegroundColor Red
    
    # Enviar notificacion de error de exportacion
    $errorDetails = "Error al exportar base de datos $LOCAL_DB desde la base local"
    Send-NotificationEmail -Status "ERROR EXPORTACION" -Details $errorDetails
    
    exit 1
}
Write-Host "Exportacion completada: $DUMPFILE" -ForegroundColor Green

# Limpiar el archivo SQL de caracteres extraños
Write-Host "Limpiando archivo SQL..." -ForegroundColor Yellow
$sqlContent = Get-Content $DUMPFILE -Raw -Encoding UTF8
$sqlContent = $sqlContent -replace '[^\x00-\x7F]', ''  # Remover caracteres no ASCII
$sqlContent = $sqlContent -replace '\r\n', "`n"       # Normalizar saltos de línea
Set-Content $DUMPFILE -Value $sqlContent -Encoding UTF8 -NoNewline
Write-Host "Archivo SQL limpiado" -ForegroundColor Green

Write-Host "Importando en base Railway..." -ForegroundColor Yellow

# Importar usando Get-Content para evitar problemas de codificación
try {
    Write-Host "Ejecutando importacion..." -ForegroundColor Yellow
    $sqlContent = Get-Content $DUMPFILE -Raw
    $importCmd = "mysql -h $REMOTE_HOST -P $REMOTE_PORT -u $REMOTE_USER -p$REMOTE_PASS $REMOTE_DB"
    
    $process = Start-Process -FilePath "mysql" -ArgumentList @("-h", $REMOTE_HOST, "-P", $REMOTE_PORT, "-u", $REMOTE_USER, "-p$REMOTE_PASS", $REMOTE_DB) -RedirectStandardInput $DUMPFILE -NoNewWindow -Wait -PassThru
    
    if ($process.ExitCode -eq 0) {
        Write-Host "Importacion a Railway completada" -ForegroundColor Green
        Remove-Item $DUMPFILE -Force
        Write-Host "Archivo temporal eliminado" -ForegroundColor Green
        
        # Enviar notificacion de exito
        $successDetails = "Base de datos $LOCAL_DB exportada e importada exitosamente a Railway. Archivo: $DUMPFILE"
        Send-NotificationEmail -Status "EXITOSO" -Details $successDetails
    } else {
        Write-Host "ERROR: Fallo la importacion a Railway (Exit Code: $($process.ExitCode))" -ForegroundColor Red
        Write-Host "Revisando contenido del archivo SQL..." -ForegroundColor Yellow
        Get-Content $DUMPFILE -Head 5 | Write-Host -ForegroundColor Gray
        
        # Enviar notificacion de error
        $errorDetails = "Error al importar base de datos $LOCAL_DB a Railway. Exit Code: $($process.ExitCode)"
        Send-NotificationEmail -Status "ERROR" -Details $errorDetails
    }
} catch {
    Write-Host "ERROR: Fallo la importacion a Railway: $($_.Exception.Message)" -ForegroundColor Red
    
    # Enviar notificacion de error
    $errorDetails = "Excepcion al importar base de datos $LOCAL_DB a Railway: $($_.Exception.Message)"
    Send-NotificationEmail -Status "ERROR" -Details $errorDetails
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "    PROCESO FINALIZADO" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Read-Host "Presiona Enter para cerrar"
