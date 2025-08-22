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

## 🚨 REGLA CRÍTICA ESPECÍFICA PARA PARTIDAS

### ⚠️ **OBLIGATORIO PARA CONSULTAS DE PARTIDAS:**
**SIEMPRE** usa \`ORDER BY p.id DESC\` para obtener las partidas **MÁS RECIENTES**.
**NUNCA** muestres partidas antiguas o con IDs bajos.
**SIEMPRE** incluye \`LIMIT\` para evitar mostrar demasiadas partidas.

**EJEMPLO CORRECTO:**
\`<sql>SELECT * FROM partidas ORDER BY id DESC LIMIT 10</sql>\`

**EJEMPLO INCORRECTO:**
\`<sql>SELECT * FROM partidas ORDER BY id ASC</sql>\`

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







Para identificar las partidas programadas para realizarse (sembrarse) en una fecha determinada, es importante tener en cuenta que la columna correcta para filtrar no es la fecha de carga (PAR_FEC), sino la fecha de siembra, que corresponde al campo PAR_FECS.

Ejemplo:

 SELECT id, PAR_FECS AS fecha_siembra, PAR_DENO AS observaciones, PAR_NMCL AS cliente, PAR_NMSM AS semilla, PAR_FECE AS fecha_entrega_estimada FROM partidas WHERE PAR_FECS = '2025-08-08'; 




Usos:
"¿Qué semillas hay en cámara?" → Ejecutar tal cual.
"¿Tenemos semilla X en cámara?" → Añadir WHERE a.AR_DENO LIKE '%TOMATE ZOCO%'
"¿Cuál es el stock que más hay en cámara?" → El primero del ORDER BY DESC.
"¿Qué semillas hay en cámara?" → Ejecutar tal cual con SELECT DISTINCT a.AR_DENO.
"¿Cuál es el stock más bajo en cámara?" → ORDER BY SUM(ra.REA_UDS) ASC LIMIT 1.
"¿Cuál es el stock que más hay en cámara?" → ORDER BY SUM(ra.REA_UDS) DESC LIMIT 1.
"¿Cuántos sobres de sandía hay en cámara?" → Añadir WHERE a.AR_DENO LIKE '%SANDÍA%'.
"¿Tenemos semilla de Tomate Alejandría?" → Añadir WHERE a.AR_DENO LIKE '%TOMATE ALEJANDRÍA%'.
"¿Qué artículos no tienen stock?" → HAVING SUM(ra.REA_UDS) = 0.
"¿Cuál es el total de sobres en cámara?" → SUM(ra.REA_UDS).
"¿Cuántos lotes de calabaza hay en cámara?" → COUNT(DISTINCT ra.REA_LOTE) con WHERE a.AR_DENO LIKE '%CALABAZA%'.
"¿Cuál es la variedad con más stock?" → ORDER BY SUM(ra.REA_UDS) DESC LIMIT 1 con GROUP BY a.AR_DENO.


 SELECT
  a.AR_DENO AS tipo_semilla,
  ra.REA_LOTE AS lote_remesa,
  SUM(rm.REM_UDS * rm.REM_UXE) AS stock_actual
FROM remesas_art ra
LEFT JOIN articulos a ON ra.REA_AR = a.id
LEFT JOIN remesas_mov rm ON rm.REM_REA = ra.id
GROUP BY a.AR_DENO, ra.REA_LOTE
HAVING SUM(rm.REM_UDS * rm.REM_UXE) > 0
ORDER BY stock_actual DESC;





Para identificar la cabeza y pie de X cosa 

"¿Cuál es la cabeza de la semilla 00000004?" → SELECT AR_SEMCAB FROM articulos WHERE id = '00000004'
"¿Cuál es el pie de la semilla 00000004?" → SELECT AR_SEMPIE FROM articulos WHERE id = '00000004'
"¿Qué cabeza y pie tiene la semilla 00000004?" → SELECT AR_SEMCAB, AR_SEMPIE FROM articulos WHERE id = '00000004'
"¿Qué semilla es la cabeza de la semilla 00000004?" → SELECT a2.id, a2.AR_DENO FROM articulos a1 LEFT JOIN articulos a2 ON a1.AR_SEMCAB = a2.id WHERE a1.id = '00000004'
"¿Qué semilla es el pie de la semilla 00000004?" → SELECT a2.id, a2.AR_DENO FROM articulos a1 LEFT JOIN articulos a2 ON a1.AR_SEMPIE = a2.id WHERE a1.id = '00000004'
"¿Qué cabeza y pie completos tiene la semilla 00000004?" → SELECT a1.id AS semilla, a1.AR_DENO AS nombre, cab.id AS cabeza_id, cab.AR_DENO AS cabeza_nombre, pie.id AS pie_id, pie.AR_DENO AS pie_nombre FROM articulos a1 LEFT JOIN articulos cab ON a1.AR_SEMCAB = cab.id LEFT JOIN articulos pie ON a1.AR_SEMPIE = pie.id WHERE a1.id = '00000004'

SELECT 
    a.id AS articulo_id,
    a.AR_DENO AS articulo_nombre,
    cab.id AS cabeza_id,
    cab.AR_DENO AS cabeza_nombre,
    pie.id AS pie_id,
    pie.AR_DENO AS pie_nombre
FROM articulos a
LEFT JOIN articulos cab ON a.AR_SEMCAB = cab.id
LEFT JOIN articulos pie ON a.AR_SEMPIE = pie.id
WHERE a.id = '00000004';




"¿Cuál es la cabeza del artículo Tomate Ananas?":
SELECT a.id, a.AR_DENO, a.AR_SEMCAB, c.AR_DENO AS nombre_cabeza 
FROM articulos a 
LEFT JOIN articulos c ON a.AR_SEMCAB = c.id 
WHERE a.AR_DENO LIKE '%TOMATE ANANAS%';

"¿Cuál es el pie del artículo Tomate Ananas?":
SELECT a.id, a.AR_DENO, a.AR_SEMPIE, p.AR_DENO AS nombre_pie 
FROM articulos a 
LEFT JOIN articulos p ON a.AR_SEMPIE = p.id 
WHERE a.AR_DENO LIKE '%TOMATE ANANAS%';



"¿Cuál es la cabeza y el pie del artículo Tomate Ananas?":
SELECT a.id, a.AR_DENO, 
       a.AR_SEMCAB, c.AR_DENO AS nombre_cabeza, 
       a.AR_SEMPIE, p.AR_DENO AS nombre_pie
FROM articulos a 
LEFT JOIN articulos c ON a.AR_SEMCAB = c.id 
LEFT JOIN articulos p ON a.AR_SEMPIE = p.id 
WHERE a.AR_DENO LIKE '%TOMATE ANANAS%';



Explicación conceptual
Cabeza (AR_SEMCAB):
Es la parte superior del injerto, la que da el tipo de cultivo (ejemplo: el tomate que producirá frutos).
Pie (AR_SEMPIE):
Es la base del injerto, la raíz o portainjerto que aporta vigor, resistencia a plagas, tolerancia a suelos, etc.
Injerto (INJ-…):
Es el artículo resultante de unir cabeza + pie. En tu tabla, los artículos que empiezan con INJ- suelen ser variedades injertadas.



Prompt de referencia: Cabeza y Pie
Reglas para identificar cabezas
Prefijo común: INJ-
Caracteres extra: Pueden contener ##, /, -, números o letras adicionales
Ejemplos de nombre de cabeza: INJ-TOM.TORRY PODAO/ARMSTRONG, INJ-TOM.TUMAKI POD##/MULTIFORT, INJ-TOM.VELASCO##/MULTIFORT
Regla de búsqueda SQL: Usar LIKE '%INJ-%' si se quiere filtrar por cabeza

Reglas para identificar pies
Prefijo común: PORTAINJ
Caracteres extra: Pueden tener -, espacios o nombres de la variedad de portainjerto
Ejemplos de nombre de pie: PORTAINJ TOMATE ARMSTRONG, PORTAINJ TOMATE MULTIFORT, PORTAINJ TOMATE BEAUFORT
Regla de búsqueda SQL: Usar LIKE 'PORTAINJ%' si se quiere filtrar por pie

Cómo usar en consultas SQL
Buscar cabeza por nombre parcial: SELECT * FROM articulos WHERE AR_DENO LIKE '%INJ-TOM.TORRY%';
Buscar pie por nombre parcial: SELECT * FROM articulos WHERE AR_DENO LIKE 'PORTAINJ TOMATE ARMSTRONG%';
Buscar por ID específico (cuando se conoce AR_SEMCAB o AR_SEMPIE): SELECT a.AR_DENO AS articulo, c.AR_DENO AS cabeza, p.AR_DENO AS pie FROM articulos a LEFT JOIN articulos c ON a.AR_SEMCAB = c.id LEFT JOIN articulos p ON a.AR_SEMPIE = p.id WHERE a.id = '00000316';

Ejemplo de uso en prompts
"¿Cuál es la cabeza del artículo INJ-TOM.TORRY PODAO/ARMSTRONG?" → Aplicar regla de cabeza (INJ-) y mostrar TOMATE TORRY##
"¿Qué pie tiene TOMATE VENTERO?" → Aplicar regla de pie (PORTAINJ%) y mostrar PORTAINJ TOMATE ARMSTRONG
"¿Todos los pies disponibles para tomates?" → Buscar todos los AR_DENO que comiencen con PORTAINJ

Recomendación para tu asistente
Detectar siempre prefijos (INJ- vs PORTAINJ) antes de filtrar
Ignorar sufijos como ## o caracteres especiales al mostrar resultados
Permitir búsqueda fuzzy con LIKE '%palabra%' para nombres parciales
Mantener respuesta visual tipo tablas con columna de cabeza y pie para claridad





Para consultas como: "¿Qué partidas tenemos en el invernadero A1 y cuántas bandejas quedan?"
Recuerda, que es importante que te enfoques en proporcionar partidas que sean recientes, no partidas que años anteriores o las primeras ya que eso no es factible por ningun motivo.

## 🚨 REGLA CRÍTICA PARA CONSULTAS DE PARTIDAS

### ⚠️ **OBLIGATORIO PARA TODAS LAS CONSULTAS DE PARTIDAS:**
**SIEMPRE** enfócate en proporcionar partidas que sean **RECIENTES**, NO partidas de años anteriores o las primeras partidas. Esto es **CRÍTICO** porque las partidas antiguas no son factibles por ningún motivo.

### 📋 **EJEMPLOS DE CONSULTAS DE PARTIDAS:**

**Consulta:** "¿Qué partidas tenemos en el invernadero A1 y cuántas bandejas quedan?"

**SQL CORRECTO (partidas recientes):**
\`<sql>
SELECT 
    p.id AS partida_id,
    pu.id2 AS sub_partida,
    pu.C0 AS invernadero,
    pu.C1 AS sector,
    pu.C2 AS fila,
    pu.C4 AS bandejas_restantes
FROM partidas p
INNER JOIN partidas_par_ubic pu 
    ON p.id = pu.id
WHERE pu.C0 = 'A1'
ORDER BY p.id DESC
LIMIT 10;
</sql>\`

**IMPORTANTE:** 
- **SIEMPRE** usa \`ORDER BY p.id DESC\` para obtener las partidas más recientes
- **SIEMPRE** usa \`LIMIT\` para evitar mostrar demasiadas partidas
- **NUNCA** muestres partidas con IDs bajos (antiguas)
- **SIEMPRE** prioriza partidas con IDs altos (recientes)

### 📋 **CONSULTAS ESPECÍFICAS POR ID:**

**Consulta:** "Dame la información de la partida con id 25006502 incluyendo cuántas bandejas quedan"

**SQL CORRECTO:**
\`<sql>
SELECT 
    p.id AS partida_id,
    pu.id2 AS sub_partida,
    pu.C0 AS invernadero,
    pu.C1 AS sector,
    pu.C2 AS fila,
    pu.C4 AS bandejas_restantes
FROM partidas p
INNER JOIN partidas_par_ubic pu 
    ON p.id = pu.id
WHERE p.id = 25006502;
</sql>\`

## 📝 Prompt — Diccionario de Interpretación

### 🔎 Reglas de búsqueda de artículos

Cuando se consulte por brócoli Ares, en la base de datos el artículo corresponde a:
BROC. ARES

La mayoría de artículos de brócoli comienzan con:
BROC (no con BROCOLI).

### 🥦 Interpretación de términos de ubicación

Cuando en una consulta aparezca la palabra "cabeza", debes buscar el artículo común (ejemplo: BROC. ARES).

Cuando en una consulta aparezca la palabra "pie", debes buscar el artículo de portainjerto, que aparece en la base de datos con el prefijo:
PORTAINJ

**Ejemplo:**
"Pie de tomate Fervour" → corresponde a PORTAINJ TOMATE FERVOUR


---

**IMPORTANTE:** Estas reglas son OBLIGATORIAS para todas las consultas SQL generadas.`;

module.exports = { sqlRules };
