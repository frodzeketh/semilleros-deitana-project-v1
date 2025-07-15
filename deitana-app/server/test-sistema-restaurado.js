// =====================================
// TEST: SISTEMA RESTAURADO
// =====================================

const { OpenAI } = require('openai');
const { construirPromptInteligente } = require('./admin/prompts/construirPrompt');
const mapaERP = require('./admin/core/mapaERP');

require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function testSistemaRestaurado() {
    console.log('🧪 [TEST] Probando sistema RESTAURADO...');
    
    const mensaje = 'dime 2 partidas';
    
    try {
        // Construir prompt con IA
        const promptBuilder = await construirPromptInteligente(
            mensaje, 
            mapaERP,
            openai,
            '', // contextoPinecone
            '', // contextoDatos
            true // modoDesarrollo
        );
        
        console.log('📋 [TEST] Prompt construido');
        console.log('🎯 [TEST] Intención:', promptBuilder.intencion);
        console.log('📊 [TEST] Tablas relevantes:', promptBuilder.tablasRelevantes);
        
        // Llamar a OpenAI
        const response = await openai.chat.completions.create({
            model: promptBuilder.configModelo.modelo,
            messages: [
                {
                    role: 'system',
                    content: promptBuilder.prompt
                },
                {
                    role: 'user', 
                    content: mensaje
                }
            ],
            max_tokens: promptBuilder.configModelo.maxTokens,
            temperature: promptBuilder.configModelo.temperature
        });
        
        const respuesta = response.choices[0].message.content;
        
        console.log('\n📋 [TEST] Respuesta completa:');
        console.log('='.repeat(50));
        console.log(respuesta);
        console.log('='.repeat(50));
        
        // Verificar si contiene SQL
        const sqlMatch = respuesta.match(/<sql>([\s\S]*?)<\/sql>/);
        if (sqlMatch) {
            console.log('\n✅ [TEST] SQL encontrado:');
            console.log(sqlMatch[1]);
        } else {
            console.log('\n❌ [TEST] NO se encontró SQL en formato <sql>...</sql>');
        }
        
    } catch (error) {
        console.error('❌ [TEST] Error:', error.message);
    }
}

testSistemaRestaurado(); 