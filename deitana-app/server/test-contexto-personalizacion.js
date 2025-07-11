// test-contexto-personalizacion.js
const { processQuery } = require('./admin/core/openAI');

console.log('🧪 [TEST] === VERIFICANDO CONTEXTO CONVERSACIONAL Y PERSONALIZACIÓN ===\n');

async function testContextoYPersonalizacion() {
    const testCases = [
        {
            nombre: "Test Contexto Conversacional",
            consulta1: "¿Quién es Pedro Muñoz?",
            consulta2: "¿de qué estábamos hablando?",
            descripcion: "Primera consulta sobre Pedro Muñoz, luego pregunta por contexto"
        },
        {
            nombre: "Test Personalización",
            consulta1: "dame información de 3 clientes",
            consulta2: "otros",
            descripcion: "Solicitar clientes, luego pedir más (debería usar contexto)"
        },
        {
            nombre: "Test Seguimiento",
            consulta1: "¿Cuántos almacenes tenemos?",
            consulta2: "entonces?",
            descripcion: "Pregunta sobre almacenes, luego solicita continuación"
        }
    ];

    for (const testCase of testCases) {
        console.log(`\n🔬 [TEST] ${testCase.nombre}`);
        console.log(`📝 [TEST] ${testCase.descripcion}\n`);

        try {
            // Primera consulta
            console.log(`1️⃣ [CONSULTA-1] "${testCase.consulta1}"`);
            const resultado1 = await processQuery({
                message: testCase.consulta1,
                userId: 'test-user-contexto',
                conversationId: 'test-conversation-001'
            });

            if (resultado1.success) {
                console.log(`✅ [RESPUESTA-1] ${resultado1.data.message.substring(0, 150)}...`);
                
                // Verificar personalización (buscar nombres en la respuesta)
                const tienePersonalizacion = /\b(test-user|usuario|amigo|hola.*,)/i.test(resultado1.data.message);
                console.log(`🎨 [PERSONALIZACIÓN-1] ${tienePersonalizacion ? 'SÍ detectada' : 'NO detectada'}`);
            } else {
                console.log(`❌ [ERROR-1] ${resultado1.error}`);
                continue;
            }

            // Esperar un momento para simular conversación real
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Segunda consulta (seguimiento)
            console.log(`\n2️⃣ [CONSULTA-2] "${testCase.consulta2}"`);
            const resultado2 = await processQuery({
                message: testCase.consulta2,
                userId: 'test-user-contexto', 
                conversationId: 'test-conversation-001' // Misma conversación
            });

            if (resultado2.success) {
                console.log(`✅ [RESPUESTA-2] ${resultado2.data.message.substring(0, 150)}...`);
                
                // Verificar si mantiene contexto
                const mantieneContexto = !resultado2.data.message.toLowerCase().includes('no tengo información suficiente') &&
                                       !resultado2.data.message.toLowerCase().includes('no hemos tenido una conversación') &&
                                       resultado2.data.message.length > 50;
                
                console.log(`🧠 [CONTEXTO-2] ${mantieneContexto ? 'SÍ mantiene contexto' : 'NO mantiene contexto'}`);
                
                // Verificar personalización
                const tienePersonalizacion2 = /\b(test-user|usuario|amigo|hola.*,)/i.test(resultado2.data.message);
                console.log(`🎨 [PERSONALIZACIÓN-2] ${tienePersonalizacion2 ? 'SÍ detectada' : 'NO detectada'}`);
                
                // Análisis de calidad de seguimiento
                if (mantieneContexto) {
                    console.log(`🎯 [ANÁLISIS] Seguimiento exitoso - El asistente entendió el contexto`);
                } else {
                    console.log(`⚠️ [ANÁLISIS] Seguimiento fallido - El asistente perdió el contexto`);
                }
                
            } else {
                console.log(`❌ [ERROR-2] ${resultado2.error}`);
            }

        } catch (error) {
            console.error(`❌ [ERROR-TEST] Error en ${testCase.nombre}:`, error.message);
        }

        console.log(`\n${'='.repeat(60)}`);
    }

    // Test específico para personalización
    console.log(`\n🎨 [TEST ESPECIAL] Verificando personalización con nombre real`);
    
    try {
        // Simular usuario con displayName
        const resultadoPersonalizado = await processQuery({
            message: "Hola, ¿cómo estás?",
            userId: 'test-user-with-name', // Este usuario tendrá displayName
            conversationId: 'test-conversation-002'
        });

        if (resultadoPersonalizado.success) {
            console.log(`✅ [RESPUESTA-PERSONALIZADA] ${resultadoPersonalizado.data.message}`);
            
            // Verificar si incluye personalización sutil
            const esPersonalizada = resultadoPersonalizado.data.message.includes(',') || 
                                   /hola.*\w+/i.test(resultadoPersonalizado.data.message);
            
            console.log(`🎨 [ANÁLISIS-PERSONALIZACIÓN] ${esPersonalizada ? 'EXITOSA - Respuesta personalizada' : 'ESTÁNDAR - Sin personalización'}`);
        }
    } catch (error) {
        console.error(`❌ [ERROR-PERSONALIZACIÓN]`, error.message);
    }

    console.log(`\n🎉 [TEST COMPLETADO] Verificación de contexto conversacional y personalización finalizada`);
}

// Ejecutar el test
testContextoYPersonalizacion().catch(error => {
    console.error('❌ [ERROR-GENERAL] Error ejecutando test:', error.message);
}); 