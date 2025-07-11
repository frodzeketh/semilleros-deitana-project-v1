// Cargar variables de entorno primero
require('dotenv').config();

const pineconeUtils = require('./utils/pinecone');

async function testBusquedaDirecto() {
    console.log('🧪 [TEST DIRECTO] Buscando chunks de informacionEmpresa.txt');
    
    try {
        console.log('\n1️⃣ Buscando "9000 bandejas"...');
        const resultados = await pineconeUtils.buscarRecuerdos('9000 bandejas', 10);
        
        console.log(`📊 Resultados encontrados: ${resultados.length}`);
        
        if (resultados.length > 0) {
            console.log('\n✅ CHUNKS ENCONTRADOS:');
            resultados.forEach((resultado, i) => {
                const esEmpresa = resultado.contenido.includes('SEMILLEROS DEITANA') || 
                                resultado.contenido.includes('informacionEmpresa.txt') ||
                                resultado.contenido.includes('9000');
                
                console.log(`\n${i + 1}. ID: ${resultado.id}`);
                console.log(`   Score: ${resultado.score}`);
                console.log(`   ¿Es de empresa? ${esEmpresa ? '✅ SÍ' : '❌ NO'}`);
                console.log(`   Contenido: ${resultado.contenido.substring(0, 150)}...`);
                
                if (resultado.contenido.includes('9000')) {
                    console.log('   🎯 ¡CONTIENE "9000"! - Este debería ser prioritario');
                }
            });
            
            // Verificar si el primer resultado es de la empresa
            const primerResultado = resultados[0];
            const esPrioritario = primerResultado.contenido.includes('SEMILLEROS DEITANA') || 
                                primerResultado.contenido.includes('9000');
            
            console.log('\n🎯 [DIAGNÓSTICO]:');
            if (esPrioritario) {
                console.log('✅ El RAG SÍ prioriza información de la empresa');
                console.log('   Problema puede estar en el prompt del asistente');
            } else {
                console.log('❌ El RAG NO prioriza información de la empresa');
                console.log('   Necesitamos implementar boost de scoring');
            }
            
        } else {
            console.log('❌ NO se encontraron chunks');
            console.log('   Los chunks no se indexaron o hay problema de conectividad');
        }
        
    } catch (error) {
        console.error('❌ ERROR:', error.message);
    }
}

testBusquedaDirecto(); 