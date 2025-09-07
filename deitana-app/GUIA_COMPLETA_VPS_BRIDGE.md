# 🌉 GUÍA COMPLETA VPS BRIDGE PARA MYSQL

Esta guía te llevará paso a paso para configurar un servidor puente VPS que conecte tu aplicación Railway con la base de datos MySQL del cliente vía VPN Sophos.

## 📋 Resumen de la Solución

```
[Railway App] → [VPS Bridge API] ⇄ [VPN Sophos] ⇄ [MySQL Cliente]
```

**Problema resuelto**: Acceso 24/7 a base de datos MySQL detrás de VPN corporativa sin conexión manual.

## 🎯 Lo que vas a lograr

- ✅ Conexión automática 24/7 sin intervención manual
- ✅ API REST segura con SSL y autenticación JWT
- ✅ Monitoreo y auto-recuperación completa
- ✅ Cache inteligente para optimizar rendimiento
- ✅ Logs detallados y sistema de alertas
- ✅ Migración gradual sin interrumpir el servicio actual

## 🔧 Prerrequisitos

1. **VPS con IP pública fija** (Digital Ocean, AWS Lightsail, etc.)
2. **Archivo .ovpn de Sophos** (descargado desde el portal del cliente)
3. **Credenciales MySQL** del cliente (usuario de solo lectura recomendado)
4. **Dominio** para el VPS (ej: `mysql-bridge.tu-dominio.com`)

## 📁 Estructura de Archivos

```
vps-setup/
├── 01-install-basics.sh           # Instalación base del VPS
├── 02-configure-sophos-vpn.sh     # Configuración VPN Sophos
├── 03-setup-api-bridge.sh         # API Bridge Node.js
├── 04-configure-nginx-ssl.sh      # Nginx + SSL automático
├── 05-final-deployment.sh         # Configuración final y monitoreo
└── api-bridge/                    # Código de la API Bridge
    ├── package.json
    ├── server.js
    ├── middleware/
    ├── utils/
    └── env.example

railway-integration/
├── vps-bridge-client.js           # Cliente para Railway
├── db-bridge.js                   # Nuevo sistema de DB
├── migrate-to-vps-bridge.js       # Script de migración
└── env-railway.example            # Variables de entorno Railway
```

---

## 🚀 FASE 1: Configuración del VPS

### Paso 1.1: Configurar VPS Básico

```bash
# En tu VPS Ubuntu 22.04/24.04 como root
wget https://raw.githubusercontent.com/tu-repo/vps-setup/main/01-install-basics.sh
chmod +x 01-install-basics.sh
./01-install-basics.sh
```

**Qué hace este script:**
- Instala OpenVPN, MySQL client, Node.js 20, Nginx
- Configura usuario `bridge` no-root
- Configura firewall UFW (solo SSH y HTTPS)
- Instala fail2ban para seguridad

### Paso 1.2: Configurar SSH y Acceso

```bash
# Desde tu máquina local, copia tu clave SSH
ssh-copy-id bridge@tu-vps-ip

# Prueba acceso sin contraseña
ssh bridge@tu-vps-ip
```

---

## 🔐 FASE 2: Configuración VPN Sophos

### Paso 2.1: Obtener Archivo .ovpn

1. Accede al portal Sophos de tu cliente
2. Ve a "SSL VPN" → "Download Configuration"
3. Selecciona "For Windows, macOS, Linux"
4. Descarga el archivo `.ovpn`

### Paso 2.2: Configurar VPN en VPS

```bash
# Copiar archivo .ovpn al VPS
scp empresa.ovpn bridge@tu-vps-ip:~/

# En el VPS como root
sudo su -
cd /home/bridge
chmod +x 02-configure-sophos-vpn.sh

# Ejecutar (reemplaza con tus credenciales)
./02-configure-sophos-vpn.sh empresa.ovpn usuario_vpn contraseña_vpn
```

### Paso 2.3: Verificar Conexión VPN

```bash
# Verificar que la VPN está conectada
sudo systemctl status openvpn-client@empresa

# Ver interfaz VPN
ip addr show | grep tun

# Probar conectividad a MySQL interno
ping 10.x.y.z  # IP interna del MySQL
telnet 10.x.y.z 3306
```

---

## 🔧 FASE 3: API Bridge

### Paso 3.1: Copiar Código de la API

```bash
# En tu VPS como usuario bridge
cd ~
git clone https://github.com/tu-repo/mysql-bridge-api.git
# O copiar manualmente los archivos de api-bridge/

cd mysql-bridge-api
```

### Paso 3.2: Configurar Variables de Entorno

```bash
# Copiar archivo de ejemplo
cp env.example .env

# Editar configuración
nano .env
```

**Variables críticas a configurar:**
```env
MYSQL_HOST=10.x.y.z              # IP interna del MySQL
MYSQL_PORT=3306
MYSQL_USER=readonly_user          # Usuario de solo lectura
MYSQL_PASSWORD=secure_password
MYSQL_DATABASE=empresa_db
JWT_SECRET=super_secret_muy_largo_y_seguro
API_PASSWORD=password_para_generar_tokens
```

### Paso 3.3: Instalar y Configurar API

```bash
# Ejecutar script de configuración
chmod +x ../03-setup-api-bridge.sh
../03-setup-api-bridge.sh
```

**Qué hace este script:**
- Instala dependencias Node.js
- Crea servicio systemd con auto-restart
- Configura logs rotativos
- Ejecuta test de conexión MySQL
- Inicia la API en puerto 3000

---

## 🔒 FASE 4: SSL y Nginx

### Paso 4.1: Configurar DNS

Configura tu dominio para que apunte a la IP del VPS:
```
A    mysql-bridge.tu-dominio.com    →    tu-vps-ip
```

### Paso 4.2: Configurar SSL Automático

```bash
# Como root
sudo su -
cd /home/bridge

# Ejecutar configuración SSL (reemplaza con tu dominio y email)
./04-configure-nginx-ssl.sh mysql-bridge.tu-dominio.com admin@tu-dominio.com
```

**Qué hace este script:**
- Configura Nginx como reverse proxy
- Obtiene certificado SSL de Let's Encrypt automáticamente
- Configura renovación automática
- Aplica headers de seguridad
- Configura redirección HTTP → HTTPS

### Paso 4.3: Verificar HTTPS

```bash
# Test de HTTPS
curl -I https://mysql-bridge.tu-dominio.com/health

# Debería retornar: HTTP/2 200
```

---

## 📊 FASE 5: Monitoreo y Configuración Final

### Paso 5.1: Configuración Final

```bash
# Como root, ejecutar configuración final
sudo su -
cd /home/bridge

# Ejecutar (reemplaza con tu dominio y IP MySQL)
./05-final-deployment.sh mysql-bridge.tu-dominio.com 10.x.y.z
```

**Qué configura:**
- Monitoreo automático cada 2 minutos
- Alertas por Slack/email (opcional)
- Scripts de status y reinicio
- Health checks avanzados
- Limpieza automática de logs

### Paso 5.2: Verificar Sistema Completo

```bash
# Status completo
/usr/local/bin/vps-bridge-status.sh

# Test de API completo
curl -s https://mysql-bridge.tu-dominio.com/health | jq
```

---

## 🚢 FASE 6: Integración con Railway

### Paso 6.1: Preparar Código de Railway

Copia estos archivos a tu proyecto Railway:
- `server/vps-bridge-client.js`
- `server/db-bridge.js`
- `migrate-to-vps-bridge.js`
- `env-railway.example`

### Paso 6.2: Configurar Variables en Railway

En el dashboard de Railway, agrega estas variables:

```env
VPS_BRIDGE_URL=https://mysql-bridge.tu-dominio.com
VPS_BRIDGE_USER=api_user
VPS_BRIDGE_PASSWORD=tu_password_configurado_en_vps
USE_VPS_BRIDGE=true
FALLBACK_TO_DIRECT=true
```

### Paso 6.3: Ejecutar Migración

```bash
# En tu proyecto Railway local
npm install axios

# Ejecutar test de migración
node migrate-to-vps-bridge.js

# Si todo pasa, ejecutar migración automática
node migrate-to-vps-bridge.js --auto-migrate
```

### Paso 6.4: Deploy en Railway

```bash
# Hacer commit y push
git add .
git commit -m "Implement VPS Bridge connection"
git push origin main

# Railway detectará los cambios y hará redeploy automáticamente
```

---

## 🔍 VERIFICACIÓN Y TESTING

### Test de Conectividad Completa

```bash
# 1. En el VPS - verificar todo esté funcionando
/usr/local/bin/vps-bridge-status.sh

# 2. Test de API desde fuera del VPS
curl -s "https://mysql-bridge.tu-dominio.com/health"

# 3. Test de autenticación
curl -X POST "https://mysql-bridge.tu-dominio.com/auth/token" \
  -H "Content-Type: application/json" \
  -d '{"username": "api_user", "password": "tu_password"}'

# 4. Test de consulta SQL (con token obtenido)
curl -X POST "https://mysql-bridge.tu-dominio.com/api/query" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tu_token_jwt" \
  -d '{"sql": "SELECT DATABASE(), NOW()"}'
```

### Test desde Railway

Una vez deployado, verifica en los logs de Railway que aparezcan mensajes como:
```
✅ [VPS-BRIDGE] Autenticación exitosa
✅ [VPS-BRIDGE] Consulta exitosa: 10 filas, 45ms
💾 [VPS-BRIDGE] Cache hit
```

---

## 🛠️ COMANDOS ÚTILES

### En el VPS

```bash
# Status completo del sistema
/usr/local/bin/vps-bridge-status.sh

# Reiniciar todo el sistema
/usr/local/bin/restart-vps-bridge.sh

# Ver logs en tiempo real
journalctl -u openvpn-client@empresa -f        # VPN
journalctl -u mysql-bridge-api -f              # API
tail -f /var/log/vps-bridge-monitor.log        # Monitor

# Reiniciar servicios individuales
sudo systemctl restart openvpn-client@empresa  # VPN
sudo systemctl restart mysql-bridge-api        # API
sudo systemctl restart nginx                   # Web server

# Test de conectividad MySQL
mysql -h 10.x.y.z -u usuario -p -e "SELECT 1"
```

### En Railway

```bash
# Ver logs de la aplicación
railway logs

# Test local de migración
node migrate-to-vps-bridge.js

# Rollback si hay problemas
node migrate-to-vps-bridge.js --rollback
```

---

## 🚨 TROUBLESHOOTING

### Problema: VPN no conecta

```bash
# Ver logs de VPN
journalctl -u openvpn-client@empresa -n 50

# Verificar archivo de configuración
sudo cat /etc/openvpn/client/empresa.conf

# Reiniciar VPN manualmente
sudo systemctl restart openvpn-client@empresa

# Test manual de VPN
sudo openvpn --config /etc/openvpn/client/empresa.conf
```

### Problema: No se puede conectar a MySQL

```bash
# Verificar VPN está activa
ip addr show | grep tun

# Test de conectividad
ping 10.x.y.z
telnet 10.x.y.z 3306

# Verificar credenciales
mysql -h 10.x.y.z -u usuario -p
```

### Problema: SSL no funciona

```bash
# Verificar DNS
nslookup mysql-bridge.tu-dominio.com

# Verificar certificado
openssl s_client -connect mysql-bridge.tu-dominio.com:443

# Renovar certificado manualmente
sudo certbot renew --dry-run

# Ver logs de Nginx
tail -f /var/log/nginx/error.log
```

### Problema: API no responde

```bash
# Verificar servicio
sudo systemctl status mysql-bridge-api

# Ver logs de la API
journalctl -u mysql-bridge-api -n 50

# Test directo en puerto 3000
curl http://localhost:3000/health

# Verificar configuración
cat /home/bridge/mysql-bridge-api/.env
```

### Problema: Railway no conecta al VPS

1. Verificar variables de entorno en Railway dashboard
2. Verificar que `VPS_BRIDGE_URL` esté correcto
3. Test manual desde local:
   ```bash
   curl -X POST "https://mysql-bridge.tu-dominio.com/auth/token" \
     -H "Content-Type: application/json" \
     -d '{"username": "api_user", "password": "tu_password"}'
   ```

---

## 🔧 MANTENIMIENTO

### Actualización de la API

```bash
# En el VPS
cd /home/bridge/mysql-bridge-api
git pull origin main
npm install
sudo systemctl restart mysql-bridge-api
```

### Actualización del Sistema

```bash
# Actualizar VPS
sudo apt update && sudo apt upgrade -y

# Reiniciar si es necesario
sudo reboot

# Verificar que todo funcione después del reinicio
/usr/local/bin/vps-bridge-status.sh
```

### Backup de Configuración

```bash
# Crear backup completo
sudo tar -czf vps-bridge-backup-$(date +%Y%m%d).tar.gz \
  /etc/openvpn/client/ \
  /home/bridge/mysql-bridge-api/ \
  /etc/nginx/sites-available/ \
  /etc/systemd/system/mysql-bridge-api.service
```

---

## 📈 MONITOREO Y ALERTAS

El sistema incluye monitoreo automático que verifica cada 2 minutos:

- ✅ Estado de servicios (VPN, API, Nginx)
- ✅ Conectividad MySQL
- ✅ Disponibilidad HTTPS
- ✅ Uso de recursos (CPU, RAM, disco)
- ✅ Health check de la API

### Configurar Alertas por Slack

```bash
# En el VPS, editar variables de entorno
sudo nano /etc/environment

# Agregar:
SLACK_WEBHOOK=https://hooks.slack.com/services/...
```

### Configurar Alertas por Email

Durante la ejecución de `05-final-deployment.sh`, seleccionar "y" cuando pregunte por email y proporcionar la dirección de correo.

---

## ✅ CHECKLIST FINAL

Antes de considerar el sistema en producción, verifica:

- [ ] VPN Sophos conecta automáticamente al reiniciar
- [ ] API Bridge responde en HTTPS con SSL válido
- [ ] MySQL es accesible desde la API
- [ ] Railway puede autenticarse y hacer consultas
- [ ] Monitoreo automático está funcionando
- [ ] Logs se están generando correctamente
- [ ] Sistema se recupera automáticamente de fallas
- [ ] Backup de configuración está creado
- [ ] Alertas están configuradas (opcional)

---

## 🎉 ¡Sistema Completo!

Una vez completados todos los pasos, tendrás:

- **Conexión 24/7** sin intervención manual
- **API REST segura** con autenticación JWT
- **Monitoreo automático** con alertas
- **Auto-recuperación** ante fallas
- **Logs detallados** para debugging
- **Sistema escalable** y mantenible

Tu aplicación Railway ahora puede acceder a la base de datos del cliente como si fuera local, pero a través del túnel VPN seguro y monitoreado.

---

## 📞 Soporte

Si encuentras problemas:

1. Revisa la sección de troubleshooting
2. Verifica los logs: `/usr/local/bin/vps-bridge-status.sh`
3. Ejecuta el script de diagnóstico: `node migrate-to-vps-bridge.js`

Para soporte adicional, incluye en tu reporte:
- Output de `/usr/local/bin/vps-bridge-status.sh`
- Logs recientes de los servicios
- Configuración (sin passwords) de `.env`
