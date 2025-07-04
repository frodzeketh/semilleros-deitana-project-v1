// =====================================
// TEST: DEBUG BÚSQUEDA VECTORIAL
// =====================================

const ragInteligente = require('./admin/core/ragInteligente');
const { Pinecone } = require('@pinecone-database/pinecone');

async function debugBusquedaVectorial() {
    console.log('🔍 [TEST] Debuggeando búsqueda vectorial...');
    
    const consulta = '¿Cuál es la sección de tarifas?';
    console.log(`📝 [TEST] Consulta: "${consulta}"`);
    
    try {
        // 1. Verificar directamente en Pinecone qué fragmentos existen
        console.log('\n🔍 [TEST] === VERIFICANDO FRAGMENTOS EN PINECONE ===');
        
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY
        });
        
        const index = pinecone.Index(process.env.PINECONE_INDEX || 'memoria-deitana');
        
        // Buscar todos los fragmentos de conocimiento empresarial
        const queryResponse = await index.query({
            vector: new Array(1536).fill(0.1), // Vector dummy
            filter: {
                tipo: { $eq: 'conocimiento_empresa' }
            },
            topK: 10,
            includeMetadata: true
        });
        
        console.log(`📊 [TEST] Fragmentos de conocimiento empresarial encontrados: ${queryResponse.matches.length}`);
        
        // Verificar si alguno contiene información de tarifas
        let fragmentosConTarifas = [];
        queryResponse.matches.forEach((match, index) => {
            const contenido = match.metadata.texto || '';
            if (contenido.toLowerCase().includes('tarifa')) {
                fragmentosConTarifas.push({
                    id: match.id,
                    score: match.score,
                    contenido: contenido.substring(0, 100) + '...'
                });
                console.log(`✅ [TEST] Fragmento ${index + 1} SÍ contiene tarifas: ${match.id}`);
                console.log(`   Contenido: ${contenido.substring(0, 150)}...`);
            }
        });
        
        if (fragmentosConTarifas.length === 0) {
            console.log('❌ [TEST] NO se encontraron fragmentos con información de tarifas');
        } else {
            console.log(`✅ [TEST] Encontrados ${fragmentosConTarifas.length} fragmentos con información de tarifas`);
        }
        
        // 2. Probar búsqueda vectorial real
        console.log('\n🔍 [TEST] === PROBANDO BÚSQUEDA VECTORIAL REAL ===');
        
        const resultadoVectorial = await ragInteligente.buscarVectorial(consulta);
        
        if (resultadoVectorial && resultadoVectorial.length > 0) {
            console.log(`✅ [TEST] Búsqueda vectorial devolvió ${resultadoVectorial.length} caracteres`);
            console.log(`📄 [TEST] Respuesta vectorial:`);
            console.log(resultadoVectorial.substring(0, 500) + '...');
            
            // Verificar si contiene información real de tarifas
            if (resultadoVectorial.toLowerCase().includes('sección: tarifas') || 
                resultadoVectorial.toLowerCase().includes('tarifas de plantas') ||
                resultadoVectorial.toLowerCase().includes('denominación') ||
                resultadoVectorial.toLowerCase().includes('identificador único')) {
                console.log('✅ [TEST] ¡ÉXITO! La búsqueda vectorial SÍ encuentra información real de tarifas');
            } else {
                console.log('❌ [TEST] La búsqueda vectorial NO encuentra información real de tarifas');
            }
        } else {
            console.log('❌ [TEST] Búsqueda vectorial devolvió respuesta vacía');
        }
        
        // 3. Verificar qué tipos de fragmentos están siendo encontrados
        console.log('\n🔍 [TEST] === VERIFICANDO TIPOS DE FRAGMENTOS ENCONTRADOS ===');
        
        const queryResponseTodos = await index.query({
            vector: new Array(1536).fill(0.1), // Vector dummy
            topK: 20,
            includeMetadata: true
        });
        
        const tiposEncontrados = {};
        queryResponseTodos.matches.forEach(match => {
            const tipo = match.metadata.tipo || 'sin_tipo';
            if (!tiposEncontrados[tipo]) {
                tiposEncontrados[tipo] = [];
            }
            tiposEncontrados[tipo].push({
                id: match.id,
                score: match.score,
                contenido: (match.metadata.texto || '').substring(0, 50) + '...'
            });
        });
        
        console.log('📊 [TEST] Tipos de fragmentos encontrados:');
        Object.keys(tiposEncontrados).forEach(tipo => {
            console.log(`   - ${tipo}: ${tiposEncontrados[tipo].length} fragmentos`);
            tiposEncontrados[tipo].slice(0, 3).forEach(frag => {
                console.log(`     * ${frag.id} (score: ${frag.score}) - ${frag.contenido}`);
            });
        });
        
    } catch (error) {
        console.error('❌ [TEST] Error en debug:', error);
    }
}

// Ejecutar debug
debugBusquedaVectorial().then(() => {
    console.log('\n✅ [TEST] Debug completado');
}).catch(error => {
    console.error('❌ [TEST] Error en el debug:', error);
}); 