// =====================================
// TEST: DEBUG TRASLADO DE INVERNADERO
// =====================================

require('dotenv').config();
const { recuperarConocimientoRelevante } = require('./admin/core/ragInteligente');
const { Pinecone } = require('@pinecone-database/pinecone');
const fs = require('fs');
const path = require('path');

async function testTrasladoInvernadero() {
    console.log('🔍 [TEST] Debuggeando traslado de invernadero...');
    
    const consulta = '¿Qué es traslado de invernadero?';
    console.log(`📝 [TEST] Consulta: "${consulta}"`);
    
    // 1. Verificar que el archivo contiene la información
    const archivoPath = path.join(__dirname, 'admin', 'data', 'informacionEmpresa.txt');
    const contenido = fs.readFileSync(archivoPath, 'utf8');
    
    // Buscar información sobre traslado de invernadero
    const mencionesTraslado = contenido.match(/traslado.*invernadero/gi);
    console.log(`📊 [TEST] Menciones de "traslado invernadero" en archivo: ${mencionesTraslado ? mencionesTraslado.length : 0}`);
    
    if (mencionesTraslado) {
        console.log('✅ [TEST] El archivo SÍ contiene información sobre traslado de invernadero');
    } else {
        console.log('❌ [TEST] El archivo NO contiene información sobre traslado de invernadero');
    }
    
    // 2. Verificar qué fragmentos están en Pinecone
    console.log('\n🔍 [TEST] === VERIFICANDO FRAGMENTOS EN PINECONE ===');
    
    const pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY
    });
    
    const index = pinecone.Index(process.env.PINECONE_INDEX || 'memoria-deitana');
    
    // Buscar fragmentos que contengan "traslado" o "invernadero"
    const queryResponse = await index.query({
        vector: new Array(1536).fill(0.1), // Vector dummy
        topK: 20,
        includeMetadata: true
    });
    
    let fragmentosRelevantes = [];
    queryResponse.matches.forEach(match => {
        const contenido = match.metadata.texto || '';
        if (contenido.toLowerCase().includes('traslado') || 
            contenido.toLowerCase().includes('invernadero')) {
            fragmentosRelevantes.push({
                id: match.id,
                tipo: match.metadata.tipo || 'sin_tipo',
                score: match.score,
                contenido: contenido.substring(0, 200) + '...'
            });
        }
    });
    
    console.log(`📊 [TEST] Fragmentos relevantes encontrados: ${fragmentosRelevantes.length}`);
    fragmentosRelevantes.forEach((frag, index) => {
        console.log(`   ${index + 1}. ${frag.id} (tipo: ${frag.tipo}, score: ${frag.score})`);
        console.log(`      "${frag.contenido}"`);
    });
    
    // 3. Probar RAG directamente
    console.log('\n🔍 [TEST] === PROBANDO RAG ===');
    
    const resultadoRAG = await recuperarConocimientoRelevante(consulta, 'test-traslado');
    
    if (resultadoRAG && resultadoRAG.length > 0) {
        console.log(`✅ [TEST] RAG devolvió ${resultadoRAG.length} caracteres`);
        console.log(`📄 [TEST] Respuesta RAG:`);
        console.log(resultadoRAG.substring(0, 800) + '...');
        
        // Verificar si contiene información específica del archivo
        const palabrasClave = ['bandeja', 'carro', 'fila', 'sector', 'pda', 'encargado', 'partida'];
        const contiene = palabrasClave.filter(palabra => resultadoRAG.toLowerCase().includes(palabra));
        
        if (contiene.length > 0) {
            console.log(`✅ [TEST] Contiene palabras clave específicas: ${contiene.join(', ')}`);
        } else {
            console.log('❌ [TEST] NO contiene palabras clave específicas del archivo');
        }
        
        // Verificar si contiene información genérica vs específica
        if (resultadoRAG.toLowerCase().includes('sección:') || 
            resultadoRAG.toLowerCase().includes('descripción general:') ||
            resultadoRAG.toLowerCase().includes('ventas - otros - partidas')) {
            console.log('✅ [TEST] Contiene información específica del archivo');
        } else {
            console.log('❌ [TEST] Contiene información genérica/alucinada');
        }
        
    } else {
        console.log('❌ [TEST] RAG devolvió respuesta vacía');
    }
}

// Ejecutar test
testTrasladoInvernadero().then(() => {
    console.log('\n✅ [TEST] Debug completado');
}).catch(error => {
    console.error('❌ [TEST] Error en el debug:', error);
}); 