// =====================================
// REEMPLAZAR FUNCIÓN DE ANÁLISIS DE INTENCIÓN
// =====================================

const fs = require('fs');
const path = require('path');

// Leer el archivo openAI.js
const openAIPath = path.join(__dirname, '../core/openAI.js');
let contenido = fs.readFileSync(openAIPath, 'utf8');

// Nueva función con IA real
const nuevaFuncion = `/**
 * Analiza la intención usando IA real (escalable para 900 tablas y 200 usuarios)
 */
async function analizarIntencionInteligente(mensaje) {
    console.log('🧠 [INTENCION-IA] Analizando consulta con IA real...');
    
    try {
        // Usar IA para analizar la intención de forma inteligente
        const promptAnalisis = \`Analiza la siguiente consulta y determina qué tipo de respuesta necesita:

CONSULTA: "\${mensaje}"

OPCIONES:
1. "sql" - Si la consulta pide datos, números, conteos, listas, información de la base de datos
2. "conocimiento" - Si la consulta pide explicaciones, definiciones, protocolos, información del archivo .txt
3. "conversacion" - Si es un saludo, agradecimiento, o conversación casual

Ejemplos:
- "cuantas partidas se hicieron" → sql
- "qué significa tratamientos extraordinarios" → conocimiento  
- "hola, cómo estás" → conversacion
- "dame la lista de clientes" → sql
- "explica el protocolo de germinación" → conocimiento

Responde SOLO con: sql, conocimiento, o conversacion\`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: promptAnalisis }],
            max_tokens: 10,
            temperature: 0.1
        });

        const tipo = response.choices[0].message.content.trim().toLowerCase();
        console.log(\`✅ [INTENCION-IA] Tipo detectado: \${tipo}\`);

        // Mapear a tipos internos
        if (tipo === 'sql') {
            return { tipo: 'sql', confianza: 0.95 };
        } else if (tipo === 'conocimiento') {
            return { tipo: 'rag_sql', confianza: 0.95 };
        } else {
            return { tipo: 'conversacion', confianza: 0.95 };
        }
        
    } catch (error) {
        console.error('❌ [INTENCION-IA] Error:', error.message);
        // Fallback inteligente: si tiene signo de interrogación, probablemente necesita datos
        if (mensaje.toLowerCase().includes('?')) {
            return { tipo: 'sql', confianza: 0.7 };
        }
        return { tipo: 'conversacion', confianza: 0.5 };
    }
}`;

// Buscar y reemplazar la función
const patronBusqueda = /\/\*\*\s*\n\s*\*\s*Analiza la intención de forma inteligente[\s\S]*?}\s*$/m;
const patronReemplazo = nuevaFuncion;

if (patronBusqueda.test(contenido)) {
    contenido = contenido.replace(patronBusqueda, nuevaFuncion);
    fs.writeFileSync(openAIPath, contenido, 'utf8');
    console.log('✅ [REEMPLAZO] Función de análisis de intención actualizada con IA real');
} else {
    console.log('❌ [REEMPLAZO] No se encontró la función para reemplazar');
}

console.log('🎉 [REEMPLAZO] Proceso completado');
