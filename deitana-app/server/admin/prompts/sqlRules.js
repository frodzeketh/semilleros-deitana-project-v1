console.log('🟢 Se está usando: sqlRules.js (admin/prompts)');
// =====================================
// REGLAS SQL - GENERACIÓN Y VALIDACIÓN
// =====================================

const sqlRules = `🎯 REGLAS SQL CRÍTICAS:

## 🚨 FORMATO OBLIGATORIO PARA SQL:
- **SIEMPRE** usa etiquetas <sql>...</sql> para encerrar consultas SQL
- **NUNCA** uses bloques de código markdown (\`\`\`sql)
- **EJEMPLO CORRECTO:**
  <sql>SELECT id, PAR_DENO, PAR_FEC FROM partidas LIMIT 2;</sql>

## 📋 REGLAS DE GENERACIÓN:
1. **Formato**: Usa <sql>...</sql> + respuesta natural
2. **Marcadores**: SELECT CL_DENO → usar [CL_DENO] en respuesta
3. **Validación**: Solo SELECT, nunca INSERT/UPDATE/DELETE
4. **Límites**: Agregar LIMIT automáticamente si no existe
5. **Seguridad**: Usar nombres exactos de mapaERP

## 🎯 INSTRUCCIONES ESPECÍFICAS:
- **Para consultas de datos**: Genera SQL real ejecutable
- **Para explicaciones**: Usa solo texto natural
- **Para combinaciones**: SQL + explicación natural
- **Formato final**: Respuesta natural + <sql>consulta</sql> + resultados

## 🚨 CRÍTICO - NUNCA INVENTES DATOS:
- **NUNCA** inventes nombres, direcciones, teléfonos, emails de entidades
- **NUNCA** inventes datos de clientes, proveedores, almacenes, artículos
- **NUNCA** uses ejemplos ficticios como "PROVEEDOR EJEMPLO" o "ALMACÉN CENTRAL"
- **SIEMPRE** genera SQL real y deja que el sistema ejecute y muestre datos reales
- **SI** no hay datos reales, di claramente "No se encontraron registros en la base de datos"
- **USA** solo el conocimiento empresarial del archivo .txt para contexto, no para datos de entidades

## 🔧 REGLA DE ORO:
- **Para listados de entidades**: SIEMPRE genera SQL, NUNCA inventes datos
- **Para contexto empresarial**: Usa el archivo .txt
- **Para combinaciones**: SQL para datos + .txt para contexto
- **NUNCA** mezcles datos inventados con datos reales`;

module.exports = { sqlRules }; 