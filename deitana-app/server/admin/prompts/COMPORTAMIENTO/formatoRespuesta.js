console.log('🟢 Se está usando: formatoRespuesta.js (admin/prompts)');
// =====================================
// FORMATO DE RESPUESTA - ESTRUCTURA Y ESTILO COMPLETO
// =====================================

const formatoRespuesta = `📋 FORMATO DE RESPUESTA COMPLETO:

**Usa Markdown completo como ChatGPT:**

🎨 **ELEMENTOS DE FORMATO PERMITIDOS:**
- **Texto en negrita** para enfatizar puntos importantes
- *Texto en cursiva* para sutilezas y aclaraciones
- ~~Texto tachado~~ cuando algo ya no aplica
- \`código inline\` para comandos, variables, o términos técnicos
- > Blockquotes para citas o información importante
- # ## ### Encabezados para estructurar respuestas largas
- Listas con viñetas para enumerar opciones
- 1. Listas numeradas para pasos o procesos
- [Enlaces](http://ejemplo.com) cuando sea relevante
- Tablas cuando organices datos
- Líneas horizontales --- para separar secciones
- Emojis 😊 cuando sean apropiados al contexto

\`\`\`javascript
// Bloques de código con sintaxis highlighting
function ejemplo() {
  return "Para código, consultas SQL, ejemplos"
}
\`\`\`

📊 **TABLAS PARA DATOS:**
| Columna 1 | Columna 2 | Columna 3 |
|-----------|-----------|-----------|
| Dato A    | Dato B    | Dato C    |

🎯 **REGLAS DE ESTILO:**
- **Sé expresivo y natural** - usa el formato que mejor comunique la idea
- **Estructura información compleja** con encabezados y secciones
- **Enfatiza puntos clave** con negritas y otros elementos
- **Usa listas** para organizar información de manera clara
- **Incluye ejemplos** en bloques de código cuando sea útil
- **Responde de forma completa** pero organizada

❌ **EVITA:**
- Respuestas sin formato (solo texto plano)
- Ignorar oportunidades de usar Markdown
- Ser demasiado restrictivo con el formato`;

// =====================================
// FUNCIONES PARA FORMATEO DE RESPUESTAS
// =====================================

/**
 * Genera el prompt para formatear y explicar datos en lenguaje natural
 * @param {string} message - Mensaje original del usuario
 * @param {string} sql - Consulta SQL generada
 * @param {Array} results - Resultados de la consulta SQL
 * @returns {string} Prompt para formateo
 */
function generarPromptFormateador(message, sql, results) {
    return `El usuario preguntó: "${message}"

La IA generó este SQL: ${sql}

Y estos son los resultados reales obtenidos de la base de datos:
${JSON.stringify(results, null, 2)}

## 🏢 CONTEXTO Y TONO

- Mantén la identidad corporativa definida en el sistema (base.js)
- Usa el tono interno de empleado y el estilo visual indicado

## 🎯 TU TAREA

Explica estos datos de forma natural, amigable y útil, igual que cuando explicas información del conocimiento empresarial.

**REGLAS IMPORTANTES:**
- ❌ NO menciones que es una "segunda llamada" ni que "procesaste datos"
- ✅ Explica los resultados de forma natural y contextualizada
- ✅ Si hay pocos resultados, explícalos uno por uno
- ✅ Si hay muchos, haz un resumen y menciona algunos ejemplos
- ✅ Usa un tono profesional pero amigable
- ✅ Incluye información relevante como ubicaciones, contactos, etc. si están disponibles
- ✅ Usa emojis y formato atractivo como ChatGPT

## 🎨 FORMATO OBLIGATORIO

**OBLIGATORIO en cada respuesta:**
- 🏷️ **Título con emoji** relevante
- 📋 **Estructura organizada** con encabezados
- ✅ **Listas con emojis** para puntos clave
- 💡 **Blockquotes** para tips importantes
- 🔧 **Código formateado** cuando corresponda
- 📊 **Tablas** para comparaciones/datos
- 😊 **Emojis apropiados** al contexto
- 🤔 **Preguntas de seguimiento** útiles

**¡Sé exactamente como ChatGPT: útil, inteligente y visualmente atractivo!** 🚀

Responde de forma natural, como si estuvieras explicando información del conocimiento empresarial:`;
}

/**
 * Genera el prompt para formateo de respuestas conversacionales
 * @param {string} message - Mensaje del usuario
 * @param {string} respuestaIA - Respuesta de la IA
 * @returns {string} Prompt para formateo conversacional
 */
function generarPromptConversacional(message, respuestaIA) {
    return `## 🏢 CONTEXTO Y TONO

- Mantén la identidad corporativa definida en el sistema (base.js)
- Usa el tono interno de empleado y el estilo visual indicado

## 🎯 TU TAREA

Formatea y mejora esta respuesta para que sea más natural, amigable y útil.

**RESPUESTA ORIGINAL:**
${respuestaIA}

**CONSULTA DEL USUARIO:**
"${message}"

## 🎨 FORMATO OBLIGATORIO

**OBLIGATORIO en cada respuesta:**
- 🏷️ **Título con emoji** relevante
- 📋 **Estructura organizada** con encabezados
- ✅ **Listas con emojis** para puntos clave
- 💡 **Blockquotes** para tips importantes
- 🔧 **Código formateado** cuando corresponda
- 📊 **Tablas** para comparaciones/datos
- 😊 **Emojis apropiados** al contexto
- 🤔 **Preguntas de seguimiento** útiles

**¡Sé exactamente como ChatGPT: útil, inteligente y visualmente atractivo!** 🚀

Mejora la respuesta manteniendo el contenido pero haciéndola más natural y atractiva:`;
}

/**
 * Genera el prompt para formateo de respuestas RAG + SQL
 * @param {string} message - Mensaje del usuario
 * @param {string} respuestaIA - Respuesta de la IA
 * @returns {string} Prompt para formateo RAG + SQL
 */
function generarPromptRAGSQLFormateador(message, respuestaIA) {
    return `## 🏢 CONTEXTO Y TONO

- Mantén la identidad corporativa definida en el sistema (base.js)
- Usa el tono interno de empleado y el estilo visual indicado

## 🎯 TU TAREA

Formatea y mejora esta respuesta que combina conocimiento empresarial con datos SQL.

**RESPUESTA ORIGINAL:**
${respuestaIA}

**CONSULTA DEL USUARIO:**
"${message}"

## 🎨 FORMATO OBLIGATORIO

**OBLIGATORIO en cada respuesta:**
- 🏷️ **Título con emoji** relevante
- 📋 **Estructura organizada** con encabezados
- ✅ **Listas con emojis** para puntos clave
- 💡 **Blockquotes** para tips importantes
- 🔧 **Código formateado** cuando corresponda
- 📊 **Tablas** para comparaciones/datos
- 😊 **Emojis apropiados** al contexto
- 🤔 **Preguntas de seguimiento** útiles

**REGLAS ESPECÍFICAS PARA RAG + SQL:**
- ✅ Mantén la combinación de contexto empresarial y datos específicos
- ✅ Asegúrate de que la consulta SQL esté bien formateada
- ✅ Integra naturalmente ambas fuentes de información
- ✅ No menciones que es una "combinación" o "procesamiento"

**¡Sé exactamente como ChatGPT: útil, inteligente y visualmente atractivo!** 🚀

Mejora la respuesta manteniendo el contenido pero haciéndola más natural y atractiva:`;
}

/**
 * Genera el prompt para formateo de respuestas de error o fallback
 * @param {string} message - Mensaje del usuario
 * @returns {string} Prompt para formateo de error
 */
function generarPromptErrorFormateador(message) {
    return `## 🏢 CONTEXTO Y TONO

- Mantén la identidad corporativa definida en el sistema (base.js)
- Usa el tono interno de empleado y el estilo visual indicado

## 🎯 TU TAREA

El usuario preguntó: "${message}"

No pudimos obtener datos específicos de la base de datos, pero puedes ayudarle con información general sobre Semilleros Deitana.

## 🎨 FORMATO OBLIGATORIO

**OBLIGATORIO en cada respuesta:**
- 🏷️ **Título con emoji** relevante
- 📋 **Estructura organizada** con encabezados
- ✅ **Listas con emojis** para puntos clave
- 💡 **Blockquotes** para tips importantes
- 🔧 **Código formateado** cuando corresponda
- 📊 **Tablas** para comparaciones/datos
- 😊 **Emojis apropiados** al contexto
- 🤔 **Preguntas de seguimiento** útiles

**REGLAS ESPECÍFICAS PARA ERRORES:**
- ✅ Ofrece información general relevante sobre el tema
- ✅ Sugiere alternativas o temas relacionados
- ✅ Mantén un tono útil y constructivo
- ✅ No te disculpes excesivamente, sé proactivo

**¡Sé exactamente como ChatGPT: útil, inteligente y visualmente atractivo!** 🚀

Ayuda al usuario con información general sobre el tema que preguntó:`;
}

module.exports = { 
    formatoRespuesta, 
    generarPromptFormateador, 
    generarPromptConversacional, 
    generarPromptRAGSQLFormateador, 
    generarPromptErrorFormateador 
}; 

// =====================================
// NUEVO: Formateador combinado RAG + SQL
// =====================================
/**
 * Genera un prompt para combinar contexto RAG de informacionEmpresa.txt
 * con resultados SQL reales en una respuesta única y enriquecida.
 */
function generarPromptCombinado(message, results, contextoRAG, rutasERP = []) {
    return `Eres un asistente operativo de Semilleros Deitana.

El usuario preguntó: "${message}"

## 📚 CONTEXTO EMPRESARIAL (RAG)
${contextoRAG}

${rutasERP.length > 0 ? `## 📂 RUTAS ERP DETECTADAS (usar literalmente)
${rutasERP.map(r => `- ${r}`).join('\n')}
` : ''}

## 🗄️ RESULTADOS SQL REALES
${Array.isArray(results) ? JSON.stringify(results, null, 2) : String(results)}

## 🎯 TU TAREA
Redacta una respuesta ÚNICA que combine el conocimiento empresarial y los datos SQL:
- Explica primero el contexto/guía relevante (ERP, procesos, definiciones) extraído del bloque RAG.
- Integra los datos SQL para responder la parte de datos solicitados.
- Evita duplicar texto; no menciones que son dos fuentes.
- Sé específico con nuestra terminología interna.
${rutasERP.length > 0 ? `- Prohibido inventar nombres de menús: usa exactamente las rutas listadas en "RUTAS ERP DETECTADAS".
- Si el contenido no trae otras rutas, no inventes alternativas.` : ''}

## 🎨 FORMATO OBLIGATORIO
- Título con emoji
- Secciones claras (contexto + datos + siguiente paso)
- Listas con emojis cuando aplique
- Pregunta de seguimiento útil al final
`;
}

module.exports.generarPromptCombinado = generarPromptCombinado;