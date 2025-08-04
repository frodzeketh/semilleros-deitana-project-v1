# Deitana App

## Descripción
Aplicación web para gestión empresarial con sincronización automática de base de datos.

## Configuración de Sincronización Automática

### Tarea Programada
- **Horario:** 22:00 hs (10:00 PM) hora argentina
- **Frecuencia:** Diaria
- **Email:** facuslice@gmail.com
- **VPN:** Sophos requerida

### Comandos Manuales

#### Para Verificar Conexión y Email
```powershell
powershell.exe -ExecutionPolicy Bypass -File "probar_simple.ps1"
```
**¿Cuándo usar?**
- Para verificar que la VPN está conectada
- Para verificar que el email funciona
- Para diagnosticar problemas
- Para enviar un email de prueba

**¿Qué hace?**
- Verifica conexión VPN
- Verifica herramientas (mysqldump, mysql)
- Envía email de prueba
- **NO sincroniza la base de datos**

#### Para Sincronizar Manualmente

**Opción 1 - Progreso básico:**
```powershell
powershell.exe -ExecutionPolicy Bypass -File "sincronizar_ahora.ps1"
```

**Opción 2 - Progreso en tiempo real (recomendado):**
```powershell
powershell.exe -ExecutionPolicy Bypass -File "sincronizar_con_progreso.ps1"
```
**¿Cuándo usar?**
- Si la tarea automática no se ejecutó
- Si la PC estaba apagada a las 22:00
- Si la VPN no estaba conectada
- Si necesitas sincronizar inmediatamente
- Si no llegó el email de confirmación

**¿Qué hace?**
- Exporta la base de datos completa (950 MB)
- Importa a Railway
- Envía emails de inicio y fin
- **SÍ sincroniza la base de datos**

### 📊 **Indicadores de Progreso**

**Scripts con progreso:**
- **`sincronizar_ahora.ps1`**: Muestra porcentajes de cada etapa
- **`sincronizar_con_progreso.ps1`**: Muestra progreso en tiempo real con velocidad de transferencia

**Información mostrada:**
- 📈 Porcentaje de avance general
- 🚀 Velocidad de exportación (MB/s)
- 📊 Tamaño del archivo en tiempo real
- ⏱️ Tiempo transcurrido
- 🔄 Estado de cada operación

### 📧 **Emails de Notificación**

#### Con `probar_simple.ps1`:
- 📧 Email de prueba: "PRUEBA - Sincronización ERP"

#### Con `sincronizar_ahora.ps1` y `sincronizar_con_progreso.ps1`:
- 📧 Email de inicio: "Sincronización ERP - INICIADA"
- 📧 Email de éxito: "Sincronización ERP - EXITOSA"
- 📧 Email de error: "Sincronización ERP - FALLO" (si algo falla)

### Requisitos
- PC encendida a las 22:00 hs
- VPN Sophos conectada
- Herramientas MySQL instaladas (mysqldump, mysql)
- Configuración de email Gmail con App Password

### Archivos de Configuración
- `config_sync.ini`: Configuración de bases de datos
- `sync_batch.bat`: Script ejecutado por la tarea programada
- `sync_erp_railway.ps1`: Script principal de sincronización

### Verificación de Estado
Para verificar si la tarea programada está funcionando:
```powershell
Get-ScheduledTask -TaskName "Sincronizacion ERP 2AM" | Get-ScheduledTaskInfo
```

### Logs
Los logs se guardan en: `%TEMP%\sync_log_YYYY-MM-DD.txt`

## Instalación

1. Clonar el repositorio
2. Configurar `config_sync.ini` con las credenciales de base de datos
3. Configurar la tarea programada (ya configurada)
4. Verificar conexión VPN y herramientas

## Uso

La sincronización se ejecuta automáticamente todos los días a las 22:00 hs. Si necesitas sincronizar manualmente, usa los comandos indicados arriba.
