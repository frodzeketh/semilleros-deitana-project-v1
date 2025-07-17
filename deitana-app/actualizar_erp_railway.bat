@echo off
chcp 65001 >nul
echo ========================================
echo    SINCRONIZADOR ERP -> RAILWAY
echo ========================================
echo.

:: ==== CONFIGURACIÓN ====
set FECHA=%date:~6,4%-%date:~3,2%-%date:~0,2%
set HORA=%time:~0,2%:%time:~3,2%:%time:~6,2%
set DUMPFILE=erp_dump_%FECHA%_%HORA%.sql
set LOGFILE=sync_log_%FECHA%.txt

:: DATOS DE BASE LOCAL (ERP) - MODIFICAR SEGÚN TU CONFIGURACIÓN
set LOCAL_HOST=127.0.0.1
set LOCAL_PORT=3306
set LOCAL_USER=root
set LOCAL_PASS=tu_password_local
set LOCAL_DB=erp_global

:: DATOS DE BASE EN RAILWAY (desde db.js)
set REMOTE_HOST=centerbeam.proxy.rlwy.net
set REMOTE_PORT=32877
set REMOTE_USER=root
set REMOTE_PASS=gbrIerodvEYzzDQbgtlQjelgLaLlgPuf
set REMOTE_DB=railway

echo [%date% %time%] Iniciando sincronización... >> %LOGFILE%

echo === [1/4] Verificando conexión VPN ===
ping -n 1 %LOCAL_HOST% >nul 2>&1
if errorlevel 1 (
    echo ERROR: No se puede conectar al servidor local. Verificar VPN Sophos.
    echo [%date% %time%] ERROR: VPN no conectada >> %LOGFILE%
    goto :error
)
echo ✓ Conexión local verificada

echo === [2/4] Exportando base local (ERP) ===
echo [%date% %time%] Iniciando exportación... >> %LOGFILE%
mysqldump -h %LOCAL_HOST% -P %LOCAL_PORT% -u %LOCAL_USER% -p%LOCAL_PASS% %LOCAL_DB% --single-transaction --routines --triggers > %DUMPFILE% 2>> %LOGFILE%

if errorlevel 1 (
    echo ERROR: Falló la exportación de la base local
    echo [%date% %time%] ERROR: Falló exportación local >> %LOGFILE%
    goto :error
)
echo ✓ Exportación completada: %DUMPFILE%

echo === [3/4] Importando en base Railway ===
echo [%date% %time%] Iniciando importación a Railway... >> %LOGFILE%
mysql -h %REMOTE_HOST% -P %REMOTE_PORT% -u %REMOTE_USER% -p%REMOTE_PASS% %REMOTE_DB% < %DUMPFILE% 2>> %LOGFILE%

if errorlevel 1 (
    echo ERROR: Falló la importación a Railway
    echo [%date% %time%] ERROR: Falló importación Railway >> %LOGFILE%
    goto :error
)
echo ✓ Importación a Railway completada

echo === [4/4] Limpiando archivo temporal ===
del %DUMPFILE%
echo ✓ Archivo temporal eliminado

echo.
echo ========================================
echo    SINCRONIZACIÓN COMPLETADA
echo ========================================
echo ✓ Base de datos actualizada exitosamente
echo ✓ Fecha: %date% %time%
echo ✓ Log guardado en: %LOGFILE%
echo.

echo [%date% %time%] SINCRONIZACIÓN EXITOSA >> %LOGFILE%
echo ======================================== >> %LOGFILE%

goto :end

:error
echo.
echo ========================================
echo    ERROR EN SINCRONIZACIÓN
echo ========================================
echo ✗ Revisar log: %LOGFILE%
echo ✗ Verificar conexión VPN
echo ✗ Verificar credenciales
echo.

:end
echo Presiona cualquier tecla para cerrar...
pause >nul 