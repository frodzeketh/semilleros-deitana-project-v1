# Ayudante para encontrar información de VPN Sophos
# Este script te ayuda a identificar la configuración de tu VPN

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    AYUDANTE VPN SOPHOS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "🔍 PASO 1: Verificar conexión VPN" -ForegroundColor Yellow
Write-Host ""

# Verificar si hay conexiones VPN activas
$vpnConnections = Get-NetAdapter | Where-Object { $_.InterfaceDescription -like "*VPN*" -or $_.Name -like "*VPN*" }

if ($vpnConnections) {
    Write-Host "✅ Conexiones VPN detectadas:" -ForegroundColor Green
    foreach ($vpn in $vpnConnections) {
        Write-Host "   - $($vpn.Name) ($($vpn.Status))" -ForegroundColor White
    }
} else {
    Write-Host "❌ No se detectaron conexiones VPN activas" -ForegroundColor Red
    Write-Host "   Conecta la VPN Sophos y ejecuta este script nuevamente" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🔍 PASO 2: Información de red" -ForegroundColor Yellow
Write-Host ""

# Mostrar información de IP
$ipConfig = Get-NetIPAddress | Where-Object { $_.AddressFamily -eq "IPv4" -and $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.*" }

Write-Host "📡 Direcciones IP detectadas:" -ForegroundColor Green
foreach ($ip in $ipConfig) {
    $adapter = Get-NetAdapter -InterfaceIndex $ip.InterfaceIndex
    Write-Host "   - $($ip.IPAddress) ($($adapter.Name))" -ForegroundColor White
}

Write-Host ""
Write-Host "🔍 PASO 3: Buscar servidores ERP" -ForegroundColor Yellow
Write-Host ""

Write-Host "💡 CONSEJOS PARA ENCONTRAR EL SERVIDOR ERP:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. 📊 DESDE MYSQL WORKBENCH:" -ForegroundColor Green
Write-Host "   - Abre MySQL Workbench" -ForegroundColor White
Write-Host "   - Ve a 'Database' > 'Manage Connections'" -ForegroundColor White
Write-Host "   - En tu conexión existente, mira el campo 'Hostname'" -ForegroundColor White
Write-Host "   - Ese es tu servidor ERP" -ForegroundColor White
Write-Host ""
Write-Host "2. 🖥️  DESDE EL ADMINISTRADOR:" -ForegroundColor Green
Write-Host "   - Pregunta a tu administrador de sistemas" -ForegroundColor White
Write-Host "   - Ellos saben la IP del servidor ERP" -ForegroundColor White
Write-Host ""
Write-Host "3. 🔍 BUSCAR EN LA RED:" -ForegroundColor Green
Write-Host "   - Conecta la VPN Sophos" -ForegroundColor White
Write-Host "   - Abre CMD y ejecuta: ping [nombre-del-servidor]" -ForegroundColor White
Write-Host "   - O usa: nslookup [nombre-del-servidor]" -ForegroundColor White
Write-Host ""

Write-Host "🔍 PASO 4: Probar conexiones comunes" -ForegroundColor Yellow
Write-Host ""

# Lista de IPs comunes para probar
$commonIPs = @(
    "192.168.1.100",
    "192.168.1.101", 
    "192.168.0.100",
    "192.168.0.101",
    "10.0.0.100",
    "10.0.0.101",
    "172.16.0.100",
    "172.16.0.101"
)

Write-Host "🔍 Probando conexiones a IPs comunes..." -ForegroundColor Cyan

foreach ($ip in $commonIPs) {
    try {
        $ping = Test-Connection -ComputerName $ip -Count 1 -Quiet -TimeoutSeconds 2
        if ($ping) {
            Write-Host "   ✅ $ip - RESPONDE" -ForegroundColor Green
        }
    } catch {
        # Silenciar errores de timeout
    }
}

Write-Host ""
Write-Host "🔍 PASO 5: Información de MySQL" -ForegroundColor Yellow
Write-Host ""

Write-Host "💡 PARA ENCONTRAR CREDENCIALES MYSQL:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. 📊 DESDE MYSQL WORKBENCH:" -ForegroundColor Green
Write-Host "   - En tu conexión existente, mira:" -ForegroundColor White
Write-Host "     * Username (usuario)" -ForegroundColor White
Write-Host "     * Database (base de datos)" -ForegroundColor White
Write-Host "     * Port (puerto, normalmente 3306)" -ForegroundColor White
Write-Host ""
Write-Host "2. 🔐 CONTRASEÑA:" -ForegroundColor Green
Write-Host "   - Pregunta a tu administrador de sistemas" -ForegroundColor White
Write-Host "   - O revisa si la tienes guardada en algún lugar" -ForegroundColor White
Write-Host ""

Write-Host "📋 RESUMEN DE INFORMACIÓN NECESARIA:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Para configurar la sincronización necesitas:" -ForegroundColor White
Write-Host "1. IP del servidor ERP (ej: 192.168.1.100)" -ForegroundColor White
Write-Host "2. Puerto MySQL (normalmente 3306)" -ForegroundColor White
Write-Host "3. Usuario de la base de datos" -ForegroundColor White
Write-Host "4. Contraseña de la base de datos" -ForegroundColor White
Write-Host "5. Nombre de la base de datos ERP" -ForegroundColor White
Write-Host ""

Write-Host "🚀 PRÓXIMO PASO:" -ForegroundColor Green
Write-Host "Una vez que tengas esta información, ejecuta:" -ForegroundColor White
Write-Host "powershell.exe -ExecutionPolicy Bypass -File 'configurar_vpn_sophos.ps1'" -ForegroundColor Cyan
Write-Host ""

Write-Host "Presiona cualquier tecla para cerrar..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 