# 🏗️ Organización de Prompts - Core

Esta carpeta contiene la nueva organización modular de prompts para el sistema de IA de Semilleros Deitana.

## 📁 Estructura de Archivos

### 🔧 `openAI.js`
- **Función principal**: Maneja las llamadas a OpenAI y el procesamiento de consultas
- **Responsabilidades**:
  - Coordinar entre los diferentes tipos de prompts
  - Ejecutar consultas SQL
  - Manejar streaming de respuestas
  - Gestionar el contexto de conversación

### 📊 `promptSQL.js`
- **Función principal**: Genera prompts para consultas SQL
- **Funciones disponibles**:
  - `generarPromptSQL()` - Para consultas SQL puras
  - `generarPromptRAGSQL()` - Para consultas que combinan RAG + SQL
  - `obtenerContenidoMapaERP()` - Obtiene contexto de la base de datos
  - `obtenerDescripcionMapaERP()` - Obtiene descripciones de tablas

### 🎨 `promptFormateador.js`
- **Función principal**: Genera prompts para formatear y explicar datos
- **Funciones disponibles**:
  - `generarPromptFormateador()` - Para formatear resultados SQL
  - `generarPromptConversacional()` - Para respuestas conversacionales
  - `generarPromptRAGSQLFormateador()` - Para formatear RAG + SQL
  - `generarPromptErrorFormateador()` - Para respuestas de error

### 📚 `promptBase.js`
- **Función principal**: Prompt base para el comportamiento general
- **Contenido**: Reglas generales, ejemplos y comportamiento base

### 🗺️ `mapaERP.js`
- **Función principal**: Mapeo de la estructura de la base de datos
- **Contenido**: Definición de tablas, columnas y relaciones

## 🔄 Flujo de Trabajo

### 1. Consulta SQL Pura
```
Usuario → openAI.js → promptSQL.js → SQL → promptFormateador.js → Respuesta
```

### 2. Consulta RAG + SQL
```
Usuario → openAI.js → promptSQL.js (RAG) → SQL + Contexto → promptFormateador.js → Respuesta
```

### 3. Consulta Conversacional
```
Usuario → openAI.js → promptFormateador.js → Respuesta
```

## 🎯 Ventajas de la Nueva Organización

### ✅ **Modularidad**
- Cada tipo de prompt tiene su propio archivo
- Fácil mantenimiento y actualización
- Separación clara de responsabilidades

### ✅ **Reutilización**
- Los prompts se pueden usar en diferentes contextos
- Funciones auxiliares compartidas
- Configuración centralizada

### ✅ **Escalabilidad**
- Fácil agregar nuevos tipos de prompts
- Estructura preparada para expansión
- Testing individual por módulo

### ✅ **Mantenimiento**
- Cambios específicos sin afectar otros módulos
- Documentación clara por archivo
- Debugging más fácil

## 🛠️ Uso de las Funciones

### Para Consultas SQL
```javascript
const { generarPromptSQL } = require('./promptSQL');
const prompt = generarPromptSQL(message, contextoPinecone, lastRealData);
```

### Para Formateo
```javascript
const { generarPromptFormateador } = require('./promptFormateador');
const prompt = generarPromptFormateador(message, sql, results);
```

### Para Conversaciones
```javascript
const { generarPromptConversacional } = require('./promptFormateador');
const prompt = generarPromptConversacional(message, respuestaIA);
```

## 🔧 Configuración

### Variables de Entorno Requeridas
- `OPENAI_API_KEY` - Clave de API de OpenAI
- `PINECONE_API_KEY` - Clave de API de Pinecone
- `FIREBASE_ADMIN_CREDENTIALS` - Credenciales de Firebase

### Dependencias
- `openai` - Cliente de OpenAI
- `pinecone-client` - Cliente de Pinecone
- `firebase-admin` - Admin SDK de Firebase

## 📝 Notas de Desarrollo

### Al Agregar Nuevos Prompts
1. Crear función en el archivo correspondiente
2. Exportar la función en `module.exports`
3. Importar en `openAI.js` si es necesario
4. Documentar en este README

### Al Modificar Prompts Existentes
1. Actualizar solo el archivo específico
2. Probar con diferentes tipos de consultas
3. Verificar que no afecte otros módulos
4. Actualizar documentación si es necesario

## 🚀 Próximas Mejoras

- [ ] Agregar validación de prompts
- [ ] Implementar cache de prompts
- [ ] Agregar métricas de rendimiento
- [ ] Crear tests unitarios por módulo
- [ ] Implementar versionado de prompts 