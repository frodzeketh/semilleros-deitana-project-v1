// =====================================
// FUNCIÓN DE ANÁLISIS DE INTENCIÓN CON IA REAL
// =====================================

const OpenAI = require('openai');

// Inicializar OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * Analiza la intención usando IA real (escalable para 900 tablas y 200 usuarios)
 */
async function analizarIntencionConIA(mensaje) {
    console.log('🧠 [INTENCION-IA] Analizando consulta con IA real...');
    
    try {
        // Usar IA para analizar la intención de forma inteligente
        const promptAnalisis = `Analiza la siguiente consulta y determina qué tipo de respuesta necesita:

CONSULTA: "${mensaje}"

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

Responde SOLO con: sql, conocimiento, o conversacion`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: promptAnalisis }],
            max_tokens: 10,
            temperature: 0.1
        });

        const tipo = response.choices[0].message.content.trim().toLowerCase();
        console.log(`✅ [INTENCION-IA] Tipo detectado: ${tipo}`);

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
}

// Test de la función
async function testIntencionIA() {
    console.log('🧪 [TEST] Probando análisis de intención con IA...\n');
    
    const consultas = [
        "cuantas partidas se hicieron durante el mes de agosto?",
        "¿Qué información hay sobre Pedro Muñoz?",
        "hola, ¿cómo estás?",
        "dame la lista de clientes",
        "¿Qué son los tratamientos extraordinarios?"
    ];
    
    for (const consulta of consultas) {
        console.log(`🔍 [TEST] Consulta: "${consulta}"`);
        const intencion = await analizarIntencionConIA(consulta);
        console.log(`✅ [TEST] Resultado: ${intencion.tipo} (confianza: ${intencion.confianza})`);
        console.log('---');
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    testIntencionIA().then(() => {
        console.log('\n🎉 Test completado');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Error en test:', error);
        process.exit(1);
    });
}

module.exports = { analizarIntencionConIA };
