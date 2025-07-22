# Sincronización Incremental ERP → Railway

## Descripción

Este sistema permite sincronizar la base de datos ERP con Railway de forma incremental, es decir, solo transfiere los cambios nuevos o modificados, no toda la base de datos. Esto hace que la sincronización sea mucho más rápida y eficiente.

## Ventajas de la Sincronización Incremental

- **Velocidad**: Solo transfiere datos nuevos/modificados
- **Eficiencia**: Usa menos recursos (CPU, memoria, ancho de banda)
- **Frecuencia**: Permite sincronizar más seguido sin problemas
- **Seguridad**: Si falla, no pierdes todo el trabajo anterior

## Archivos del Sistema

### Scripts Principales

1. **`sync_incremental.ps1`** - Script principal de sincronización incremental
2. **`configurar_tarea_incremental.ps1`** - Configura tarea programada automática
3. **`config_sync.ini`** - Archivo de configuración (usar el mismo del script original)

### Archivos de Configuración

- **`config_sync.ini`** - Configuración de conexiones a bases de datos

## Instalación y Configuración

### Paso 1: Verificar Herramientas

```powershell
powershell.exe -ExecutionPolicy Bypass -File "sync_incremental.ps1" -Test
```

### Paso 2: Instalar Percona Toolkit (si es necesario)

```powershell
powershell.exe -ExecutionPolicy Bypass -File "sync_incremental.ps1" -InstallTools
```

### Paso 3: Probar Sincronización

```powershell
powershell.exe -ExecutionPolicy Bypass -File "sync_incremental.ps1"
```

### Paso 4: Configurar Automatización

```powershell
powershell.exe -ExecutionPolicy Bypass -File "configurar_tarea_incremental.ps1"
```

## Uso

### Sincronización Manual

```powershell
# Sincronización completa incremental
powershell.exe -ExecutionPolicy Bypass -File "sync_incremental.ps1"

# Solo verificar conexiones y herramientas
powershell.exe -ExecutionPolicy Bypass -File "sync_incremental.ps1" -Test

# Instalar herramientas si faltan
powershell.exe -ExecutionPolicy Bypass -File "sync_incremental.ps1" -InstallTools
```

### Automatización

```powershell
# Configurar tarea programada (ejecutar como administrador)
powershell.exe -ExecutionPolicy Bypass -File "configurar_tarea_incremental.ps1"

# Eliminar tarea programada
powershell.exe -ExecutionPolicy Bypass -File "configurar_tarea_incremental.ps1" -Remove

# Probar configuración
powershell.exe -ExecutionPolicy Bypass -File "configurar_tarea_incremental.ps1" -Test
```

## Configuración

### Archivo config_sync.ini

```ini
[LOCAL_DATABASE]
db_host=10.120.1.5
port=3306
user=deitana
password=D31tana!
database=eja

[RAILWAY_DATABASE]
db_host=centerbeam.proxy.rlwy.net
port=32877
user=root
password=gbrIerodvEYzzDQbgtlQjelgLaLlgPuf
database=railway

[SYNC_SETTINGS]
log_retention_days=30
vpn_required=true
backup_retention_days=7
compress_dump=true
```

## Diferencias con Sincronización Completa

| Aspecto | Sincronización Completa | Sincronización Incremental |
|---------|-------------------------|----------------------------|
| **Velocidad** | Lenta (horas) | Rápida (minutos) |
| **Recursos** | Alto uso | Bajo uso |
| **Frecuencia** | Limitada | Diaria/múltiple |
| **Riesgo** | Alto (pierde todo si falla) | Bajo (solo cambios) |
| **Mantenimiento** | Simple | Requiere herramientas |

## Logs y Monitoreo

### Archivos de Log

- **Ubicación**: Carpeta temporal del sistema
- **Formato**: `sync_incremental_log_YYYY-MM-DD.txt`
- **Contenido**: Historial completo de sincronizaciones

### Verificación de Estado

```powershell
# Ver logs recientes
Get-Content "$env:TEMP\sync_incremental_log_$(Get-Date -Format 'yyyy-MM-dd').txt" -Tail 20

# Verificar tarea programada
Get-ScheduledTask -TaskName "Sincronización Incremental ERP a Railway"
```

## Solución de Problemas

### Error: "Herramientas faltantes"

```powershell
# Instalar Percona Toolkit automáticamente
powershell.exe -ExecutionPolicy Bypass -File "sync_incremental.ps1" -InstallTools
```

### Error: "Conexión VPN"

- Verificar que la VPN Sophos esté conectada
- Verificar que el servidor MySQL esté accesible

### Error: "Acceso denegado"

- Ejecutar PowerShell como administrador
- Verificar permisos de escritura en carpeta temporal

### Error: "Base de datos no encontrada"

- Verificar nombre de base de datos en `config_sync.ini`
- Conectar manualmente a MySQL para verificar

## Automatización

### Configurar para Ejecutar a las 2:30 AM

```powershell
# Ejecutar como administrador
powershell.exe -ExecutionPolicy Bypass -File "configurar_tarea_incremental.ps1"
```

### Verificar Configuración

```powershell
# Ver tareas programadas
Get-ScheduledTask | Where-Object {$_.TaskName -like "*Sincronización*"}

# Ver detalles de la tarea
Get-ScheduledTask -TaskName "Sincronización Incremental ERP a Railway" | Get-ScheduledTaskInfo
```

## Mantenimiento

### Limpieza de Logs

Los logs se guardan automáticamente en la carpeta temporal y se limpian según la configuración en `config_sync.ini`.

### Actualización de Configuración

Para cambiar la configuración:
1. Editar `config_sync.ini`
2. Probar con `-Test`
3. Ejecutar sincronización manual para verificar

## Soporte

Para problemas o consultas:
1. Revisar logs en carpeta temporal
2. Ejecutar con `-Test` para diagnóstico
3. Verificar configuración en `config_sync.ini`
4. Comprobar conexión VPN y MySQL manualmente 