# Script simple para probar conexión
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    PRUEBA DE CONEXION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar herramientas
Write-Host "Verificando herramientas..." -ForegroundColor Yellow
try {
    $mysqldumpPath = Get-Command mysqldump -ErrorAction Stop
    Write-Host "OK mysqldump encontrado" -ForegroundColor Green
} catch {
    Write-Host "ERROR: mysqldump no encontrado" -ForegroundColor Red
}

try {
    $mysqlPath = Get-Command mysql -ErrorAction Stop
    Write-Host "OK mysql encontrado" -ForegroundColor Green
} catch {
    Write-Host "ERROR: mysql no encontrado" -ForegroundColor Red
}

# Verificar VPN
Write-Host ""
Write-Host "Verificando conexion VPN..." -ForegroundColor Yellow
try {
    $result = Test-Connection -ComputerName "10.120.1.5" -Count 1 -Quiet
    if ($result) {
        Write-Host "OK Conexion VPN verificada" -ForegroundColor Green
    } else {
        Write-Host "WARNING: No se pudo conectar a la VPN" -ForegroundColor Yellow
    }
} catch {
    Write-Host "WARNING: Error al verificar VPN: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Enviar email simple
Write-Host ""
Write-Host "Enviando email de prueba..." -ForegroundColor Yellow
try {
    $emailTo = "facuslice@gmail.com"
    $emailFrom = "facuslice@gmail.com"
    $smtpServer = "smtp.gmail.com"
    $smtpPort = 587
    $subject = "PRUEBA - Sincronizacion ERP"
    $body = "Prueba manual de sincronizacion ERP. Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    
    $password = ConvertTo-SecureString "kabx qtwi kvan fdls" -AsPlainText -Force
    $credential = New-Object System.Management.Automation.PSCredential("facuslice@gmail.com", $password)
    Send-MailMessage -From $emailFrom -To $emailTo -Subject $subject -Body $body -SmtpServer $smtpServer -Port $smtpPort -UseSsl -Credential $credential
    Write-Host "OK Email de prueba enviado a: $emailTo" -ForegroundColor Green
} catch {
    Write-Host "ERROR al enviar email: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "    PRUEBA COMPLETADA" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "OK Revisa tu bandeja de entrada" -ForegroundColor Green

Write-Host ""
Read-Host "Presiona Enter para continuar" 