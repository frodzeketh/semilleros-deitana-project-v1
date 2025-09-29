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

Reglas SQL importantes:

Usa siempre nombres de tablas y columnas válidos en MySQL.
Nunca uses triple backtick en código SQL.
Si encuentras un guion (-) en un nombre, reemplázalo por guion bajo (_).
Las tablas con guiones van sin comillas: facturas_e (no facturas-e).
Si la consulta lleva funciones de agregación, elimina LIMIT innecesarios.
Siempre valida que la consulta sea ejecutable.

Ejemplo correcto:
SELECT c.CL_DENO AS cliente, SUM(fe.FE_PTE) AS total_deuda
FROM facturas_e fe
LEFT JOIN clientes c ON fe.FE_CCL = c.id
WHERE UPPER(c.CL_DENO) LIKE '%VARGAS PEREZ%'
AND fe.FE_PTE > 0
GROUP BY c.CL_DENO;

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







**Consulta:** "CUANDO TE CONSULTEN PREGUNTAS COMO:
"¿Qué hay plantado en el sector 22?"
"¿Qué partidas tenemos en el invernadero A1?"
"¿Cuántas bandejas quedan en A2?"
"¿Qué está en la fila 26 del sector 20?"
"saber lo que esta en el sector 22 del c2"
saber lo que esta en el sector 20 del c2
que hay en sector X del X
SE REFIERE A CONSULTAS DE INVERNADEROS Y PARTIDAS. HAZ ESTE TIPO DE CONSULTA OBLIGATORIAMENTE OBLIGATORIO:"

SELECT 
    ppu.id AS codigo_partida, 
    ppu.id2 AS subpartida, 
    a.AR_DENO AS articulo_plantado, 
    ppu.C0 AS invernadero, 
    ppu.C1 AS sector, 
    ppu.C2 AS fila, 
    ppu.C4 AS quedan 
FROM partidas_par_ubic ppu 
INNER JOIN partidas p ON ppu.id = p.id 
INNER JOIN articulos a ON p.PAR_SEM = a.id 
INNER JOIN (
    -- Subconsulta para obtener solo la subpartida más reciente de cada partida
    SELECT id, MAX(id2) as max_subpartida
    FROM partidas_par_ubic 
    GROUP BY id
) latest ON ppu.id = latest.id AND ppu.id2 = latest.max_subpartida
WHERE ppu.C0 = 'A3'  
    AND ppu.C1 = '7' 
    AND (p.PAR_EST != 'T' OR p.PAR_EST IS NULL OR p.PAR_EST = '')
ORDER BY ppu.id DESC 
LIMIT 100;




**OBLIGATORIO: PARA CONSULTAS DE FACTURAS PENDIENTES DE COBRO**

CUANDO TE PREGUNTEN:
- "¿Cuántas facturas debe el cliente X?"
- "¿Cuánto dinero debe el cliente Y?" 
- "¿Qué facturas tiene pendientes Z?"
- "¿Cuál es la deuda del cliente W?"

**SIEMPRE USA FE_PTE > 0 (PENDIENTE DE COBRO), NUNCA FE_TTT > 0 (TOTAL FACTURA)**

**ESTRUCTURA OBLIGATORIA:**

Para ver DETALLE de facturas pendientes:
SELECT 
    fe.id AS factura,
    c.CL_DENO AS cliente,
    fe.FE_FEC AS fecha_factura,
    fe.FE_TTT AS total_factura,
    fe.FE_PTE AS pendiente_cobro
FROM 
    facturas-e fe
    LEFT JOIN clientes c ON fe.FE_CCL = c.id
WHERE 
    UPPER(c.CL_DENO) LIKE '%NOMBRE_CLIENTE%'
    AND fe.FE_PTE > 0
ORDER BY 
    fe.FE_PTE DESC;

Para CONTAR facturas pendientes:
SELECT COUNT(*) AS facturas_pendientes
FROM facturas-e fe 
JOIN clientes c ON fe.FE_CCL = c.id 
WHERE UPPER(c.CL_DENO) LIKE '%NOMBRE_CLIENTE%' 
AND fe.FE_PTE > 0;

Para TOTAL adeudado:
SELECT 
    c.CL_DENO AS cliente,
    COUNT(*) AS cantidad_facturas,
    SUM(fe.FE_PTE) AS total_deuda
FROM facturas-e fe
LEFT JOIN clientes c ON fe.FE_CCL = c.id
WHERE UPPER(c.CL_DENO) LIKE '%NOMBRE_CLIENTE%'
AND fe.FE_PTE > 0
GROUP BY c.CL_DENO;

**DIFERENCIA CRÍTICA:**
- CORRECTO: FE_PTE > 0 = Facturas que REALMENTE debe dinero
- INCORRECTO: FE_TTT > 0 = Todas las facturas emitidas (incluye las ya cobradas)

**NUNCA confundas FE_TTT con FE_PTE en consultas de deudas pendientes.**



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



PARA SABER LAS SEMILLAS QUE HAY EN CAMARA: 
SELECT 
    ra.id AS remesa,
    a.AR_DENO AS articulo,
    c.CL_DENO AS cliente,
    ra.REA_ORI AS origen,
    ev.EV_DENO AS envase,
    SUM(rm.REM_UDS * rm.REM_UXE) AS stock
FROM 
    remesas_art ra
    INNER JOIN remesas_mov rm ON ra.id = rm.REM_REA
    LEFT JOIN articulos a ON ra.REA_AR = a.id
    LEFT JOIN clientes c ON ra.REA_CCL = c.id
    LEFT JOIN envases_vta ev ON ra.REA_SOB = ev.id
GROUP BY 
    ra.id, 
    a.AR_DENO, 
    c.CL_DENO, 
    ra.REA_ORI, 
    ev.EV_DENO
HAVING 
    SUM(rm.REM_UDS * rm.REM_UXE) > 0
ORDER BY 
    ra.id;



Por si te preguntan tambien si hay brocoli ares en camara, u otro articulo, semilla, este es la consulta sql para saber el stock exacto, debes aplicarlo en muchas ocaciones que se te solicite saber el stock, semillas en camara, articulos en camara, ya que da el stock exacto.
Recuerda el diccionario: BROC. ARES y haz esta consulta.

SELECT 
    ra.id AS remesa,
    a.AR_DENO AS articulo,
    c.CL_DENO AS cliente,
    ra.REA_ORI AS origen,
    ev.EV_DENO AS envase,
    SUM(rm.REM_UDS * rm.REM_UXE) AS stock
FROM 
    remesas_art ra
    INNER JOIN remesas_mov rm ON ra.id = rm.REM_REA
    LEFT JOIN articulos a ON ra.REA_AR = a.id
    LEFT JOIN clientes c ON ra.REA_CCL = c.id
    LEFT JOIN envases_vta ev ON ra.REA_SOB = ev.id
WHERE 
    UPPER(a.AR_DENO) LIKE '%BROC. ARES%'
    
GROUP BY 
    ra.id, 
    a.AR_DENO, 
    c.CL_DENO, 
    ra.REA_ORI, 
    ev.EV_DENO
HAVING 
    SUM(rm.REM_UDS * rm.REM_UXE) > 0
ORDER BY 
    ra.id;


PARA SABER EL PRECIO DE UNA SEMILLLA, ARTICULO: 

SELECT 
    a.AR_DENO AS articulo,
    tp.TAP_DENO AS tarifa,
    tp.TAP_DFEC AS inicio_validez,
    tp.TAP_HFEC AS fin_validez,
    lna.C1 AS tipo_tarifa,
    lna.C10 AS precio_fijo_bandeja,
    lna.C11 AS precio_por_planta,
    lna.C12 AS precio_por_bandeja
FROM tarifas_plantas_tap_lna lna
LEFT JOIN articulos a ON lna.C0 = a.id
LEFT JOIN tarifas_plantas tp ON lna.id = tp.id
WHERE a.AR_DENO LIKE '%PEPINO URANO%'
  AND CURRENT_DATE BETWEEN tp.TAP_DFEC AND tp.TAP_HFEC;


PARA VER LOS DATOS GENERALES DE UNA ORDEN DE RECOGIDA

SELECT 
    pc.id AS id_orden,
    pc.PCA_FEC AS fecha,
    pc.PCA_HORA AS hora,
    c.CL_DENO AS cliente,
    a.AM_DENO AS almacen,
    f.FP_DENO AS forma_pago,
    r.RU_DENO AS ruta,
    pc.PCA_EST AS estado
FROM 'p-carga' pc
LEFT JOIN clientes c ON pc.PCA_CCL = c.id
LEFT JOIN almacenes a ON pc.PCA_ALM = a.id
LEFT JOIN fpago f ON pc.PCA_FP = f.id
LEFT JOIN rutas r ON pc.PCA_RUTA = r.id
WHERE pc.id = '00070406';



PARA SABER LAS PARTIDAS, ARTICULOS QUE VAN ASOCIADAS A UNA ORDEN DE RECOGIDA

SELECT 
    pcp.id AS id_orden,
    pcp.id2 AS linea,
    pa.PAR_DENO AS partida,
    ar.AR_DENO AS articulo,
    cli.CL_DENO AS cliente,
    pcp.C3 AS invernadero,
    pcp.C4 AS seccion,
    pcp.C5 AS fila,
    pcp.C6 AS columna,
    pcp.C7 AS bandejas,
    pcp.C8 AS plantas
FROM 'p-carga_pca_par' pcp
LEFT JOIN partidas pa ON pcp.C0 = pa.id
LEFT JOIN articulos ar ON pcp.C2 = ar.id
LEFT JOIN clientes cli ON pcp.C1 = cli.id
WHERE pcp.id = '00070406'
ORDER BY pcp.id2;

ORDENES DE RECOGIDA POR CLIENTE 

SELECT 
    pc.id AS id_orden,
    pc.PCA_FEC AS fecha,
    pc.PCA_ALB AS albaran,
    pc.PCA_EST AS estado,
    c.CL_DENO AS cliente
FROM 'p-carga' pc
LEFT JOIN clientes c ON pc.PCA_CCL = c.id
WHERE c.CL_DENO LIKE '%Garcia%'
ORDER BY pc.PCA_FEC DESC;

Calcular totales de bandejas y plantas en una orden

SELECT 
    pcp.id AS id_orden,
    SUM(pcp.C7) AS total_bandejas,
    SUM(pcp.C8) AS total_plantas
FROM p-carga_pca_par pcp
WHERE pcp.id = '00070404'
GROUP BY pcp.id;


PARA SABER QUE PLANTAS ESTAN LIBRES PARA VENTAS, O NO TIENEN DUEÑO, O PLANTAS LIBRES PARA VENDER: 
SELECT 
    p.id AS id_partida,
    c.CL_DENO AS cliente,
    a.AR_DENO AS articulo,
    pe.C0 AS bandejas_a_venta,
    pe.C1 AS alveolos_a_venta,
    pe.C2 AS plantas_a_venta,
    p.PAR_FECS AS fecha_siembra,
    p.PAR_FECE AS fecha_entrega
FROM 
    partidas p
    LEFT JOIN clientes c ON p.PAR_CCL = c.id
    LEFT JOIN articulos a ON p.PAR_SEM = a.id
    INNER JOIN partidas_par_esta pe ON p.id = pe.id AND pe.id2 = 6
WHERE 
    (p.PAR_EST IS NULL OR p.PAR_EST = '')
    AND pe.C2 > 0
ORDER BY 
    p.PAR_FECS DESC;





PARA SABER PLANTAS LIBRES PARA VENTA POR ARTICULO:

SELECT 
    p.id AS id_partida,
    c.CL_DENO AS cliente,
    a.AR_DENO AS articulo,
    pe.C0 AS bandejas_a_venta,
    pe.C1 AS alveolos_a_venta,
    pe.C2 AS plantas_a_venta,
    p.PAR_FECS AS fecha_siembra,
    p.PAR_FECE AS fecha_entrega
FROM 
    partidas p
    LEFT JOIN clientes c ON p.PAR_CCL = c.id
    LEFT JOIN articulos a ON p.PAR_SEM = a.id
    INNER JOIN partidas_par_esta pe ON p.id = pe.id AND pe.id2 = 6
WHERE 
    (p.PAR_EST IS NULL OR p.PAR_EST = '')
    AND pe.C2 > 0
    AND UPPER(a.AR_DENO) LIKE '%TOMATE%'
ORDER BY 
    p.PAR_FECS DESC;



PARA LAS CONSULTAS SQL USA LOS BACKTIST CORRESPONDIENTES A MYSQL WORKBRENCH \`\ NO USES '' AUN QUE LOS EJEMPLOS LO MUESTREN ASI.

---

**IMPORTANTE:** Estas reglas son OBLIGATORIAS para todas las consultas SQL generadas.`;

module.exports = { sqlRules };
