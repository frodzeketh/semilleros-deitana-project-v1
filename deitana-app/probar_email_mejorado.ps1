# Script de Prueba de Email Mejorado
# Envía un email de prueba para verificar la configuración

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    PRUEBA DE EMAIL MEJORADA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Enviando email de prueba a facuslice@gmail.com..." -ForegroundColor Yellow
Write-Host ""

# Configuración de email
$emailTo = "facuslice@gmail.com"
$emailFrom = "facuslice@gmail.com"  # Usar el mismo email como remitente
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
    Write-Host "Email: facuslice@gmail.com" -ForegroundColor White
    Write-Host "Contraseña de aplicación: kabx qtwi kvan fdls" -ForegroundColor White
    Write-Host ""
    
    # Crear credenciales con la contraseña de aplicación
    $password = ConvertTo-SecureString "kabx qtwi kvan fdls" -AsPlainText -Force
    $credential = New-Object System.Management.Automation.PSCredential("facuslice@gmail.com", $password)
    
    # Enviar email con credenciales
    Send-MailMessage -From $emailFrom -To $emailTo -Subject $subject -Body $body -BodyAsHtml -SmtpServer $smtpServer -Port $smtpPort -UseSsl -Credential $credential
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "    EMAIL ENVIADO EXITOSAMENTE" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "OK Email de prueba enviado a: $emailTo" -ForegroundColor Green
    Write-Host "OK Revisa tu bandeja de entrada" -ForegroundColor Green
    Write-Host "OK Revisa también la carpeta de spam" -ForegroundColor Yellow
    
} catch {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "    ERROR AL ENVIAR EMAIL" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "SOLUCIONES:" -ForegroundColor Yellow
    Write-Host "1. Verifica que la contraseña de aplicación sea correcta" -ForegroundColor White
    Write-Host "2. Asegúrate de que la verificación en 2 pasos esté activada" -ForegroundColor White
    Write-Host "3. Verifica que no haya espacios extra en la contraseña" -ForegroundColor White
    Write-Host "4. Revisa la carpeta de spam en Gmail" -ForegroundColor White
}

Write-Host ""
Read-Host "Presiona Enter para continuar" 