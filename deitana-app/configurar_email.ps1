# Configurador de Email para Notificaciones
# Este script te ayuda a configurar el email para recibir notificaciones

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    CONFIGURADOR DE EMAIL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📧 CONFIGURACIÓN DE NOTIFICACIONES POR EMAIL" -ForegroundColor Yellow
Write-Host ""

$emailTo = Read-Host "Ingresa tu email para recibir notificaciones"
$emailFrom = Read-Host "Email de origen (Enter para sincronizacion@deitana.com)"
if (-not $emailFrom) { $emailFrom = "sincronizacion@deitana.com" }

Write-Host ""
Write-Host "🔧 CONFIGURACIÓN DE SERVIDOR SMTP" -ForegroundColor Yellow
Write-Host ""

$smtpChoice = Read-Host "Selecciona tu proveedor de email:
1. Gmail
2. Outlook/Hotmail
3. Otro (configuración manual)
(1/2/3)"

switch ($smtpChoice) {
    "1" {
        $smtpServer = "smtp.gmail.com"
        $smtpPort = 587
        Write-Host "OK Configurado para Gmail" -ForegroundColor Green
        Write-Host "IMPORTANTE: Para Gmail necesitas:" -ForegroundColor Yellow
        Write-Host "   1. Activar verificación en 2 pasos" -ForegroundColor White
        Write-Host "   2. Generar contraseña de aplicación" -ForegroundColor White
        Write-Host "   3. Usar esa contraseña en lugar de tu contraseña normal" -ForegroundColor White
    }
    "2" {
        $smtpServer = "smtp-mail.outlook.com"
        $smtpPort = 587
        Write-Host "OK Configurado para Outlook/Hotmail" -ForegroundColor Green
    }
    "3" {
        $smtpServer = Read-Host "Servidor SMTP"
        $smtpPort = Read-Host "Puerto SMTP (Enter para 587)"
        if (-not $smtpPort) { $smtpPort = 587 }
    }
    default {
        Write-Host "ERROR: Opción no válida, usando Gmail por defecto" -ForegroundColor Red
        $smtpServer = "smtp.gmail.com"
        $smtpPort = 587
    }
}

Write-Host ""
Write-Host "🧪 PROBANDO CONFIGURACIÓN DE EMAIL" -ForegroundColor Yellow
Write-Host ""

$testSubject = "Prueba de Notificación - Sincronización ERP"
$testBody = @"
<html>
<body>
<h2>Prueba de Notificación</h2>
<p>Esta es una prueba del sistema de notificaciones por email.</p>
<p><strong>Fecha:</strong> $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')</p>
<p>Si recibes este email, la configuración está correcta.</p>
</body>
</html>
"@

try {
    Send-MailMessage -From $emailFrom -To $emailTo -Subject $testSubject -Body $testBody -BodyAsHtml -SmtpServer $smtpServer -Port $smtpPort -UseSsl
    Write-Host "OK Email de prueba enviado exitosamente" -ForegroundColor Green
    Write-Host "Revisa tu bandeja de entrada: $emailTo" -ForegroundColor Cyan
} catch {
    Write-Host "ERROR al enviar email de prueba: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Consejos para solucionar:" -ForegroundColor Yellow
    Write-Host "   - Verifica que el email y contraseña sean correctos" -ForegroundColor White
    Write-Host "   - Para Gmail: usa contraseña de aplicación" -ForegroundColor White
    Write-Host "   - Para Outlook: verifica configuración de seguridad" -ForegroundColor White
}

Write-Host ""
Write-Host "📋 RESUMEN DE CONFIGURACIÓN:" -ForegroundColor Cyan
Write-Host "Email destino: $emailTo" -ForegroundColor White
Write-Host "Email origen: $emailFrom" -ForegroundColor White
Write-Host "Servidor SMTP: $smtpServer" -ForegroundColor White
Write-Host "Puerto: $smtpPort" -ForegroundColor White
Write-Host ""

Write-Host "PROXIMO PASO:" -ForegroundColor Green
Write-Host "Configurar tarea programada:" -ForegroundColor White
Write-Host "powershell.exe -ExecutionPolicy Bypass -File 'configurar_tarea_2am.ps1'" -ForegroundColor Gray
Write-Host ""

Read-Host "Presiona Enter para continuar" 