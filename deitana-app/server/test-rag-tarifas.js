// =====================================
// TEST: VERIFICACIÓN RAG - SECCIÓN TARIFAS
// =====================================

const { recuperarConocimientoRelevante } = require('./admin/core/ragInteligente');
const fs = require('fs');
const path = require('path');

async function testRAGTarifas() {
    console.log('🔍 [TEST] Verificando por qué el RAG no encuentra información de tarifas...');
    
    // 1. Verificar que el archivo existe y tiene contenido de tarifas
    const archivoPath = path.join(__dirname, 'admin', 'data', 'informacionEmpresa.txt');
    console.log(`📁 [TEST] Ruta del archivo: ${archivoPath}`);
    
    if (fs.existsSync(archivoPath)) {
        console.log('✅ [TEST] El archivo existe');
        const contenido = fs.readFileSync(archivoPath, 'utf8');
        console.log(`📊 [TEST] Tamaño del archivo: ${contenido.length} caracteres`);
        
        // Buscar secciones de tarifas
        const seccionesTarifas = contenido.match(/SECCIÓN: TARIFAS[\s\S]*?(?=SECCIÓN:|$)/gi);
        if (seccionesTarifas) {
            console.log(`✅ [TEST] Encontradas ${seccionesTarifas.length} secciones de tarifas`);
            seccionesTarifas.forEach((seccion, index) => {
                console.log(`📄 [TEST] Sección ${index + 1} (${seccion.length} caracteres):`);
                console.log(seccion.substring(0, 200) + '...');
            });
        } else {
            console.log('❌ [TEST] NO se encontraron secciones de tarifas');
        }
        
        // Buscar cualquier mención de "tarifa"
        const mencionesTarifa = contenido.match(/tarifa/gi);
        if (mencionesTarifa) {
            console.log(`✅ [TEST] Encontradas ${mencionesTarifa.length} menciones de "tarifa"`);
        } else {
            console.log('❌ [TEST] NO se encontraron menciones de "tarifa"');
        }
    } else {
        console.log('❌ [TEST] El archivo NO existe');
        return;
    }
    
    console.log('\n🔍 [TEST] === PROBANDO RAG CON DIFERENTES CONSULTAS ===');
    
    const consultas = [
        '¿Cuál es la sección de tarifas?',
        '¿Qué información hay sobre tarifas?',
        '¿Cuáles son las tarifas?',
        '¿Hay información de precios?',
        '¿Dónde puedo encontrar las tarifas?'
    ];
    
    for (const consulta of consultas) {
        console.log(`\n📝 [TEST] Consulta: "${consulta}"`);
        
        try {
            const resultado = await recuperarConocimientoRelevante(consulta, 'test-tarifas');
            
            if (resultado && resultado.length > 0) {
                console.log(`✅ [TEST] RAG devolvió ${resultado.length} caracteres`);
                console.log(`📄 [TEST] Respuesta RAG:`);
                console.log(resultado.substring(0, 300) + '...');
                
                // Verificar si contiene información de tarifas
                if (resultado.toLowerCase().includes('tarifa') || 
                    resultado.toLowerCase().includes('precio') ||
                    resultado.toLowerCase().includes('costo')) {
                    console.log('✅ [TEST] La respuesta SÍ contiene información de tarifas');
                } else {
                    console.log('❌ [TEST] La respuesta NO contiene información de tarifas');
                }
            } else {
                console.log('❌ [TEST] RAG devolvió respuesta vacía');
            }
        } catch (error) {
            console.error(`❌ [TEST] Error en RAG:`, error.message);
        }
    }
    
    console.log('\n🔍 [TEST] === VERIFICANDO SI EL CONOCIMIENTO ESTÁ CARGADO EN PINECONE ===');
    
    // Verificar si el conocimiento está en Pinecone
    try {
        const { Pinecone } = require('@pinecone-database/pinecone');
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY
        });
        
        const index = pinecone.Index(process.env.PINECONE_INDEX || 'memoria-deitana');
        
        // Buscar por tipo de conocimiento
        const queryResponse = await index.query({
            vector: new Array(1536).fill(0.1), // Vector dummy
            filter: {
                tipo: { $eq: 'conocimiento_empresa' }
            },
            topK: 5,
            includeMetadata: true
        });
        
        console.log(`📊 [TEST] Fragmentos de conocimiento empresarial en Pinecone: ${queryResponse.matches.length}`);
        
        queryResponse.matches.forEach((match, index) => {
            console.log(`📄 [TEST] Fragmento ${index + 1}: ${match.id} (score: ${match.score})`);
            const contenido = match.metadata.texto || '';
            if (contenido.toLowerCase().includes('tarifa')) {
                console.log('✅ [TEST] Este fragmento SÍ contiene información de tarifas');
                console.log(contenido.substring(0, 200) + '...');
            }
        });
        
    } catch (error) {
        console.error(`❌ [TEST] Error verificando Pinecone:`, error.message);
    }
}

// Ejecutar test
testRAGTarifas().then(() => {
    console.log('\n✅ [TEST] Análisis completado');
}).catch(error => {
    console.error('❌ [TEST] Error en el análisis:', error);
}); 