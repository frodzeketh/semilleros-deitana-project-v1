const { processQuery } = require('./admin/core/openAI');

async function testLangfuseActivado() {
    console.log('🧪 [TEST-LANGFUSE] ===== VERIFICANDO LANGFUSE ACTIVO =====');
    
    const userId = 'test-langfuse-user';
    const conversationId = 'test-conversation-' + Date.now();
    
    try {
        console.log('\n🔍 [TEST] Enviando consulta de prueba...');
        
        const respuesta = await processQuery({
            message: 'quien es pedro muñoz',
            userId: userId,
            conversationId: conversationId
        });
        
        console.log('✅ [TEST] Respuesta recibida:', respuesta.success ? 'ÉXITO' : 'ERROR');
        
        if (respuesta.success) {
            console.log('📝 [TEST] Mensaje:', respuesta.data.message.substring(0, 100) + '...');
            console.log('✅ [TEST] Langfuse debería haber registrado esta interacción');
            
            // Verificar que Langfuse esté disponible
            const { langfuse } = require('./utils/langfuse');
            console.log('🔗 [TEST] Conexión Langfuse:', langfuse ? 'DISPONIBLE' : 'NO DISPONIBLE');
            
            // Forzar flush para asegurar que los datos se envíen
            await langfuse.flushAsync();
            console.log('📊 [TEST] Datos enviados a Langfuse dashboard');
            
        } else {
            console.log('❌ [TEST] Error en la respuesta:', respuesta.error);
        }
        
    } catch (error) {
        console.error('❌ [TEST] Error:', error.message);
        console.error(error.stack);
    }
    
    console.log('\n📋 [TEST] Verifica en tu dashboard de Langfuse:');
    console.log('📋 [TEST] - Busca traces con nombre "consulta-optimizada"');
    console.log('📋 [TEST] - Usuario: test-langfuse-user');
    console.log('📋 [TEST] - Mensaje: "quien es pedro muñoz"');
    console.log('📋 [TEST] - Deberías ver métricas de tokens, tiempo y costo');
}

testLangfuseActivado(); 