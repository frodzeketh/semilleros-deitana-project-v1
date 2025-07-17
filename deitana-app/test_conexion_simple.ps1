# Test simple de conexión ERP
# Script para probar la conexión con los datos proporcionados

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    TEST DE CONEXIÓN ERP" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Datos de conexión
$hostname = "10.120.1.5"
$port = "3306"
$username = "deitana"
$password = "D31tana!"
$database = "erp_global"

Write-Host "🔍 PASO 1: Verificar herramientas" -ForegroundColor Yellow

# Verificar mysqldump
try {
    $mysqldumpVersion = & mysqldump -V 2>&1
    Write-Host "✅ mysqldump encontrado: $mysqldumpVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ mysqldump no encontrado" -ForegroundColor Red
    Write-Host "Instalar MySQL Client o agregar al PATH" -ForegroundColor Yellow
    exit 1
}

# Verificar mysql
try {
    $mysqlVersion = & mysql -V 2>&1
    Write-Host "✅ mysql encontrado: $mysqlVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ mysql no encontrado" -ForegroundColor Red
    Write-Host "Instalar MySQL Client o agregar al PATH" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "🔍 PASO 2: Verificar conexión VPN" -ForegroundColor Yellow

try {
    $ping = Test-Connection -ComputerName $hostname -Count 1 -Quiet
    if ($ping) {
        Write-Host "✅ Conexión VPN exitosa - Servidor ERP alcanzable" -ForegroundColor Green
    } else {
        Write-Host "❌ No se puede conectar al servidor ERP" -ForegroundColor Red
        Write-Host "Verificar:" -ForegroundColor Yellow
        Write-Host "1. VPN Sophos conectada" -ForegroundColor White
        Write-Host "2. IP del servidor correcta: $hostname" -ForegroundColor White
        Write-Host "3. Servidor ERP encendido" -ForegroundColor White
        exit 1
    }
} catch {
    Write-Host "❌ Error al probar conexión VPN" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔍 PASO 3: Probar conexión MySQL" -ForegroundColor Yellow

try {
    $testQuery = "SELECT 1 as test;"
    $mysqlArgs = @("-h", $hostname, "-P", $port, "-u", $username, "-p$password", "-e", $testQuery)
    
    $result = & mysql @mysqlArgs 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Conexión MySQL exitosa" -ForegroundColor Green
        Write-Host "Resultado: $result" -ForegroundColor Gray
    } else {
        Write-Host "❌ Error en conexión MySQL" -ForegroundColor Red
        Write-Host "Error: $result" -ForegroundColor Red
        Write-Host "Verificar credenciales:" -ForegroundColor Yellow
        Write-Host "Hostname: $hostname" -ForegroundColor White
        Write-Host "Port: $port" -ForegroundColor White
        Write-Host "Username: $username" -ForegroundColor White
        Write-Host "Database: $database" -ForegroundColor White
        exit 1
    }
} catch {
    Write-Host "❌ Error al ejecutar test MySQL" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔍 PASO 4: Probar conexión Railway" -ForegroundColor Yellow

try {
    $railwayHost = "centerbeam.proxy.rlwy.net"
    $railwayPort = "32877"
    $railwayUser = "root"
    $railwayPass = "gbrIerodvEYzzDQbgtlQjelgLaLlgPuf"
    $railwayDb = "railway"
    
    $railwayArgs = @("-h", $railwayHost, "-P", $railwayPort, "-u", $railwayUser, "-p$railwayPass", "-e", $testQuery)
    
    $railwayResult = & mysql @railwayArgs 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Conexión Railway exitosa" -ForegroundColor Green
    } else {
        Write-Host "❌ Error en conexión Railway" -ForegroundColor Red
        Write-Host "Error: $railwayResult" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error al ejecutar test Railway" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "    TEST COMPLETADO EXITOSAMENTE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ Todas las conexiones funcionan correctamente" -ForegroundColor Green
Write-Host "✅ Puedes proceder con la sincronización" -ForegroundColor Green
Write-Host ""

Write-Host "🚀 PRÓXIMO PASO:" -ForegroundColor Cyan
Write-Host "Ejecutar sincronización completa:" -ForegroundColor White
Write-Host "powershell.exe -ExecutionPolicy Bypass -File 'sync_erp_railway.ps1'" -ForegroundColor Gray
Write-Host ""

Read-Host "Presiona Enter para continuar" 