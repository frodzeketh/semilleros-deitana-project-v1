# 🔄 Sincronizador Automático ERP → Railway

Sistema automatizado para mantener sincronizada la base de datos de Railway con la base de datos local del ERP Global System a través de VPN Sophos.

## 🚨 IMPORTANTE: Configuración de VPN Sophos

**Antes de usar este sistema, necesitas configurar tu conexión VPN específica.**

### 🔍 Paso 1: Encontrar información de tu VPN

```powershell
# Ejecutar este script para ayudarte a encontrar la información
powershell.exe -ExecutionPolicy Bypass -File "encontrar_info_vpn.ps1"
```

Este script te ayudará a:
- ✅ Verificar si la VPN Sophos está conectada
- ✅ Mostrar las IPs disponibles en tu red VPN
- ✅ Probar conexiones a servidores comunes
- ✅ Encontrar información de MySQL Workbench

### 🔧 Paso 2: Configurar tu VPN específica

```powershell
# Ejecutar este script para configurar tu VPN
powershell.exe -ExecutionPolicy Bypass -File "configurar_vpn_sophos.ps1"
```

Este script te pedirá:
- **IP del servidor ERP** (ej: 192.168.1.100)
- **Puerto MySQL** (normalmente 3306)
- **Usuario de la base de datos**
- **Contraseña de la base de datos**
- **Nombre de la base de datos ERP**

## 📋 Requisitos Previos

### 1. Herramientas Necesarias
- **MySQL Client** (mysqldump y mysql)
- **VPN Sophos** conectada
- **PowerShell** (incluido en Windows 10/11)

### 2. Verificar Herramientas
```cmd
# Verificar mysqldump
mysqldump -V

# Verificar mysql
mysql -V
```

Si no están en el PATH, cópialos desde la carpeta de instalación de MySQL Workbench.

## 🚀 Instalación Rápida

### Paso 1: Encontrar información de VPN
```powershell
powershell.exe -ExecutionPolicy Bypass -File "encontrar_info_vpn.ps1"
```

### Paso 2: Configurar VPN específica
```powershell
powershell.exe -ExecutionPolicy Bypass -File "configurar_vpn_sophos.ps1"
```

### Paso 3: Probar conexión
```powershell
powershell.exe -ExecutionPolicy Bypass -File "sync_erp_railway.ps1" -Test
```

### Paso 4: Configurar automatización
```powershell
# Ejecutar como administrador
powershell.exe -ExecutionPolicy Bypass -File "configurar_tarea_programada.ps1"
```

## 📁 Archivos del Sistema

| Archivo | Descripción |
|---------|-------------|
| `encontrar_info_vpn.ps1` | **NUEVO** - Ayuda a encontrar información de VPN |
| `configurar_vpn_sophos.ps1` | **NUEVO** - Configura tu VPN específica |
| `sync_erp_railway.ps1` | Script principal de sincronización |
| `config_sync.ini` | Configuración de conexiones |
| `actualizar_erp_railway.bat` | Versión batch (alternativa) |
| `configurar_tarea_programada.ps1` | Configuración automática de tarea |
| `probar_sincronizacion.ps1` | Script de prueba rápida |

## 🔧 Uso Manual

### Probar Conexiones
```powershell
powershell.exe -ExecutionPolicy Bypass -File "sync_erp_railway.ps1" -Test
```

### Ejecutar Sincronización Manual
```powershell
powershell.exe -ExecutionPolicy Bypass -File "sync_erp_railway.ps1"
```

### Ejecutar Versión Batch
```cmd
actualizar_erp_railway.bat
```

## ⏰ Configuración Automática

### Opción 1: Automática (Recomendada)
```powershell
# Ejecutar como administrador
powershell.exe -ExecutionPolicy Bypass -File "configurar_tarea_programada.ps1"
```

### Opción 2: Manual
1. Abrir "Programador de tareas" (`taskschd.msc`)
2. Crear tarea básica
3. Nombre: "Sincronizar ERP a Railway"
4. Trigger: Diario a las 03:30
5. Acción: `powershell.exe -ExecutionPolicy Bypass -File "ruta\sync_erp_railway.ps1"`

## 📊 Monitoreo

### Logs Automáticos
- **Archivo**: `sync_log_YYYY-MM-DD.txt`
- **Ubicación**: Misma carpeta del script
- **Contenido**: Timestamps, errores, éxitos

### Verificar Estado
```powershell
# Ver último log
Get-Content "sync_log_$(Get-Date -Format 'yyyy-MM-dd').txt" -Tail 10
```

### Verificar Tarea Programada
```powershell
Get-ScheduledTask -TaskName "Sincronizar ERP a Railway"
```

## 🛠️ Solución de Problemas

### Error: "mysqldump no encontrado"
**Solución**: 
1. Instalar MySQL Client
2. Agregar al PATH: `C:\Program Files\MySQL\MySQL Server 8.0\bin`

### Error: "No se puede conectar al servidor local"
**Solución**:
1. Verificar VPN Sophos conectada
2. Verificar credenciales en `config_sync.ini`
3. Probar conexión manual con MySQL Workbench
4. **NUEVO**: Usar `encontrar_info_vpn.ps1` para diagnosticar

### Error: "Falló importación a Railway"
**Solución**:
1. Verificar credenciales de Railway
2. Verificar conectividad a internet
3. Revisar logs de error

### Tarea no se ejecuta automáticamente
**Solución**:
1. Verificar que PC esté encendida a la hora programada
2. Verificar configuración de tarea en Programador de tareas
3. Ejecutar manualmente para verificar

## 🔒 Seguridad

### Credenciales
- **Local**: Usar cuenta con permisos mínimos necesarios
- **Railway**: Credenciales ya configuradas en `db.js`
- **Logs**: No contienen contraseñas en texto plano

### Recomendaciones
- Cambiar contraseñas regularmente
- Usar cuentas específicas para sincronización
- Revisar logs periódicamente

## 📈 Optimizaciones

### Para Bases Grandes
```ini
[SYNC_SETTINGS]
COMPRESS_DUMP=true
BACKUP_RETENTION_DAYS=7
```

### Sincronización Incremental (Futuro)
- Implementar comparación de timestamps
- Sincronizar solo cambios
- Reducir tiempo de transferencia

## 🆘 Soporte

### Comandos Útiles
```powershell
# Verificar herramientas
mysqldump -V
mysql -V

# Probar conexión local (después de configurar VPN)
mysql -h [IP-DEL-SERVIDOR] -u [usuario] -p

# Probar conexión Railway
mysql -h centerbeam.proxy.rlwy.net -P 32877 -u root -p

# Ver logs recientes
Get-Content "sync_log_$(Get-Date -Format 'yyyy-MM-dd').txt" -Tail 20
```

### Contacto
- Revisar logs antes de reportar problemas
- Incluir timestamp del error
- Verificar VPN y conectividad

## ✅ Checklist de Verificación

- [ ] MySQL Client instalado y en PATH
- [ ] VPN Sophos configurada y funcionando
- [ ] **NUEVO**: Información de VPN encontrada con `encontrar_info_vpn.ps1`
- [ ] **NUEVO**: VPN configurada con `configurar_vpn_sophos.ps1`
- [ ] Credenciales actualizadas en `config_sync.ini`
- [ ] Prueba manual exitosa
- [ ] Tarea programada configurada
- [ ] PC configurada para no hibernar
- [ ] Logs verificados después de primera ejecución

## 🎯 Resultado Esperado

Con este sistema tendrás:
- ✅ Sincronización automática cada 24 horas
- ✅ Datos actualizados en Railway
- ✅ Logs detallados para monitoreo
- ✅ Sin intervención manual requerida
- ✅ Sistema robusto con manejo de errores
- ✅ **NUEVO**: Configuración específica para tu VPN Sophos

¡Tu asistente IA siempre tendrá datos frescos! 🚀 