# Script simple para probar conexión y email
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    PRUEBA DE CONEXIÓN Y EMAIL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Función para enviar email
function Send-TestEmail {
    $emailTo = "facuslice@gmail.com"
    $emailFrom = "facuslice@gmail.com"
    $smtpServer = "smtp.gmail.com"
    $smtpPort = 587
    $subject = "PRUEBA - Sincronización ERP"
    $body = @"
<html><body>
<h2>Prueba de Sincronización ERP</h2>
<p><strong>Estado:</strong> PRUEBA MANUAL</p>
<p><strong>Fecha:</strong> $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')</p>
<p><strong>Detalles:</strong> Prueba manual de conexión y email</p>
<br>
<p>Este es un mensaje de prueba del sistema de sincronización.</p>
</body></html>
"@
    
    try {
        Write-Host "Enviando email de prueba..." -ForegroundColor Yellow
        $password = ConvertTo-SecureString "kabx qtwi kvan fdls" -AsPlainText -Force
        $credential = New-Object System.Management.Automation.PSCredential("facuslice@gmail.com", $password)
        Send-MailMessage -From $emailFrom -To $emailTo -Subject $subject -Body $body -BodyAsHtml -SmtpServer $smtpServer -Port $smtpPort -UseSsl -Credential $credential
        Write-Host "OK Email de prueba enviado a: $emailTo" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "ERROR al enviar email: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

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

# Enviar email de prueba
Write-Host ""
Write-Host "Enviando email de prueba..." -ForegroundColor Yellow
$emailResult = Send-TestEmail

if ($emailResult) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "    PRUEBA COMPLETADA" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "OK Email enviado correctamente" -ForegroundColor Green
    Write-Host "OK Revisa tu bandeja de entrada" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "    PRUEBA FALLÓ" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "ERROR: No se pudo enviar el email" -ForegroundColor Red
}

Write-Host ""
Read-Host "Presiona Enter para continuar" 