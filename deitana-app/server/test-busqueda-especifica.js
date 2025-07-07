// =====================================
// TEST: BÚSQUEDA ESPECÍFICA DE CAMBIO DE AGUA
// =====================================

const ragInteligente = require('./admin/core/ragInteligente');

async function testBusquedaEspecifica() {
    console.log('🧪 [TEST] === TESTEANDO BÚSQUEDA ESPECÍFICA DE CAMBIO DE AGUA ===');
    
    try {
        // 1. Probar la consulta exacta
        const consulta = "¿Cada cuántas bandejas se cambia el agua?";
        console.log(`\n📝 [TEST] Consulta: "${consulta}"`);
        
        const resultadoRAG = await ragInteligente.recuperarConocimientoRelevante(consulta, 'test-especifico');
        
        console.log('\n📊 [TEST] Resultado del RAG:');
        console.log(resultadoRAG);
        
        // 2. Verificar si contiene la información específica
        const contiene9000 = resultadoRAG.includes('9000');
        const contieneCambioAgua = resultadoRAG.toLowerCase().includes('cambio de agua');
        const contieneBandejas = resultadoRAG.toLowerCase().includes('bandejas');
        
        console.log('\n🔍 [TEST] Análisis del resultado:');
        console.log(`• Contiene "9000": ${contiene9000 ? 'SÍ' : 'NO'}`);
        console.log(`• Contiene "cambio de agua": ${contieneCambioAgua ? 'SÍ' : 'NO'}`);
        console.log(`• Contiene "bandejas": ${contieneBandejas ? 'SÍ' : 'NO'}`);
        
        if (contiene9000 && contieneCambioAgua) {
            console.log('✅ [TEST] ¡ÉXITO! El RAG encontró la información específica');
        } else {
            console.log('❌ [TEST] El RAG NO encontró la información específica');
            
            // 3. Probar búsqueda vectorial directa
            console.log('\n🔍 [TEST] Probando búsqueda vectorial directa...');
            
            const resultadoVectorial = await ragInteligente.buscarVectorial(consulta);
            
            console.log('\n📊 [TEST] Resultado de búsqueda vectorial directa:');
            console.log(resultadoVectorial.substring(0, 500) + (resultadoVectorial.length > 500 ? '...' : ''));
            
            // 4. Verificar si la búsqueda vectorial encontró la información
            const vectorialContiene9000 = resultadoVectorial.includes('9000');
            const vectorialContieneCambioAgua = resultadoVectorial.toLowerCase().includes('cambio de agua');
            
            console.log('\n🔍 [TEST] Análisis de búsqueda vectorial:');
            console.log(`• Contiene "9000": ${vectorialContiene9000 ? 'SÍ' : 'NO'}`);
            console.log(`• Contiene "cambio de agua": ${vectorialContieneCambioAgua ? 'SÍ' : 'NO'}`);
            
            if (!vectorialContiene9000) {
                console.log('\n⚠️ [TEST] PROBLEMA: La búsqueda vectorial no encuentra la información específica');
                console.log('Posibles causas:');
                console.log('1. El chunking no está capturando bien esa línea específica');
                console.log('2. El embedding de la consulta no es similar al chunk que contiene la información');
                console.log('3. La información está en un chunk muy grande y se pierde en el contexto');
            }
        }
        
    } catch (error) {
        console.error('❌ [TEST] Error en el test:', error);
    }
}

// Ejecutar el test
testBusquedaEspecifica(); 