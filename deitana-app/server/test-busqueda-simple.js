const pineconeUtils = require('./utils/pinecone');

async function testBusquedaSimple() {
    console.log('🧪 [TEST SIMPLE] Verificando acceso a chunks');
    
    try {
        // Test 1: Buscar por "9000"
        console.log('\n1️⃣ Buscando "9000"...');
        const resultados9000 = await pineconeUtils.buscarRecuerdos('9000', 5);
        console.log(`   Resultados: ${resultados9000.length}`);
        
        if (resultados9000.length > 0) {
            console.log(`   ✅ ENCONTRADO: ${resultados9000[0].contenido.substring(0, 100)}...`);
            console.log(`   Score: ${resultados9000[0].score}`);
        }
        
        // Test 2: Buscar por "frecuencia"
        console.log('\n2️⃣ Buscando "frecuencia"...');
        const resultadosFrecuencia = await pineconeUtils.buscarRecuerdos('frecuencia', 5);
        console.log(`   Resultados: ${resultadosFrecuencia.length}`);
        
        if (resultadosFrecuencia.length > 0) {
            console.log(`   ✅ ENCONTRADO: ${resultadosFrecuencia[0].contenido.substring(0, 100)}...`);
        }
        
        // Test 3: Buscar por "bandejas"
        console.log('\n3️⃣ Buscando "bandejas"...');
        const resultadosBandejas = await pineconeUtils.buscarRecuerdos('bandejas', 5);
        console.log(`   Resultados: ${resultadosBandejas.length}`);
        
        if (resultadosBandejas.length > 0) {
            console.log(`   ✅ ENCONTRADO: ${resultadosBandejas[0].contenido.substring(0, 100)}...`);
        }
        
        // Test 4: Buscar por "SEMILLEROS DEITANA"
        console.log('\n4️⃣ Buscando "SEMILLEROS DEITANA"...');
        const resultadosEmpresa = await pineconeUtils.buscarRecuerdos('SEMILLEROS DEITANA', 10);
        console.log(`   Resultados: ${resultadosEmpresa.length}`);
        
        if (resultadosEmpresa.length > 0) {
            console.log(`   ✅ ENCONTRADO: ${resultadosEmpresa[0].contenido.substring(0, 100)}...`);
            
            // Mostrar más resultados de empresa
            resultadosEmpresa.forEach((resultado, i) => {
                if (i < 3) {
                    console.log(`   ${i+1}. Score: ${resultado.score} | ${resultado.contenido.substring(0, 80)}...`);
                }
            });
        }
        
        console.log('\n🎯 [DIAGNÓSTICO]:');
        if (resultados9000.length === 0 && resultadosFrecuencia.length === 0) {
            console.log('❌ NO se encuentran chunks específicos de informacionEmpresa.txt');
            console.log('   Problema: Los chunks no se indexaron correctamente O no son buscables');
        } else {
            console.log('✅ SÍ hay chunks indexados');
            console.log('   Problema: El RAG no los prioriza sobre información genérica');
        }
        
    } catch (error) {
        console.error('❌ ERROR en test:', error.message);
    }
}

testBusquedaSimple(); 