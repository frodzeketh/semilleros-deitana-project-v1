# Script de Prueba de Email
# Envía un email de prueba para verificar la configuración

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    PRUEBA DE EMAIL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Enviando email de prueba a facuslice@gmail.com..." -ForegroundColor Yellow
Write-Host ""

# Configuración de email
$emailTo = "facuslice@gmail.com"
$emailFrom = "sincronizacion@deitana.com"
$smtpServer = "smtp.gmail.com"
$smtpPort = 587

$subject = "PRUEBA - Sincronización ERP"
$body = @"
<html>
<body>
<h2>Prueba de Notificación - Sincronización ERP</h2>
<p>Este es un email de prueba para verificar que la configuración funciona correctamente.</p>
<p><strong>Fecha de prueba:</strong> $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')</p>
<p><strong>Estado:</strong> PRUEBA EXITOSA</p>
<br>
<p>Si recibes este email, significa que:</p>
<ul>
<li>La configuración de email está correcta</li>
<li>Las notificaciones funcionarán cuando se complete la sincronización</li>
<li>El sistema está listo para enviar notificaciones automáticas</li>
</ul>
<br>
<p>Este es un mensaje automático del sistema de sincronización ERP.</p>
</body>
</html>
"@

try {
    Write-Host "Intentando enviar email..." -ForegroundColor Green
    
    # Para Gmail, necesitas usar credenciales
    $credential = Get-Credential -Message "Ingresa tu email y contraseña de aplicación de Gmail"
    
    Send-MailMessage -From $emailFrom -To $emailTo -Subject $subject -Body $body -BodyAsHtml -SmtpServer $smtpServer -Port $smtpPort -UseSsl -Credential $credential
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "    EMAIL ENVIADO EXITOSAMENTE" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "OK Email de prueba enviado a: $emailTo" -ForegroundColor Green
    Write-Host "OK Revisa tu bandeja de entrada" -ForegroundColor Green
    Write-Host ""
    Write-Host "NOTA: Si no recibes el email, verifica:" -ForegroundColor Yellow
    Write-Host "1. Que hayas ingresado las credenciales correctas" -ForegroundColor White
    Write-Host "2. Que tengas verificación en 2 pasos activada en Gmail" -ForegroundColor White
    Write-Host "3. Que uses una contraseña de aplicación, no tu contraseña normal" -ForegroundColor White
    
} catch {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "    ERROR AL ENVIAR EMAIL" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "SOLUCIONES:" -ForegroundColor Yellow
    Write-Host "1. Verifica que tu email y contraseña sean correctos" -ForegroundColor White
    Write-Host "2. Para Gmail: activa verificación en 2 pasos" -ForegroundColor White
    Write-Host "3. Para Gmail: genera una contraseña de aplicación" -ForegroundColor White
    Write-Host "4. Usa la contraseña de aplicación, no tu contraseña normal" -ForegroundColor White
}

Write-Host ""
Read-Host "Presiona Enter para continuar" 