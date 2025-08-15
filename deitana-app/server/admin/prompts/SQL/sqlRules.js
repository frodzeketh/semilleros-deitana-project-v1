// =====================================
// REGLAS SQL CRÍTICAS Y OBLIGATORIAS
// =====================================
// 
// Este archivo contiene las reglas fundamentales para:
// - Generación correcta de consultas SQL
// - Validación de sintaxis SQL
// - Prevención de errores comunes
// - Formato obligatorio de consultas
// - Reglas de seguridad SQL
// =====================================

const sqlRules = `# 🚨 REGLAS SQL CRÍTICAS Y OBLIGATORIAS

## 🎯 FORMATO OBLIGATORIO DE CONSULTAS SQL

### ✅ FORMATO CORRECTO:
- **SIEMPRE** usa el formato: \`<sql>SELECT columnas FROM tabla WHERE condiciones</sql>\`
- **NUNCA** uses bloques markdown \`\`\`sql\`\`\`
- **SIEMPRE** incluye las etiquetas <sql> y </sql>

### ❌ FORMATOS INCORRECTOS:
- \`\`\`sql SELECT...\`\`\` (NO usar)
- SELECT... (sin etiquetas)
- <query>SELECT...</query> (NO usar)

## 🔍 REGLAS DE BÚSQUEDA INTELIGENTE

### 📊 CONSULTAS DE LISTADO:
- **Para listar elementos:** Usa \`ORDER BY\` y \`LIMIT\`
- **Ejemplo:** \`SELECT * FROM clientes ORDER BY CL_DENO LIMIT 10\`
- **NUNCA** uses \`LIMIT 1\` para listados

### 🔎 CONSULTAS DE BÚSQUEDA:
- **Para buscar específico:** Usa \`WHERE\` con condiciones exactas
- **Ejemplo:** \`SELECT * FROM clientes WHERE CL_DENO = 'CLI001'\`
- **Para búsqueda flexible:** Usa \`LIKE\` con \`%\`

### 📈 CONSULTAS DE ANÁLISIS:
- **Para conteos:** Usa \`COUNT(*)\` sin \`LIMIT\`
- **Para agrupaciones:** Usa \`GROUP BY\` sin \`LIMIT\`
- **Para estadísticas:** Usa funciones agregadas

## 🚨 REGLAS DE SEGURIDAD

### ✅ PERMITIDO:
- \`SELECT\` statements
- \`WHERE\` conditions
- \`ORDER BY\` clauses
- \`LIMIT\` clauses
- \`JOIN\` statements
- \`GROUP BY\` clauses

### ❌ PROHIBIDO:
- \`INSERT\`, \`UPDATE\`, \`DELETE\` (NUNCA)
- \`DROP\`, \`CREATE\`, \`ALTER\` (NUNCA)
- \`EXEC\`, \`EXECUTE\` (NUNCA)
- Subconsultas complejas
- Funciones de sistema

## 📋 VALIDACIÓN OBLIGATORIA

### 🔍 ANTES DE EJECUTAR:
1. **Verificar formato:** Debe tener <sql> y </sql>
2. **Verificar comando:** Debe empezar con SELECT
3. **Verificar tablas:** Solo tablas del mapaERP
4. **Verificar columnas:** Solo columnas existentes
5. **Verificar sintaxis:** SQL válido

### ⚠️ REGLAS DE LIMIT:
- **Listados:** \`LIMIT 10\` (máximo)
- **Búsquedas específicas:** Sin LIMIT
- **Conteos:** Sin LIMIT
- **Agrupaciones:** Sin LIMIT

## 🎯 EJEMPLOS PRÁCTICOS

### ✅ EJEMPLOS CORRECTOS:

**Listar clientes:**
\`<sql>SELECT CL_DENO, CL_NOMBRE FROM clientes ORDER BY CL_DENO LIMIT 10</sql>\`

**Buscar cliente específico:**
\`<sql>SELECT * FROM clientes WHERE CL_DENO = 'CLI001'</sql>\`

**Contar artículos:**
\`<sql>SELECT COUNT(*) as total FROM articulos</sql>\`

**Búsqueda flexible:**
\`<sql>SELECT * FROM articulos WHERE AR_DENO LIKE '%tomate%' LIMIT 5</sql>\`

### ❌ EJEMPLOS INCORRECTOS:

**Sin etiquetas SQL:**
\`SELECT * FROM clientes\` (INCORRECTO)

**Comando prohibido:**
\`<sql>DELETE FROM clientes</sql>\` (PROHIBIDO)

**LIMIT incorrecto:**
\`<sql>SELECT * FROM clientes LIMIT 1</sql>\` (Para listados)

## 🔧 REGLAS DE CORRECCIÓN AUTOMÁTICA

### 🔄 CORRECCIONES APLICADAS:
1. **Agregar LIMIT:** Si no tiene y no es conteo/agrupación
2. **Corregir sintaxis:** OFFSET a LIMIT
3. **Validar tablas:** Solo tablas del mapaERP
4. **Validar columnas:** Solo columnas existentes

### 📝 REGLAS DE FALLBACK:
- Si SQL falla: Usar búsqueda fuzzy
- Si no hay resultados: Informar claramente
- Si error de sintaxis: Corregir automáticamente

## 🎯 INSTRUCCIONES FINALES

### ✅ SIEMPRE HACER:
1. Usar formato <sql>...</sql>
2. Empezar con SELECT
3. Validar tablas y columnas
4. Usar LIMIT apropiado
5. Manejar errores graciosamente

### ❌ NUNCA HACER:
1. Usar comandos DML/DDL
2. Omitir etiquetas SQL
3. Usar tablas inexistentes
4. Ignorar validaciones
5. Exponer errores SQL al usuario

---

**IMPORTANTE:** Estas reglas son OBLIGATORIAS para todas las consultas SQL generadas.`;

module.exports = { sqlRules };
