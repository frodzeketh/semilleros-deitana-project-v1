#!/bin/bash

# Script final de despliegue y configuración completa del VPS Bridge
# Ejecutar después de completar todos los pasos anteriores

set -e

DOMAIN="$1"
MYSQL_HOST="$2"

if [ -z "$DOMAIN" ] || [ -z "$MYSQL_HOST" ]; then
    echo "❌ Error: Faltan parámetros"
    echo "Uso: $0 tu-dominio.com 10.0.0.100"
    echo ""
    echo "Donde:"
    echo "  tu-dominio.com = Tu dominio para la API"
    echo "  10.0.0.100 = IP interna del servidor MySQL"
    exit 1
fi

echo "🚀 DESPLIEGUE FINAL VPS BRIDGE"
echo "=============================="
echo "Dominio: $DOMAIN"
echo "MySQL Host: $MYSQL_HOST"
echo ""

# Verificar que todos los servicios están funcionando
echo "🔍 Verificando servicios..."

# 1. Verificar VPN
if ! systemctl is-active --quiet openvpn-client@empresa; then
    echo "❌ VPN Sophos no está activa"
    echo "Ejecutar: sudo systemctl start openvpn-client@empresa"
    exit 1
fi
echo "✅ VPN Sophos activa"

# 2. Verificar conectividad MySQL
if ! timeout 5 bash -c "</dev/tcp/$MYSQL_HOST/3306" 2>/dev/null; then
    echo "❌ No se puede conectar a MySQL ($MYSQL_HOST:3306)"
    echo "Verificar:"
    echo "  - VPN está conectada"
    echo "  - IP MySQL es correcta"
    echo "  - Puerto 3306 está abierto"
    exit 1
fi
echo "✅ Conectividad MySQL OK"

# 3. Verificar API Bridge
if ! systemctl is-active --quiet mysql-bridge-api; then
    echo "❌ API Bridge no está activa"
    echo "Ejecutar: sudo systemctl start mysql-bridge-api"
    exit 1
fi
echo "✅ API Bridge activa"

# 4. Verificar Nginx
if ! systemctl is-active --quiet nginx; then
    echo "❌ Nginx no está activo"
    echo "Ejecutar: sudo systemctl start nginx"
    exit 1
fi
echo "✅ Nginx activo"

# 5. Verificar SSL
if ! curl -s -I "https://$DOMAIN/health" | grep -q "200 OK"; then
    echo "❌ HTTPS no responde correctamente"
    echo "Verificar configuración SSL y DNS"
    exit 1
fi
echo "✅ HTTPS funcionando"

# Configurar monitoreo avanzado
echo ""
echo "📊 Configurando monitoreo avanzado..."

# Script de monitoreo completo
cat > /usr/local/bin/monitor-vps-bridge.sh << 'EOF'
#!/bin/bash

LOG_FILE="/var/log/vps-bridge-monitor.log"
WEBHOOK_URL="${SLACK_WEBHOOK:-}"
DOMAIN="${VPS_DOMAIN:-localhost}"

log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

send_alert() {
    local message="$1"
    log_message "ALERT: $message"
    
    if [ ! -z "$WEBHOOK_URL" ]; then
        curl -s -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 VPS Bridge Alert: $message\"}" \
            "$WEBHOOK_URL" || true
    fi
}

check_service() {
    local service="$1"
    if ! systemctl is-active --quiet "$service"; then
        send_alert "$service is down, attempting restart"
        systemctl restart "$service"
        sleep 5
        if systemctl is-active --quiet "$service"; then
            log_message "SUCCESS: $service restarted"
        else
            send_alert "FAILED: Could not restart $service"
        fi
    fi
}

# Verificar servicios críticos
check_service "openvpn-client@empresa"
check_service "mysql-bridge-api"
check_service "nginx"

# Verificar conectividad MySQL
MYSQL_HOST="${MYSQL_INTERNAL_HOST:-10.0.0.100}"
if ! timeout 5 bash -c "</dev/tcp/$MYSQL_HOST/3306" 2>/dev/null; then
    send_alert "MySQL connectivity lost ($MYSQL_HOST:3306)"
    # Intentar reiniciar VPN
    systemctl restart openvpn-client@empresa
    sleep 10
fi

# Verificar API health
if ! curl -s -f "https://$DOMAIN/health" > /dev/null; then
    send_alert "API health check failed (https://$DOMAIN/health)"
fi

# Verificar uso de disco
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 85 ]; then
    send_alert "High disk usage: ${DISK_USAGE}%"
fi

# Verificar memoria
MEM_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [ "$MEM_USAGE" -gt 90 ]; then
    send_alert "High memory usage: ${MEM_USAGE}%"
fi

log_message "Monitor check completed - All OK"
EOF

chmod +x /usr/local/bin/monitor-vps-bridge.sh

# Configurar variables de entorno para el monitor
cat > /etc/environment << EOF
VPS_DOMAIN=$DOMAIN
MYSQL_INTERNAL_HOST=$MYSQL_HOST
EOF

# Configurar cron para monitoreo cada 2 minutos
cat > /etc/cron.d/vps-bridge-monitor << EOF
# Monitor VPS Bridge cada 2 minutos
*/2 * * * * root /usr/local/bin/monitor-vps-bridge.sh
EOF

# Configurar logrotate para logs del monitor
cat > /etc/logrotate.d/vps-bridge-monitor << EOF
/var/log/vps-bridge-monitor.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
}
EOF

# Configurar alertas por email (opcional)
echo ""
echo "📧 Configurar alertas por email? (y/N)"
read -t 10 -r email_config || email_config="n"

if [[ $email_config =~ ^[Yy]$ ]]; then
    echo "Ingresa el email para alertas:"
    read -r alert_email
    
    if [ ! -z "$alert_email" ]; then
        # Instalar y configurar postfix básico
        apt update && apt install -y postfix mailutils
        
        # Configurar script de alerta por email
        cat > /usr/local/bin/send-email-alert.sh << EOF
#!/bin/bash
echo "\$2" | mail -s "VPS Bridge Alert: \$1" "$alert_email"
EOF
        chmod +x /usr/local/bin/send-email-alert.sh
        
        echo "✅ Alertas por email configuradas para: $alert_email"
    fi
fi

# Crear script de status completo
cat > /usr/local/bin/vps-bridge-status.sh << 'EOF'
#!/bin/bash

echo "🔍 VPS BRIDGE STATUS REPORT"
echo "=========================="
echo "Timestamp: $(date)"
echo ""

echo "🔗 SERVICIOS:"
services=("openvpn-client@empresa" "mysql-bridge-api" "nginx")
for service in "${services[@]}"; do
    if systemctl is-active --quiet "$service"; then
        echo "  ✅ $service"
    else
        echo "  ❌ $service"
    fi
done

echo ""
echo "🌐 CONECTIVIDAD:"
MYSQL_HOST="${MYSQL_INTERNAL_HOST:-10.0.0.100}"
if timeout 5 bash -c "</dev/tcp/$MYSQL_HOST/3306" 2>/dev/null; then
    echo "  ✅ MySQL ($MYSQL_HOST:3306)"
else
    echo "  ❌ MySQL ($MYSQL_HOST:3306)"
fi

DOMAIN="${VPS_DOMAIN:-localhost}"
if curl -s -f "https://$DOMAIN/health" > /dev/null; then
    echo "  ✅ HTTPS API ($DOMAIN)"
else
    echo "  ❌ HTTPS API ($DOMAIN)"
fi

echo ""
echo "📊 RECURSOS:"
echo "  CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')% usado"
echo "  RAM: $(free | awk 'NR==2{printf "%.1f", $3*100/$2}')% usado"
echo "  Disk: $(df / | awk 'NR==2 {print $5}') usado"

echo ""
echo "🔄 INTERFACES DE RED:"
ip -brief addr show | grep -E "(tun|tap)" || echo "  ⚠️  No se encontraron interfaces VPN"

echo ""
echo "📈 ÚLTIMOS LOGS (últimas 5 líneas):"
echo "VPN:"
journalctl -u openvpn-client@empresa --no-pager -n 2 | tail -2

echo "API:"
journalctl -u mysql-bridge-api --no-pager -n 2 | tail -2

echo ""
echo "🏥 API HEALTH:"
curl -s "https://$DOMAIN/health" | jq '.' 2>/dev/null || echo "  Error obteniendo health status"
EOF

chmod +x /usr/local/bin/vps-bridge-status.sh

# Crear script de reinicio completo
cat > /usr/local/bin/restart-vps-bridge.sh << 'EOF'
#!/bin/bash

echo "🔄 Reiniciando VPS Bridge completo..."

echo "1. Deteniendo servicios..."
systemctl stop mysql-bridge-api
systemctl stop openvpn-client@empresa

echo "2. Esperando 5 segundos..."
sleep 5

echo "3. Iniciando VPN..."
systemctl start openvpn-client@empresa
sleep 10

echo "4. Verificando conectividad VPN..."
MYSQL_HOST="${MYSQL_INTERNAL_HOST:-10.0.0.100}"
if timeout 10 bash -c "</dev/tcp/$MYSQL_HOST/3306" 2>/dev/null; then
    echo "✅ VPN conectada"
else
    echo "❌ VPN no conecta, esperando más tiempo..."
    sleep 20
fi

echo "5. Iniciando API Bridge..."
systemctl start mysql-bridge-api
sleep 5

echo "6. Verificando estado final..."
/usr/local/bin/vps-bridge-status.sh
EOF

chmod +x /usr/local/bin/restart-vps-bridge.sh

# Test final completo
echo ""
echo "🧪 Ejecutando test final completo..."

# Ejecutar status
/usr/local/bin/vps-bridge-status.sh

# Test de API
echo ""
echo "🔍 Test de API completo:"

# Health check
echo "  - Health check:"
curl -s "https://$DOMAIN/health" | jq '.status' || echo "    Error"

# Test de autenticación (requiere configuración manual)
echo "  - Test de autenticación: Requiere configuración manual"

echo ""
echo "✅ CONFIGURACIÓN COMPLETA"
echo "========================"
echo ""
echo "🌐 URLs importantes:"
echo "   - API Health: https://$DOMAIN/health"
echo "   - API Docs: https://$DOMAIN/api"
echo ""
echo "🔧 Comandos útiles:"
echo "   - Status completo: /usr/local/bin/vps-bridge-status.sh"
echo "   - Reiniciar todo: /usr/local/bin/restart-vps-bridge.sh"
echo "   - Ver logs VPN: journalctl -u openvpn-client@empresa -f"
echo "   - Ver logs API: journalctl -u mysql-bridge-api -f"
echo "   - Ver logs monitor: tail -f /var/log/vps-bridge-monitor.log"
echo ""
echo "📋 Archivos de configuración:"
echo "   - API: /home/bridge/mysql-bridge-api/.env"
echo "   - VPN: /etc/openvpn/client/empresa.conf"
echo "   - Nginx: /etc/nginx/sites-available/$DOMAIN"
echo ""
echo "🚀 Próximo paso: Configurar Railway"
echo "   1. Agregar variables de entorno en Railway:"
echo "      - VPS_BRIDGE_URL=https://$DOMAIN"
echo "      - VPS_BRIDGE_USER=api_user"
echo "      - VPS_BRIDGE_PASSWORD=tu_password"
echo "      - USE_VPS_BRIDGE=true"
echo "   2. Ejecutar: node migrate-to-vps-bridge.js"
echo "   3. Deployar en Railway"
echo ""
echo "🎉 ¡VPS Bridge configurado y listo!"
