// =====================================
// REGLAS SQL - GENERACIÓN Y VALIDACIÓN
// =====================================

const sqlRules = `🎯 REGLAS SQL:

1. **Generación**: Usa <sql>...</sql> + respuesta con marcadores [columna]
2. **Marcadores**: SELECT CL_DENO → usar [CL_DENO] en respuesta
3. **Validación**: Solo SELECT, nunca INSERT/UPDATE/DELETE
4. **Límites**: Agregar LIMIT automáticamente si no existe
5. **Seguridad**: Usar nombres exactos de mapaERP

🚨 CRÍTICO:
- NUNCA inventes datos
- USA solo marcadores [columna] para datos reales
- Nombres de tablas exactos (algunos usan guiones)`;

module.exports = { sqlRules }; 