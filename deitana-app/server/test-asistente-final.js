// =====================================
// TEST: ASISTENTE TÉCNICO OPERATIVO FINAL
// =====================================

const { OpenAI } = require('openai');
const { construirPromptInteligente } = require('./admin/prompts/construirPrompt');
const mapaERP = require('./admin/core/mapaERP');
const pool = require('./db');

require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function testAsistenteFinal() {
    console.log('🧪 [TEST] Probando asistente técnico operativo...');
    
    const consultas = [
        'dime 2 almacenes',
        'muéstrame 3 proveedores',
        'qué son las partidas en Semilleros Deitana'
    ];
    
    for (const mensaje of consultas) {
        console.log(`\n🔍 [TEST] Probando: "${mensaje}"`);
        console.log('='.repeat(60));
        
        try {
            // 1. Construir prompt
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
            
            // 2. Llamar a OpenAI
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
            
            console.log('\n📋 [TEST] Respuesta de OpenAI:');
            console.log('='.repeat(50));
            console.log(respuesta);
            console.log('='.repeat(50));
            
            // 3. Verificar si contiene SQL
            const sqlMatch = respuesta.match(/<sql>([\s\S]*?)<\/sql>/);
            if (sqlMatch) {
                const sql = sqlMatch[1].trim();
                console.log('\n✅ [TEST] SQL encontrado:', sql);
                
                // 4. Ejecutar SQL
                console.log('\n🔍 [TEST] Ejecutando SQL...');
                const [rows] = await pool.query(sql);
                console.log('📊 [TEST] Resultados SQL:', rows.length, 'filas');
                
                if (rows.length > 0) {
                    console.log('✅ [TEST] Datos reales encontrados');
                    rows.forEach((row, index) => {
                        console.log(`${index + 1}.`, row);
                    });
                } else {
                    console.log('⚠️ [TEST] No se encontraron datos en la base de datos');
                }
                
            } else {
                console.log('\nℹ️ [TEST] Respuesta conversacional (sin SQL)');
            }
            
        } catch (error) {
            console.error('❌ [TEST] Error:', error.message);
        }
        
        console.log('\n' + '='.repeat(60));
    }
}

testAsistenteFinal(); 