// =====================================
// TEST: BÚSQUEDA ESPECÍFICA DE LAVADO Y DESINFECCIÓN
// =====================================

const ragInteligente = require('./admin/core/ragInteligente');

async function testBusquedaLavado() {
    console.log('🧪 [TEST] === TESTEANDO BÚSQUEDA DE LAVADO Y DESINFECCIÓN ===');
    
    try {
        // 1. Probar consultas específicas sobre lavado
        const consultas = [
            "¿Cada cuántas bandejas se cambia el agua?",
            "lavado de bandejas",
            "desinfección de bandejas",
            "frecuencia de cambio de agua",
            "9000 bandejas",
            "Sector Lavado y Desinfección"
        ];
        
        for (const consulta of consultas) {
            console.log(`\n📝 [TEST] Consulta: "${consulta}"`);
            
            const resultadoRAG = await ragInteligente.recuperarConocimientoRelevante(consulta, 'test-lavado');
            
            // Verificar si contiene la información específica
            const contiene9000 = resultadoRAG.includes('9000');
            const contieneCambioAgua = resultadoRAG.toLowerCase().includes('cambio de agua');
            const contieneLavado = resultadoRAG.toLowerCase().includes('lavado');
            const contieneDesinfeccion = resultadoRAG.toLowerCase().includes('desinfección');
            
            console.log(`🔍 [TEST] Análisis:`);
            console.log(`• Contiene "9000": ${contiene9000 ? 'SÍ' : 'NO'}`);
            console.log(`• Contiene "cambio de agua": ${contieneCambioAgua ? 'SÍ' : 'NO'}`);
            console.log(`• Contiene "lavado": ${contieneLavado ? 'SÍ' : 'NO'}`);
            console.log(`• Contiene "desinfección": ${contieneDesinfeccion ? 'SÍ' : 'NO'}`);
            
            if (contiene9000 && contieneCambioAgua) {
                console.log('✅ [TEST] ¡ÉXITO! Encontrada información específica');
                console.log('📄 [TEST] Fragmento relevante:');
                const lineas = resultadoRAG.split('\n');
                const lineasRelevantes = lineas.filter(linea => 
                    linea.includes('9000') || 
                    linea.toLowerCase().includes('cambio de agua')
                );
                lineasRelevantes.forEach(linea => console.log(`   ${linea}`));
                break;
            } else {
                console.log('❌ [TEST] No se encontró información específica');
                
                // Mostrar las primeras líneas del resultado para debug
                const primerasLineas = resultadoRAG.split('\n').slice(0, 5);
                console.log('📄 [TEST] Primeras líneas del resultado:');
                primerasLineas.forEach(linea => console.log(`   ${linea}`));
            }
        }
        
        // 2. Probar búsqueda vectorial directa con términos específicos
        console.log('\n🔍 [TEST] Probando búsqueda vectorial con términos específicos...');
        
        const consultaEspecifica = "lavado desinfección bandejas 9000 cambio agua";
        const resultadoVectorial = await ragInteligente.buscarVectorial(consultaEspecifica);
        
        console.log('\n📊 [TEST] Resultado de búsqueda vectorial específica:');
        console.log(resultadoVectorial.substring(0, 800) + (resultadoVectorial.length > 800 ? '...' : ''));
        
        const vectorialContiene9000 = resultadoVectorial.includes('9000');
        const vectorialContieneCambioAgua = resultadoVectorial.toLowerCase().includes('cambio de agua');
        
        console.log(`\n🔍 [TEST] Análisis de búsqueda vectorial específica:`);
        console.log(`• Contiene "9000": ${vectorialContiene9000 ? 'SÍ' : 'NO'}`);
        console.log(`• Contiene "cambio de agua": ${vectorialContieneCambioAgua ? 'SÍ' : 'NO'}`);
        
        if (vectorialContiene9000) {
            console.log('✅ [TEST] ¡La búsqueda vectorial específica encontró la información!');
        } else {
            console.log('❌ [TEST] La búsqueda vectorial específica tampoco encontró la información');
        }
        
    } catch (error) {
        console.error('❌ [TEST] Error en el test:', error);
    }
}

// Ejecutar el test
testBusquedaLavado(); 