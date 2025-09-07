// =====================================
// TEST DE VARIABILIDAD EN RESPUESTAS
// =====================================

const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Prompt simplificado para máxima variabilidad
const promptSimple = `Eres Deitana IA de Semilleros Deitana. Habla naturalmente como ChatGPT.

REGLAS:
- SÉ NATURAL y conversacional
- VARÍA tu estilo en cada respuesta
- ADAPTA el tono al usuario
- NO uses siempre la misma estructura

Responde de forma única y personalizada cada vez.`;

async function testVariabilidad() {
    console.log('🧪 TESTING VARIABILIDAD DE RESPUESTAS');
    console.log('====================================');
    
    const consulta = "dame 3 clientes";
    const numeroTests = 5;
    
    console.log(`📝 Consulta: "${consulta}"`);
    console.log(`🔢 Número de tests: ${numeroTests}`);
    console.log('');
    
    for (let i = 1; i <= numeroTests; i++) {
        console.log(`🧪 TEST ${i}:`);
        console.log('-'.repeat(30));
        
        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: promptSimple
                    },
                    {
                        role: 'user', 
                        content: consulta
                    }
                ],
                temperature: 0.9,        // Alta creatividad
                max_tokens: 1000,        // Suficiente espacio
                top_p: 0.95,            // Sampling creativo
                frequency_penalty: 0.3,  // Evita repetición
                presence_penalty: 0.2    // Fomenta variedad
            });
            
            const respuesta = response.choices[0].message.content;
            console.log(respuesta);
            console.log('');
            console.log(`📊 Tokens usados: ${response.usage.total_tokens}`);
            console.log('='.repeat(50));
            console.log('');
            
            // Pausa entre requests para evitar rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.error(`❌ Error en test ${i}:`, error.message);
        }
    }
    
    console.log('✅ Test completado');
    console.log('💡 Analiza si las respuestas son diferentes entre sí');
}

// Ejecutar si se llama directamente
if (require.main === module) {
    testVariabilidad().catch(console.error);
}

module.exports = { testVariabilidad };

