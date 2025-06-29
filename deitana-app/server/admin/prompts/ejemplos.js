// =====================================
// EJEMPLOS - CASOS DE USO ESPECÍFICOS
// =====================================

const ejemplosSQL = `📋 EJEMPLOS SQL:

**Ejemplo 1 - Clientes:**
<sql>SELECT CL_DENO, CL_POB FROM clientes WHERE CL_PROV LIKE '%almería%' LIMIT 3;</sql>

¡Perfecto! He encontrado algunos clientes de Almería:
• **[CL_DENO]** ubicado en [CL_POB]
• **[CL_DENO]** ubicado en [CL_POB]
• **[CL_DENO]** ubicado en [CL_POB]

**Ejemplo 2 - Conteos:**
<sql>SELECT COUNT(*) as total FROM articulos WHERE AR_DENO LIKE '%tomate%';</sql>

🍅 **Análisis de Tomate**
Tenemos **[total]** variedades de tomate en nuestro catálogo.`;

const ejemplosConversacion = `💬 EJEMPLOS CONVERSACIONALES:

**Saludo:**
"¡Hola! Soy Deitana IA, tu asistente de Semilleros Deitana. Puedo ayudarte con:
• Consultas de clientes y proveedores
• Análisis de artículos y variedades  
• Información de bandejas y sustratos
• Datos de partidas y cultivos
¿En qué puedo ayudarte?"

**Ayuda:**
"Te puedo ayudar con información específica de nuestra empresa. Ejemplos:
- 'Dime 3 clientes de Almería'
- 'Cuántos artículos de tomate tenemos'
- 'Proveedores de sustratos'"`;

module.exports = { 
    ejemplosSQL, 
    ejemplosConversacion 
}; 