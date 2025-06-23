// =====================================
// TEST DE FUNCIONALIDADES DE PINECONE
// =====================================

const pineconeMemoria = require('./utils/pinecone');
const comandosMemoria = require('./utils/comandosMemoria');

async function testPinecone() {
    console.log('🧪 [TEST] Iniciando pruebas de Pinecone...\n');
    
    const testUserId = 'test-user-123';
    
    try {
        // =====================================
        // TEST 1: Guardar un recuerdo
        // =====================================
        console.log('📝 [TEST-1] Guardando recuerdo de prueba...');
        const recuerdoId = await pineconeMemoria.guardarRecuerdo(
            testUserId, 
            'Prefiero bandejas de 104 alvéolos para lechuga porque dan mejor resultado',
            'preferencia'
        );
        console.log('✅ [TEST-1] Recuerdo guardado con ID:', recuerdoId);
        
        // =====================================
        // TEST 2: Buscar recuerdos similares
        // =====================================
        console.log('\n🔍 [TEST-2] Buscando recuerdos similares...');
        const recuerdosEncontrados = await pineconeMemoria.buscarRecuerdos(
            testUserId,
            '¿qué bandeja recomiendas para verduras?',
            3
        );
        console.log('✅ [TEST-2] Recuerdos encontrados:', recuerdosEncontrados.length);
        recuerdosEncontrados.forEach((recuerdo, index) => {
            console.log(`   ${index + 1}. "${recuerdo.texto}" (similitud: ${Math.round(recuerdo.similitud * 100)}%)`);
        });
        
        // =====================================
        // TEST 3: Generar embedding
        // =====================================
        console.log('\n🧠 [TEST-3] Generando embedding de prueba...');
        const embedding = await pineconeMemoria.generarEmbedding('Test de embedding para Semilleros Deitana');
        console.log('✅ [TEST-3] Embedding generado, dimensiones:', embedding.length);
        
        // =====================================
        // TEST 4: Buscar preferencias
        // =====================================
        console.log('\n⚙️ [TEST-4] Buscando preferencias del usuario...');
        const preferencias = await pineconeMemoria.buscarPreferencias(testUserId);
        console.log('✅ [TEST-4] Preferencias encontradas:', preferencias.length);
        preferencias.forEach((pref, index) => {
            console.log(`   ${index + 1}. "${pref.texto}"`);
        });
        
        // =====================================
        // TEST 5: Comando especial
        // =====================================
        console.log('\n🎮 [TEST-5] Probando comando especial...');
        const comandoResult = await comandosMemoria.procesarComandoMemoria('mis recuerdos', testUserId);
        if (comandoResult) {
            console.log('✅ [TEST-5] Comando procesado exitosamente');
            console.log('   Respuesta:', comandoResult.data.message.substring(0, 100) + '...');
        }
        
        // =====================================
        // TEST 6: Contexto de memoria
        // =====================================
        console.log('\n📋 [TEST-6] Generando contexto de memoria...');
        const contexto = await pineconeMemoria.agregarContextoMemoria(testUserId, 'necesito ayuda con bandejas');
        console.log('✅ [TEST-6] Contexto generado, longitud:', contexto.length);
        if (contexto) {
            console.log('   Contexto:', contexto.substring(0, 200) + '...');
        }
        
        console.log('\n🎉 [TEST] ¡Todas las pruebas completadas exitosamente!');
        console.log('✅ Pinecone está funcionando correctamente');
        
    } catch (error) {
        console.error('❌ [TEST] Error durante las pruebas:', error);
        console.error('Stack:', error.stack);
    }
}

async function testComandosEspeciales() {
    console.log('\n🎮 [COMANDOS] Probando comandos especiales...\n');
    
    const testUserId = 'test-comandos-456';
    const comandos = [
        'recuerda que siempre uso sustrato orgánico para tomates',
        'mi preferencia es trabajar en las mañanas',
        'mis recuerdos',
        'busca en mi memoria sobre tomates'
    ];
    
    for (const comando of comandos) {
        console.log(`🎯 [COMANDO] Probando: "${comando}"`);
        try {
            const resultado = await comandosMemoria.procesarComandoMemoria(comando, testUserId);
            if (resultado) {
                console.log('✅ Respuesta:', resultado.data.message.substring(0, 100) + '...\n');
            } else {
                console.log('ℹ️ No es un comando especial\n');
            }
        } catch (error) {
            console.error('❌ Error:', error.message + '\n');
        }
    }
}

// =====================================
// EJECUCIÓN DE TESTS
// =====================================

if (require.main === module) {
    console.log('🚀 Iniciando tests de Pinecone para Semilleros Deitana...\n');
    
    testPinecone()
        .then(() => testComandosEspeciales())
        .then(() => {
            console.log('\n🏁 Tests completados. El sistema de memoria está listo!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Error crítico en tests:', error);
            process.exit(1);
        });
}

module.exports = {
    testPinecone,
    testComandosEspeciales
}; 