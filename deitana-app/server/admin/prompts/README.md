# 📁 ESTRUCTURA DE PROMPTS REORGANIZADA

## 🎯 OBJETIVO

Esta reorganización separa los prompts en **3 carpetas específicas** para mayor claridad y mantenimiento:

- **`sql/`** - Todo lo relacionado con SQL y base de datos
- **`global/`** - Configuración global del sistema
- **`deitana/`** - Identidad específica de Semilleros Deitana

## 📂 ESTRUCTURA DE CARPETAS

```
prompts/
├── sql/                    # 🗄️ Prompts relacionados con SQL
│   ├── sqlRules.js         # Reglas SQL críticas
│   ├── sqlContext.js       # Contexto de estructura BD
│   ├── sqlExamples.js      # Ejemplos de consultas SQL
│   ├── ejemplos.js         # Ejemplos SQL con consciencia
│   └── index.js            # Índice de exportaciones
│
├── global/                 # 🌐 Prompts globales del sistema
│   ├── identidad.js        # Identidad base del asistente
│   ├── comportamiento.js   # Comportamiento general
│   ├── base.js             # Prompt base con consciencia
│   ├── promptGlobal.js     # Consciencia global
│   ├── formatoRespuesta.js # Formato y estilo visual
│   ├── formatoObligatorio.js # Reglas obligatorias
│   └── index.js            # Índice de exportaciones
│
├── deitana/                # 🏢 Prompts específicos de la empresa
│   ├── identidadEmpresa.js # Identidad de Semilleros Deitana
│   ├── terminologia.js     # Terminología específica
│   └── index.js            # Índice de exportaciones
│
└── README.md               # Este archivo
```

## 🎯 USO POR LLAMADA

### 🧠 PRIMERA LLAMADA (Generación SQL):
```javascript
const { 
    identidadGlobal, 
    comportamientoGlobal, 
    promptBase, 
    promptGlobal,
    formatoRespuesta,
    formatoObligatorio 
} = require('./global');

const { identidadEmpresa, terminologia } = require('./deitana');
const { sqlRules, sqlExamples, ejemplosSQL } = require('./sql');

const prompt = 
    identidadGlobal +           // Quién es el asistente
    comportamientoGlobal +      // Cómo se comporta
    promptBase +                // Consciencia base
    promptGlobal +              // Consciencia global
    formatoRespuesta +          // Formato visual
    formatoObligatorio +        // Reglas obligatorias
    identidadEmpresa +          // Somos Semilleros Deitana
    terminologia +              // Terminología específica
    sqlRules +                  // Reglas SQL
    sqlExamples +               // Ejemplos SQL
    ejemplosSQL;                // Ejemplos con consciencia
```

### 🎯 SEGUNDA LLAMADA (Explicación de datos):
```javascript
const { 
    identidadGlobal, 
    comportamientoGlobal, 
    promptBase, 
    promptGlobal,
    formatoRespuesta 
} = require('./global');

const { identidadEmpresa } = require('./deitana');

const prompt = 
    identidadGlobal +           // Quién es el asistente
    comportamientoGlobal +      // Cómo se comporta
    promptBase +                // Consciencia base
    promptGlobal +              // Consciencia global
    formatoRespuesta +          // Formato visual
    identidadEmpresa +          // Somos Semilleros Deitana
    datosReales +               // Los datos obtenidos
    instruccionEspecifica;      // "Solo explica, no generes SQL"
```

## 📋 CONTENIDO DE CADA CARPETA

### 🗄️ `sql/` - Prompts SQL
- **sqlRules.js**: Reglas críticas para generación SQL
- **sqlContext.js**: Función para construir contexto de BD
- **sqlExamples.js**: Ejemplos de consultas SQL
- **ejemplos.js**: Ejemplos SQL con consciencia y patrones
- **index.js**: Exportaciones unificadas

### 🌐 `global/` - Prompts Globales
- **identidad.js**: Identidad base del asistente (en español)
- **comportamiento.js**: Comportamiento general (en español)
- **base.js**: Prompt base con consciencia de identidad
- **promptGlobal.js**: Consciencia global y contexto temporal
- **formatoRespuesta.js**: Formato visual y estilo de presentación
- **formatoObligatorio.js**: Reglas obligatorias y precisión
- **index.js**: Exportaciones unificadas

### 🏢 `deitana/` - Prompts Empresariales
- **identidadEmpresa.js**: Identidad de Semilleros Deitana (en español)
- **terminologia.js**: Terminología específica del sector (en español)
- **index.js**: Exportaciones unificadas

## 🔄 MIGRACIÓN COMPLETADA

### ✅ ARCHIVOS ORGANIZADOS:
- **Movidos a `sql/`**: `sqlRules.js`, `ejemplos.js`
- **Movidos a `global/`**: `base.js`, `promptGlobal.js`, `formatoRespuesta.js`, `formatoObligatorio.js`, `comportamiento.js`
- **Ya en `deitana/`**: `identidadEmpresa.js`, `terminologia.js`

### ✅ ARCHIVOS ELIMINADOS:
- Duplicados de archivos ya existentes en las carpetas

## 🎯 BENEFICIOS DE LA REORGANIZACIÓN

### ✅ CLARIDAD TOTAL:
- **Separación lógica:** Cada carpeta tiene una responsabilidad específica
- **Nombres intuitivos:** Todo en español para mayor comprensión
- **Estructura jerárquica:** Fácil navegación y mantenimiento
- **Lógica de construcción:** Orden claro para construir prompts

### ✅ MANTENIMIENTO SIMPLIFICADO:
- **Modificación aislada:** Cambiar un prompt sin afectar otros
- **Actualización selectiva:** Solo modificar lo necesario
- **Menos confusión:** Estructura clara y organizada
- **Estructura intuitiva:** Todo en español

### ✅ ESCALABILIDAD MEJORADA:
- **Fácil expansión:** Agregar nuevos prompts en la carpeta correcta
- **Reutilización clara:** Componentes bien organizados
- **Preparado para crecimiento:** Estructura escalable
- **Nomenclatura consistente:** Todo en español

## 🚀 PRÓXIMOS PASOS

1. **Probar la nueva estructura** con importaciones desde las carpetas
2. **Migrar gradualmente** las importaciones existentes
3. **Documentar** cualquier ajuste adicional
4. **Optimizar** según el uso real

---

**IMPORTANTE:** Esta reorganización proporciona una estructura completamente organizada y comprensible en español, facilitando el mantenimiento y la escalabilidad del sistema de prompts.
