#!/bin/bash

# Script para configurar Nginx con SSL para la API puente
# Ejecutar como root

set -e

DOMAIN="$1"
EMAIL="$2"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "❌ Error: Debes proporcionar dominio y email"
    echo "Uso: $0 tu-dominio.com tu-email@ejemplo.com"
    echo ""
    echo "Ejemplo: $0 mysql-bridge.tu-dominio.com admin@tu-dominio.com"
    exit 1
fi

echo "🔒 Configurando Nginx con SSL para dominio: $DOMAIN"

# Verificar que Nginx está instalado
if ! command -v nginx &> /dev/null; then
    echo "❌ Nginx no está instalado"
    exit 1
fi

# Verificar que certbot está instalado
if ! command -v certbot &> /dev/null; then
    echo "❌ Certbot no está instalado"
    exit 1
fi

# Crear configuración básica de Nginx (sin SSL primero)
echo "📝 Creando configuración de Nginx..."
cat > "/etc/nginx/sites-available/$DOMAIN" << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    # Redirección para Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Redireccionar todo lo demás a HTTPS (se configurará después)
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}
EOF

# Habilitar sitio
ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/"

# Remover configuración por defecto si existe
if [ -f "/etc/nginx/sites-enabled/default" ]; then
    rm "/etc/nginx/sites-enabled/default"
fi

# Verificar configuración de Nginx
echo "🧪 Verificando configuración de Nginx..."
if nginx -t; then
    echo "✅ Configuración de Nginx válida"
else
    echo "❌ Error en configuración de Nginx"
    exit 1
fi

# Recargar Nginx
systemctl reload nginx

# Crear directorio para Let's Encrypt
mkdir -p /var/www/html/.well-known/acme-challenge/

# Configurar firewall para HTTP y HTTPS
echo "🔥 Configurando firewall..."
ufw allow 80/tcp
ufw allow 443/tcp

# Obtener certificado SSL con Let's Encrypt
echo "🔒 Obteniendo certificado SSL..."
if certbot certonly \
    --webroot \
    --webroot-path=/var/www/html \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --domains "$DOMAIN"; then
    
    echo "✅ Certificado SSL obtenido exitosamente!"
else
    echo "❌ Error obteniendo certificado SSL"
    echo "Verifica que:"
    echo "   1. El dominio $DOMAIN apunta a la IP de este VPS"
    echo "   2. Los puertos 80 y 443 están abiertos"
    echo "   3. No hay otros servicios usando el puerto 80"
    exit 1
fi

# Crear configuración completa con SSL
echo "🔒 Configurando HTTPS..."
cat > "/etc/nginx/sites-available/$DOMAIN" << EOF
# Redirección HTTP -> HTTPS
server {
    listen 80;
    server_name $DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# Configuración HTTPS
server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    
    # Certificados SSL
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # Configuración SSL moderna
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
    ssl_ecdh_curve secp384r1;
    ssl_session_timeout 10m;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;
    ssl_stapling on;
    ssl_stapling_verify on;
    
    # Headers de seguridad
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    
    # Configuración de proxy
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        # Buffer configuration
        proxy_buffering on;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }
    
    # Endpoint específico para health checks
    location /health {
        proxy_pass http://127.0.0.1:3000/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Permitir acceso sin autenticación para monitoreo
        access_log off;
    }
    
    # Logs
    access_log /var/log/nginx/$DOMAIN.access.log;
    error_log /var/log/nginx/$DOMAIN.error.log;
}
EOF

# Verificar nueva configuración
echo "🧪 Verificando nueva configuración..."
if nginx -t; then
    echo "✅ Configuración SSL válida"
else
    echo "❌ Error en configuración SSL"
    exit 1
fi

# Recargar Nginx
systemctl reload nginx

# Configurar renovación automática de certificados
echo "🔄 Configurando renovación automática de certificados..."
cat > "/etc/cron.d/certbot-$DOMAIN" << EOF
# Renovar certificado SSL para $DOMAIN
0 12 * * * root test -x /usr/bin/certbot && perl -e 'sleep int(rand(43200))' && certbot -q renew --post-hook "systemctl reload nginx"
EOF

# Test de la configuración
echo "🧪 Probando configuración HTTPS..."
sleep 2

if curl -s -I "https://$DOMAIN/health" | grep -q "200 OK"; then
    echo "✅ HTTPS configurado correctamente!"
    
    echo ""
    echo "🌐 API disponible en:"
    echo "   - Health check: https://$DOMAIN/health"
    echo "   - Endpoint principal: https://$DOMAIN/api"
    echo ""
    echo "🔒 SSL configurado con:"
    echo "   - Certificado Let's Encrypt válido"
    echo "   - Renovación automática configurada"
    echo "   - Headers de seguridad aplicados"
    echo "   - Redirección HTTP -> HTTPS"
    
else
    echo "⚠️  La configuración se completó pero el test HTTPS falló"
    echo "Esto puede ser normal si el dominio aún no propaga o el servicio Node.js no está ejecutándose"
    echo ""
    echo "Verificar:"
    echo "   - Estado del servicio: systemctl status mysql-bridge-api"
    echo "   - Logs de Nginx: tail -f /var/log/nginx/$DOMAIN.error.log"
    echo "   - Test manual: curl -I https://$DOMAIN/health"
fi

echo ""
echo "📋 Comandos útiles:"
echo "   - Ver logs de Nginx: tail -f /var/log/nginx/$DOMAIN.access.log"
echo "   - Renovar SSL manualmente: certbot renew --dry-run"
echo "   - Verificar SSL: openssl s_client -connect $DOMAIN:443"
echo "   - Test HTTPS: curl -I https://$DOMAIN/health"
echo ""
echo "🔒 Configuración de seguridad completada!"
