#!/bin/bash

# Script para configurar VPS Ubuntu 22.04/24.04 como puente para base de datos MySQL
# Ejecutar como root o con sudo

set -e

echo "🚀 Iniciando configuración del VPS puente para MySQL..."

# Actualizar sistema
echo "📦 Actualizando sistema..."
apt update && apt upgrade -y

# Instalar herramientas esenciales
echo "🔧 Instalando herramientas básicas..."
apt install -y \
    openvpn \
    mysql-client \
    ufw \
    nginx \
    certbot \
    python3-certbot-nginx \
    curl \
    wget \
    git \
    htop \
    nano \
    unzip \
    fail2ban \
    logrotate

# Instalar Node.js 20.x LTS
echo "🟢 Instalando Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verificar instalaciones
echo "✅ Verificando instalaciones..."
echo "OpenVPN: $(openvpn --version | head -1)"
echo "MySQL Client: $(mysql --version)"
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"

# Configurar usuario no-root si no existe
if ! id "bridge" &>/dev/null; then
    echo "👤 Creando usuario 'bridge'..."
    useradd -m -s /bin/bash bridge
    usermod -aG sudo bridge
    
    # Configurar SSH key para el usuario bridge
    mkdir -p /home/bridge/.ssh
    chmod 700 /home/bridge/.ssh
    chown bridge:bridge /home/bridge/.ssh
    
    echo "⚠️  IMPORTANTE: Configura las SSH keys para el usuario 'bridge'"
    echo "   Copia tu clave pública a /home/bridge/.ssh/authorized_keys"
fi

# Configurar firewall básico
echo "🔥 Configurando firewall UFW..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 443/tcp  # Para API HTTPS
ufw --force enable

echo "✅ Configuración básica completada!"
echo ""
echo "📋 Próximos pasos:"
echo "1. Configurar SSH keys para usuario 'bridge'"
echo "2. Obtener archivo .ovpn de Sophos"
echo "3. Ejecutar script de configuración VPN"
echo ""
echo "🔒 Seguridad configurada:"
echo "- Firewall UFW activo (solo SSH y HTTPS)"
echo "- Usuario no-root 'bridge' creado"
echo "- Fail2ban instalado"
