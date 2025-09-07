#!/bin/bash

# Script para configurar la API puente en el VPS
# Ejecutar como usuario 'bridge' (no root)

set -e

API_DIR="/home/bridge/mysql-bridge-api"
SERVICE_NAME="mysql-bridge-api"

echo "🚀 Configurando API puente MySQL..."

# Verificar que estamos ejecutando como usuario bridge
if [ "$USER" != "bridge" ]; then
    echo "❌ Este script debe ejecutarse como usuario 'bridge'"
    echo "Ejecuta: sudo su - bridge"
    exit 1
fi

# Crear directorio de la aplicación
echo "📁 Creando directorio de la aplicación..."
mkdir -p "$API_DIR"
cd "$API_DIR"

# Verificar que tenemos los archivos necesarios
if [ ! -f "package.json" ]; then
    echo "❌ Error: No se encontró package.json"
    echo "Asegúrate de haber copiado todos los archivos de api-bridge/ al VPS"
    exit 1
fi

# Instalar dependencias de Node.js
echo "📦 Instalando dependencias de Node.js..."
npm install --production

# Crear directorio de logs
echo "📝 Configurando logs..."
sudo mkdir -p /var/log/mysql-bridge
sudo chown bridge:bridge /var/log/mysql-bridge
sudo chmod 755 /var/log/mysql-bridge

# Crear archivo .env si no existe
if [ ! -f ".env" ]; then
    echo "⚙️  Creando archivo .env..."
    cp env.example .env
    
    echo ""
    echo "📝 IMPORTANTE: Edita el archivo .env con la configuración correcta:"
    echo "   nano $API_DIR/.env"
    echo ""
    echo "Variables que debes configurar:"
    echo "   - MYSQL_HOST (IP interna del MySQL, ej: 10.0.0.100)"
    echo "   - MYSQL_USER (usuario de solo lectura)"
    echo "   - MYSQL_PASSWORD"
    echo "   - MYSQL_DATABASE"
    echo "   - JWT_SECRET (genera uno seguro)"
    echo "   - API_PASSWORD (para generar tokens)"
    echo "   - ALLOWED_ORIGINS (dominio de Railway)"
    echo ""
    read -p "Presiona Enter cuando hayas configurado el .env..." </dev/tty
fi

# Test de conexión
echo "🧪 Probando conexión a MySQL..."
if node test-connection.js; then
    echo "✅ Conexión a MySQL exitosa!"
else
    echo "❌ Error en conexión a MySQL. Verifica:"
    echo "   1. La VPN Sophos está conectada"
    echo "   2. La configuración en .env es correcta"
    echo "   3. El usuario MySQL tiene permisos"
    exit 1
fi

# Crear servicio systemd
echo "🔧 Configurando servicio systemd..."
sudo tee "/etc/systemd/system/$SERVICE_NAME.service" > /dev/null << EOF
[Unit]
Description=MySQL Bridge API Service
Documentation=https://github.com/tu-usuario/mysql-bridge-api
After=network.target openvpn-client@empresa.service
Wants=openvpn-client@empresa.service

[Service]
Type=simple
User=bridge
Group=bridge
WorkingDirectory=$API_DIR
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
ExecReload=/bin/kill -HUP \$MAINPID
Restart=always
RestartSec=5
StartLimitInterval=0
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

# Configuración de seguridad
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/mysql-bridge $API_DIR

[Install]
WantedBy=multi-user.target
EOF

# Habilitar y iniciar servicio
echo "🚀 Iniciando servicio..."
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl start "$SERVICE_NAME"

# Verificar estado del servicio
sleep 3
if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "✅ Servicio $SERVICE_NAME iniciado correctamente!"
    
    # Mostrar logs recientes
    echo ""
    echo "📊 Logs recientes:"
    sudo journalctl -u "$SERVICE_NAME" --no-pager -n 10
    
    # Test de health check
    echo ""
    echo "🏥 Probando health check..."
    sleep 2
    if curl -s http://localhost:3000/health > /dev/null; then
        echo "✅ Health check exitoso!"
        echo ""
        echo "🌐 API disponible en:"
        echo "   - Health check: http://localhost:3000/health"
        echo "   - Documentación: http://localhost:3000/api"
    else
        echo "⚠️  Health check falló, pero el servicio está ejecutándose"
    fi
else
    echo "❌ Error: El servicio no se pudo iniciar"
    echo ""
    echo "Ver logs de error:"
    sudo journalctl -u "$SERVICE_NAME" --no-pager -n 20
    exit 1
fi

echo ""
echo "📋 Comandos útiles:"
echo "   - Ver estado: sudo systemctl status $SERVICE_NAME"
echo "   - Ver logs: sudo journalctl -u $SERVICE_NAME -f"
echo "   - Reiniciar: sudo systemctl restart $SERVICE_NAME"
echo "   - Parar: sudo systemctl stop $SERVICE_NAME"
echo ""
echo "📁 Archivos importantes:"
echo "   - Configuración: $API_DIR/.env"
echo "   - Logs: /var/log/mysql-bridge/"
echo "   - Servicio: /etc/systemd/system/$SERVICE_NAME.service"
echo ""
echo "🔒 Próximo paso: Configurar SSL/HTTPS con Nginx"
