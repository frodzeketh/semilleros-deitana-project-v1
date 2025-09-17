// =====================================
// EJEMPLOS SQL PRÁCTICOS
// =====================================
// 
// Este archivo contiene:
// - Ejemplos de consultas SQL comunes
// - Patrones de consulta para diferentes casos
// - Ejemplos de JOINs y relaciones
// - Casos de uso específicos
// =====================================

const sqlExamples = `# 📊 EJEMPLOS SQL PRÁCTICOS

## 🎯 EJEMPLOS POR TIPO DE CONSULTA

### 📋 CONSULTAS DE LISTADO

**Listar clientes:**
\`<sql>SELECT CL_DENO, CL_NOMBRE FROM clientes ORDER BY CL_DENO LIMIT 10</sql>\`

**Listar artículos:**
\`<sql>SELECT AR_DENO, AR_NOMBRE FROM articulos ORDER BY AR_DENO LIMIT 10</sql>\`

**Listar proveedores:**
\`<sql>SELECT PR_DENO, PR_NOMBRE FROM proveedores ORDER BY PR_DENO LIMIT 10</sql>\`

**Listar técnicos:**
\`<sql>SELECT TE_DENO, TE_NOMBRE FROM tecnicos ORDER BY TE_DENO LIMIT 10</sql>\`

### 🔍 CONSULTAS DE BÚSQUEDA

**Buscar cliente específico:**
\`<sql>SELECT * FROM clientes WHERE CL_DENO = 'CLI001'</sql>\`

**Buscar artículos por nombre:**
\`<sql>SELECT * FROM articulos WHERE AR_DENO LIKE '%tomate%' LIMIT 5</sql>\`

**Buscar proveedor por código:**
\`<sql>SELECT * FROM proveedores WHERE PR_DENO = 'PRV001'</sql>\`

**Búsqueda flexible en artículos:**
\`<sql>SELECT * FROM articulos WHERE AR_DENO LIKE '%semilla%' OR AR_REF LIKE '%semilla%' LIMIT 5</sql>\`

### 📈 CONSULTAS DE ANÁLISIS

**Contar total de clientes:**
\`<sql>SELECT COUNT(*) as total_clientes FROM clientes</sql>\`

**Contar artículos por tipo:**
\`<sql>SELECT AR_TIPO, COUNT(*) as cantidad FROM articulos GROUP BY AR_TIPO</sql>\`

**Análisis de proveedores:**
\`<sql>SELECT PR_PAIS, COUNT(*) as cantidad FROM proveedores GROUP BY PR_PAIS</sql>\`

**Estadísticas de técnicos:**
\`<sql>SELECT TE_ESPECIALIDAD, COUNT(*) as cantidad FROM tecnicos GROUP BY TE_ESPECIALIDAD</sql>\`

### 🔗 CONSULTAS CON JOINs

**Clientes con sus artículos:**
\`<sql>SELECT c.CL_DENO, c.CL_NOMBRE, a.AR_DENO, a.AR_NOMBRE 
FROM clientes c 
JOIN articulos a ON c.CL_ID = a.AR_CLI_ID 
ORDER BY c.CL_DENO LIMIT 10</sql>\`

**Artículos con proveedor:**
\`<sql>SELECT a.AR_DENO, a.AR_NOMBRE, p.PR_DENO, p.PR_NOMBRE 
FROM articulos a 
JOIN proveedores p ON a.AR_PRV_ID = p.PR_ID 
ORDER BY a.AR_DENO LIMIT 10</sql>\`

**Técnicos con especialidad:**
\`<sql>SELECT t.TE_DENO, t.TE_NOMBRE, t.TE_ESPECIALIDAD 
FROM tecnicos t 
WHERE t.TE_ESPECIALIDAD = 'Horticultura' 
ORDER BY t.TE_NOMBRE LIMIT 10</sql>\`

### 🎯 CASOS DE USO ESPECÍFICOS

**Bandejas de 104 alvéolos:**
\`<sql>SELECT * FROM bandejas WHERE BA_ALV = 104 ORDER BY BA_DENO</sql>\`

**Artículos de tomate:**
\`<sql>SELECT * FROM articulos WHERE AR_DENO LIKE '%tomate%' ORDER BY AR_DENO LIMIT 5</sql>\`

**Clientes de Murcia:**
\`<sql>SELECT * FROM clientes WHERE CL_PROVINCIA = 'Murcia' ORDER BY CL_NOMBRE</sql>\`

**Proveedores activos:**
\`<sql>SELECT * FROM proveedores WHERE PR_ACTIVO = 1 ORDER BY PR_NOMBRE</sql>\`

## 🚨 PATRONES COMUNES A EVITAR

### ❌ PATRONES INCORRECTOS:

**LIMIT 1 para listados:**
\`<sql>SELECT * FROM clientes LIMIT 1</sql>\` (INCORRECTO para listar)

**Sin ORDER BY:**
\`<sql>SELECT * FROM articulos LIMIT 10</sql>\` (SIN ORDEN)

**Búsqueda muy amplia:**
\`<sql>SELECT * FROM articulos WHERE AR_DENO LIKE '%a%'</sql>\` (MUY AMPLIA)

**Sin LIMIT en listados:**
\`<sql>SELECT * FROM clientes</sql>\` (SIN LIMIT)

### ✅ PATRONES CORRECTOS:

**Listado ordenado:**
\`<sql>SELECT * FROM clientes ORDER BY CL_DENO LIMIT 10</sql>\`

**Búsqueda específica:**
\`<sql>SELECT * FROM articulos WHERE AR_DENO = 'TOM001'</sql>\`

**Búsqueda flexible controlada:**
\`<sql>SELECT * FROM articulos WHERE AR_DENO LIKE '%tomate%' LIMIT 5</sql>\`

**Conteo sin LIMIT:**
\`<sql>SELECT COUNT(*) as total FROM clientes</sql>\`

## 🎯 REGLAS DE APLICACIÓN

### 📋 PARA LISTADOS:
1. Usar \`ORDER BY\` para ordenar
2. Usar \`LIMIT 10\` máximo
3. Seleccionar columnas relevantes
4. Evitar \`SELECT *\` cuando sea posible

### 🔍 PARA BÚSQUEDAS:
1. Usar \`WHERE\` con condiciones específicas
2. Usar \`LIKE\` con \`%\` para búsquedas flexibles
3. Limitar resultados con \`LIMIT\`
4. Ordenar resultados

### 📈 PARA ANÁLISIS:
1. Usar funciones agregadas (\`COUNT\`, \`SUM\`, etc.)
2. Usar \`GROUP BY\` para agrupar
3. NO usar \`LIMIT\` en conteos
4. Usar alias para claridad

### 🔗 PARA JOINs:
1. Usar las relaciones definidas en mapaERP
2. Especificar alias de tablas
3. Usar \`ORDER BY\` para ordenar resultados
4. Limitar resultados con \`LIMIT\`

## 🎯 INSTRUCCIONES DE USO

### ✅ CUANDO USAR CADA TIPO:

**Listados:** Cuando el usuario pide "dame", "muestra", "lista"
**Búsquedas:** Cuando el usuario busca algo específico
**Análisis:** Cuando el usuario pide "cuántos", "cuántas", "estadísticas"
**JOINs:** Cuando el usuario pide información relacionada

### 🎯 EJEMPLOS DE CONSULTAS DE USUARIO:

**"Dame 3 clientes"** → Listado
**"Busca el cliente CLI001"** → Búsqueda específica
**"Cuántos artículos hay"** → Análisis
**"Dame clientes con sus artículos"** → JOIN


PARA SABER QUE PLANTAS ESTAN LIBRES PARA VENTAS, O NO TIENEN DUEÑO, O PLANTAS LIBRES PARA VENDER: 

SELECT 
    p.id AS partida_id,
    p.PAR_DENO AS descripcion_partida,
    e.C0 AS bandejas_disponibles,
    e.C1 AS alveolos_disponibles, 
    e.C2 AS plantas_disponibles,
    p.PAR_FECS AS fecha_siembra,
    p.PAR_FECE AS fecha_entrega,
    p.PAR_NMCL AS nombre_cliente,
    p.PAR_NMSM AS nombre_semilla
FROM partidas p
INNER JOIN partidas_par_esta e ON p.id = e.id
WHERE e.id2 = 6  -- Disponible para venta
  AND (
    (e.C0 IS NOT NULL AND REPLACE(e.C0, ',', '.') + 0 > 0) OR  
    (e.C1 IS NOT NULL AND REPLACE(e.C1, ',', '.') + 0 > 0) OR  
    (e.C2 IS NOT NULL AND REPLACE(e.C2, ',', '.') + 0 > 0)     
  )
  AND TRIM(COALESCE(p.PAR_EST, '')) IN ('C', 'R', '')  -- Estados C, R o vacío
ORDER BY REPLACE(e.C2, ',', '.') + 0 DESC;



PARA SABER QUE PLANTAS ESTAN LIBRES PARA VENTAS, NO TIENEN DUEÑO, O PLANTAS LIBRES PARA VENDER Y SABER EL DUEÑO DE LA PARTIDA O CLIENTE: 

SELECT 
    p.id AS partida_id,
    p.PAR_DENO AS descripcion_partida,
    e.C0 AS bandejas_disponibles,
    e.C1 AS alveolos_disponibles, 
    e.C2 AS plantas_disponibles,
    p.PAR_FECS AS fecha_siembra,
    p.PAR_FECE AS fecha_entrega,
    c.CL_DENO AS nombre_cliente_tabla,  -- Cliente desde tabla clientes
    p.PAR_NMCL AS nombre_cliente_partida,  -- Cliente desde partidas
    p.PAR_NMSM AS nombre_semilla
FROM partidas p
INNER JOIN partidas_par_esta e ON p.id = e.id
LEFT JOIN clientes c ON p.PAR_CCL = c.id  -- JOIN con tabla clientes
WHERE e.id2 = 6  -- Disponible para venta
  AND (
    (e.C0 IS NOT NULL AND REPLACE(e.C0, ',', '.') + 0 > 0) OR  
    (e.C1 IS NOT NULL AND REPLACE(e.C1, ',', '.') + 0 > 0) OR  
    (e.C2 IS NOT NULL AND REPLACE(e.C2, ',', '.') + 0 > 0)     
  )
  AND TRIM(COALESCE(p.PAR_EST, '')) IN ('C', 'R', '')  -- Estados C, R o vacío
ORDER BY REPLACE(e.C2, ',', '.') + 0 DESC;


PARA SABER PLANTAS LIBRES PARA VENTA POR ARTICULO 

SELECT 
    p.id AS partida_id,
    p.PAR_DENO AS descripcion_partida,
    e.C0 AS bandejas_disponibles,
    e.C1 AS alveolos_disponibles, 
    e.C2 AS plantas_disponibles,
    p.PAR_FECS AS fecha_siembra,
    p.PAR_FECE AS fecha_entrega,
    c.CL_DENO AS nombre_cliente_tabla,
    p.PAR_NMCL AS nombre_cliente_partida,
    p.PAR_SEM AS id_articulo,
    a.AR_DENO AS nombre_articulo,
    p.PAR_NMSM AS nombre_semilla_partida
FROM partidas p
INNER JOIN partidas_par_esta e ON p.id = e.id
LEFT JOIN clientes c ON p.PAR_CCL = c.id
LEFT JOIN articulos a ON p.PAR_SEM = a.id
WHERE e.id2 = 6  -- Disponible para venta
  AND (
    (e.C0 IS NOT NULL AND REPLACE(e.C0, ',', '.') + 0 > 0) OR  
    (e.C1 IS NOT NULL AND REPLACE(e.C1, ',', '.') + 0 > 0) OR  
    (e.C2 IS NOT NULL AND REPLACE(e.C2, ',', '.') + 0 > 0)     
  )
  AND TRIM(COALESCE(p.PAR_EST, '')) IN ('C', 'R', '')
  -- DESCOMENTA Y AJUSTA LA LÍNEA DE ABAJO CON EL ARTÍCULO QUE QUIERAS BUSCAR:
  AND UPPER(a.AR_DENO) LIKE '%BROC%'  
  -- AND UPPER(a.AR_DENO) LIKE '%PEPINO%'   -- Para buscar pepino
  -- AND UPPER(a.AR_DENO) LIKE '%URANO%'    -- Para buscar urano
ORDER BY a.AR_DENO, REPLACE(e.C2, ',', '.') + 0 DESC;


---

**IMPORTANTE:** Estos ejemplos son patrones de referencia. Adapta las consultas según la estructura real de tu base de datos.`;

module.exports = { sqlExamples };
