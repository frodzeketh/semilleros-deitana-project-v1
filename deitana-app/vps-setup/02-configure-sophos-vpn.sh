#!/bin/bash

# Script para configurar conexión Sophos VPN con auto-reconexión
# Ejecutar como root después de copiar el archivo .ovpn

set -e

VPN_NAME="empresa"
VPN_CONFIG_DIR="/etc/openvpn/client"
OVPN_FILE="$1"

if [ -z "$OVPN_FILE" ]; then
    echo "❌ Error: Debes proporcionar el archivo .ovpn"
    echo "Uso: $0 /path/to/archivo.ovpn [usuario] [contraseña]"
    exit 1
fi

if [ ! -f "$OVPN_FILE" ]; then
    echo "❌ Error: El archivo $OVPN_FILE no existe"
    exit 1
fi

echo "🔐 Configurando Sophos VPN..."

# Crear directorio de configuración
mkdir -p "$VPN_CONFIG_DIR"

# Copiar archivo de configuración
cp "$OVPN_FILE" "$VPN_CONFIG_DIR/$VPN_NAME.conf"
chmod 600 "$VPN_CONFIG_DIR/$VPN_NAME.conf"

# Si se proporcionan credenciales, crear archivo
if [ ! -z "$2" ] && [ ! -z "$3" ]; then
    echo "👤 Configurando credenciales..."
    cat > "$VPN_CONFIG_DIR/credenciales" << EOF
$2
$3
EOF
    chmod 600 "$VPN_CONFIG_DIR/credenciales"
    
    # Modificar archivo de configuración para usar credenciales
    if grep -q "auth-user-pass" "$VPN_CONFIG_DIR/$VPN_NAME.conf"; then
        sed -i "s/auth-user-pass.*/auth-user-pass \/etc\/openvpn\/client\/credenciales/" "$VPN_CONFIG_DIR/$VPN_NAME.conf"
    else
        echo "auth-user-pass /etc/openvpn/client/credenciales" >> "$VPN_CONFIG_DIR/$VPN_NAME.conf"
    fi
fi

# Agregar configuraciones para mejor estabilidad
cat >> "$VPN_CONFIG_DIR/$VPN_NAME.conf" << EOF

# Configuraciones adicionales para estabilidad
keepalive 10 120
persist-key
persist-tun
resolv-retry infinite
nobind
verb 3
EOF

# Crear servicio systemd con auto-restart
echo "🔄 Configurando servicio systemd con auto-reconexión..."
systemctl enable openvpn-client@$VPN_NAME

# Crear override para auto-restart
mkdir -p /etc/systemd/system/openvpn-client@$VPN_NAME.service.d
cat > /etc/systemd/system/openvpn-client@$VPN_NAME.service.d/override.conf << EOF
[Service]
Restart=always
RestartSec=10
StartLimitInterval=0
EOF

# Recargar systemd
systemctl daemon-reload

# Crear script de monitoreo de conectividad
cat > /usr/local/bin/check-vpn-connection.sh << 'EOF'
#!/bin/bash

VPN_NAME="empresa"
LOG_FILE="/var/log/vpn-monitor.log"
MYSQL_HOST="${MYSQL_INTERNAL_HOST:-10.0.0.100}"  # IP interna del MySQL

# Función para log con timestamp
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

# Verificar si la interfaz VPN está activa
if ! ip link show | grep -q tun; then
    log_message "ERROR: Interfaz VPN no encontrada"
    systemctl restart openvpn-client@$VPN_NAME
    exit 1
fi

# Verificar conectividad al MySQL interno
if ! timeout 5 bash -c "</dev/tcp/$MYSQL_HOST/3306" 2>/dev/null; then
    log_message "ERROR: No se puede conectar a MySQL interno ($MYSQL_HOST:3306)"
    systemctl restart openvpn-client@$VPN_NAME
    exit 1
fi

# Todo OK
log_message "OK: VPN y MySQL conectados correctamente"
exit 0
EOF

chmod +x /usr/local/bin/check-vpn-connection.sh

# Crear cron job para monitoreo cada 2 minutos
echo "⏰ Configurando monitoreo automático..."
(crontab -l 2>/dev/null; echo "*/2 * * * * /usr/local/bin/check-vpn-connection.sh") | crontab -

# Configurar logrotate para logs del monitor
cat > /etc/logrotate.d/vpn-monitor << EOF
/var/log/vpn-monitor.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
}
EOF

echo "✅ Configuración de VPN completada!"
echo ""
echo "🚀 Iniciando servicio VPN..."
systemctl start openvpn-client@$VPN_NAME

# Esperar unos segundos y verificar estado
sleep 10
if systemctl is-active --quiet openvpn-client@$VPN_NAME; then
    echo "✅ Servicio VPN iniciado correctamente"
    
    # Mostrar información de la interfaz
    echo ""
    echo "📊 Estado de la conexión:"
    ip addr show | grep -A 5 tun || echo "⚠️  Interfaz tun no encontrada aún (puede tardar unos segundos)"
    
    echo ""
    echo "📋 Comandos útiles:"
    echo "- Ver estado: systemctl status openvpn-client@$VPN_NAME"
    echo "- Ver logs: journalctl -u openvpn-client@$VPN_NAME -f"
    echo "- Reiniciar: systemctl restart openvpn-client@$VPN_NAME"
    echo "- Ver monitoreo: tail -f /var/log/vpn-monitor.log"
else
    echo "❌ Error: El servicio VPN no se pudo iniciar"
    echo "Ver logs: journalctl -u openvpn-client@$VPN_NAME"
    exit 1
fi
