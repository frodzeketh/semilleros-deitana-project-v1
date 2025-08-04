# Configurador de Tarea Programada para 22:00 hs
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    CONFIGURADOR TAREA 22:00 HS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Eliminar tarea existente si existe
$taskName = "Sincronizacion ERP 22hs"
try {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Tarea anterior eliminada" -ForegroundColor Yellow
} catch {
    Write-Host "No se encontró tarea anterior" -ForegroundColor Yellow
}

# Crear nueva tarea
try {
    $action = New-ScheduledTaskAction -Execute "sync_batch.bat" -WorkingDirectory "C:\Users\anabe\OneDrive\Documentos\semilleros-deitana-project\deitana-app"
    $trigger = New-ScheduledTaskTrigger -Daily -At "22:00"
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "    TAREA CONFIGURADA EXITOSAMENTE" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "OK Tarea programada creada: $taskName" -ForegroundColor Green
    Write-Host "OK Se ejecutará diariamente a las 22:00 hs" -ForegroundColor Green
    Write-Host "OK Email configurado: facuslice@gmail.com" -ForegroundColor Green
    Write-Host "OK Base de datos se sincronizará automáticamente" -ForegroundColor Green
    Write-Host ""
    Write-Host "REQUISITOS:" -ForegroundColor Yellow
    Write-Host "- PC encendida a las 22:00 hs" -ForegroundColor White
    Write-Host "- VPN Sophos conectada" -ForegroundColor White
    Write-Host ""
    Write-Host "LISTO! Ya no necesitas hacer nada más." -ForegroundColor Green

} catch {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "    ERROR AL CONFIGURAR TAREA" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "CONFIGURACIÓN MANUAL REQUERIDA:" -ForegroundColor Yellow
    Write-Host "1. Abrir Programador de tareas (Windows + R, luego taskschd.msc)" -ForegroundColor White
    Write-Host "2. Crear tarea básica" -ForegroundColor White
    Write-Host "3. Nombre: Sincronizacion ERP 22hs" -ForegroundColor White
    Write-Host "4. Desencadenador: Diario a las 22:00" -ForegroundColor White
    Write-Host "5. Acción: Iniciar programa" -ForegroundColor White
    Write-Host "6. Programa: sync_batch.bat" -ForegroundColor White
    Write-Host "7. Iniciar en: C:\Users\anabe\OneDrive\Documentos\semilleros-deitana-project\deitana-app" -ForegroundColor White
}

Write-Host ""
Read-Host "Presiona Enter para continuar" 