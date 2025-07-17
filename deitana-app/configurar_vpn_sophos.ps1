# Configurador de VPN Sophos para Sincronización ERP
# Este script te ayuda a configurar tu conexión VPN específica

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    CONFIGURADOR VPN SOPHOS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "🔍 PASO 1: Obtener información de tu VPN Sophos" -ForegroundColor Yellow
Write-Host ""

Write-Host "Para configurar correctamente la sincronización, necesito:" -ForegroundColor White
Write-Host "1. La IP del servidor ERP dentro de la VPN" -ForegroundColor White
Write-Host "2. Las credenciales de la base de datos ERP" -ForegroundColor White
Write-Host "3. El nombre de la base de datos ERP" -ForegroundColor White
Write-Host ""

Write-Host "📋 INFORMACIÓN QUE NECESITO:" -ForegroundColor Green
Write-Host ""

# Solicitar información de VPN
$vpnServerIP = Read-Host "¿Cuál es la IP del servidor ERP en la VPN? (ej: 192.168.1.100)"
$vpnServerPort = Read-Host "¿Cuál es el puerto MySQL del servidor ERP? (Enter para 3306)"
if (-not $vpnServerPort) { $vpnServerPort = "3306" }

$erpDatabase = Read-Host "¿Cuál es el nombre de la base de datos ERP? (ej: erp_global)"
$erpUser = Read-Host "¿Cuál es el usuario de la base de datos ERP? (Enter para root)"
if (-not $erpUser) { $erpUser = "root" }

$erpPassword = Read-Host "¿Cuál es la contraseña de la base de datos ERP?" -AsSecureString
$erpPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($erpPassword))

Write-Host ""
Write-Host "🔧 PASO 2: Crear configuración personalizada" -ForegroundColor Yellow
Write-Host ""

# Crear archivo de configuración personalizado
$configContent = @"
[LOCAL_DATABASE]
# Configuración de la base de datos ERP a través de VPN Sophos
HOST=$vpnServerIP
PORT=$vpnServerPort
USER=$erpUser
PASSWORD=$erpPasswordPlain
DATABASE=$erpDatabase

[RAILWAY_DATABASE]
# Configuración de Railway (desde db.js)
HOST=centerbeam.proxy.rlwy.net
PORT=32877
USER=root
PASSWORD=gbrIerodvEYzzDQbgtlQjelgLaLlgPuf
DATABASE=railway

[SYNC_SETTINGS]
# Configuración de sincronización
BACKUP_RETENTION_DAYS=7
LOG_RETENTION_DAYS=30
COMPRESS_DUMP=true
VPN_REQUIRED=true
"@

$configContent | Out-File -FilePath "config_sync.ini" -Encoding UTF8

Write-Host "✅ Configuración creada en config_sync.ini" -ForegroundColor Green
Write-Host ""

Write-Host "🧪 PASO 3: Probar conexión VPN" -ForegroundColor Yellow
Write-Host ""

Write-Host "IMPORTANTE: Asegúrate de estar conectado a la VPN Sophos antes de continuar" -ForegroundColor Red
Write-Host ""

$testVPN = Read-Host "¿Estás conectado a la VPN Sophos? (s/N)"
if ($testVPN -eq "s" -or $testVPN -eq "S") {
    Write-Host "Probando conexión al servidor ERP..." -ForegroundColor Cyan
    
    try {
        $ping = Test-Connection -ComputerName $vpnServerIP -Count 1 -Quiet
        if ($ping) {
            Write-Host "✅ Conexión VPN exitosa - Servidor ERP alcanzable" -ForegroundColor Green
        } else {
            Write-Host "❌ No se puede conectar al servidor ERP" -ForegroundColor Red
            Write-Host "Verificar:" -ForegroundColor Yellow
            Write-Host "1. VPN Sophos conectada" -ForegroundColor White
            Write-Host "2. IP del servidor correcta" -ForegroundColor White
            Write-Host "3. Servidor ERP encendido" -ForegroundColor White
        }
    } catch {
        Write-Host "❌ Error al probar conexión VPN" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️  Conecta la VPN Sophos y ejecuta el script nuevamente" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📋 PRÓXIMOS PASOS:" -ForegroundColor Cyan
Write-Host "1. Conectar VPN Sophos" -ForegroundColor White
Write-Host "2. Probar sincronización: powershell.exe -ExecutionPolicy Bypass -File 'sync_erp_railway.ps1' -Test" -ForegroundColor White
Write-Host "3. Configurar automatización: powershell.exe -ExecutionPolicy Bypass -File 'configurar_tarea_programada.ps1'" -ForegroundColor White
Write-Host ""

Write-Host "💡 CONSEJOS:" -ForegroundColor Green
Write-Host "- La VPN debe estar conectada para que funcione la sincronización" -ForegroundColor White
Write-Host "- El script verificará automáticamente la conexión VPN" -ForegroundColor White
Write-Host "- Los logs te dirán si hay problemas de conectividad" -ForegroundColor White
Write-Host ""

Write-Host "¿Necesitas ayuda para encontrar la IP del servidor ERP?" -ForegroundColor Yellow
$helpIP = Read-Host "¿Quieres que te ayude a encontrarla? (s/N)"

if ($helpIP -eq "s" -or $helpIP -eq "S") {
    Write-Host ""
    Write-Host "🔍 CÓMO ENCONTRAR LA IP DEL SERVIDOR ERP:" -ForegroundColor Cyan
    Write-Host "1. Conecta la VPN Sophos" -ForegroundColor White
    Write-Host "2. Abre MySQL Workbench" -ForegroundColor White
    Write-Host "3. En la conexión existente, mira la IP/hostname" -ForegroundColor White
    Write-Host "4. O pregunta a tu administrador de sistemas" -ForegroundColor White
    Write-Host "5. También puedes usar: ipconfig en CMD para ver tu IP en la VPN" -ForegroundColor White
} 