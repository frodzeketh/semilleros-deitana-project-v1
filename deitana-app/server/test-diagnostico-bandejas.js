// =====================================
// TEST DIAGNÓSTICO - BANDEJAS Y AGUA
// =====================================

require('dotenv').config();
const { recuperarConocimientoRelevante } = require('./admin/core/ragInteligente');
const fs = require('fs');
const path = require('path');

async function testDiagnosticoBandejas() {
    console.log('🔍 === TEST DIAGNÓSTICO: BANDEJAS Y AGUA ===\n');
    
    // 1. Verificar que la información existe en el archivo
    console.log('📄 [DIAGNÓSTICO] Verificando contenido del archivo...');
    
    const archivoPath = path.join(__dirname, 'admin', 'data', 'informacionEmpresa.txt');
    const contenido = fs.readFileSync(archivoPath, 'utf8');
    
    // Buscar la información específica
    const busqueda9000 = contenido.includes('9000 bandejas');
    const busquedaWhatsapp = contenido.includes('Whatsapp');
    const busquedaAgua = contenido.includes('cambio de agua');
    
    console.log(`✅ [DIAGNÓSTICO] Información en archivo:`);
    console.log(`   - "9000 bandejas": ${busqueda9000 ? 'SÍ' : 'NO'}`);
    console.log(`   - "Whatsapp": ${busquedaWhatsapp ? 'SÍ' : 'NO'}`);
    console.log(`   - "cambio de agua": ${busquedaAgua ? 'SÍ' : 'NO'}`);
    
    if (busqueda9000) {
        // Encontrar el contexto exacto
        const indice = contenido.indexOf('9000 bandejas');
        const contexto = contenido.substring(Math.max(0, indice - 100), indice + 200);
        console.log(`\n📋 [DIAGNÓSTICO] Contexto encontrado:`);
        console.log(`"${contexto}"`);
    }
    
    // 2. Probar diferentes consultas
    const consultas = [
        '¿Cada cuántas bandejas se cambia el agua?',
        'frecuencia cambio agua bandejas',
        '9000 bandejas agua',
        'cambio agua whatsapp',
        'bandejas lavadas agua'
    ];
    
    console.log('\n🔍 [DIAGNÓSTICO] Probando consultas RAG...');
    
    for (const consulta of consultas) {
        console.log(`\n📝 [DIAGNÓSTICO] Consulta: "${consulta}"`);
        
        try {
            const resultado = await recuperarConocimientoRelevante(consulta, 'test-diagnostico');
            
            if (resultado && resultado.length > 0) {
                console.log(`✅ [DIAGNÓSTICO] RAG devolvió ${resultado.length} caracteres`);
                
                // Verificar si contiene la información específica
                const contiene9000 = resultado.includes('9000');
                const contieneBandejas = resultado.toLowerCase().includes('bandeja');
                const contieneAgua = resultado.toLowerCase().includes('agua');
                const contieneWhatsapp = resultado.toLowerCase().includes('whatsapp');
                
                console.log(`   - Contiene "9000": ${contiene9000 ? 'SÍ' : 'NO'}`);
                console.log(`   - Contiene "bandeja": ${contieneBandejas ? 'SÍ' : 'NO'}`);
                console.log(`   - Contiene "agua": ${contieneAgua ? 'SÍ' : 'NO'}`);
                console.log(`   - Contiene "whatsapp": ${contieneWhatsapp ? 'SÍ' : 'NO'}`);
                
                if (contiene9000) {
                    console.log(`✅ [DIAGNÓSTICO] ¡ÉXITO! Encontró la información específica`);
                } else {
                    console.log(`❌ [DIAGNÓSTICO] NO encontró la información específica`);
                    console.log(`📄 [DIAGNÓSTICO] Respuesta RAG:`);
                    console.log(resultado.substring(0, 300) + '...');
                }
            } else {
                console.log('❌ [DIAGNÓSTICO] RAG devolvió respuesta vacía');
            }
            
        } catch (error) {
            console.error(`❌ [DIAGNÓSTICO] Error en consulta:`, error.message);
        }
    }
    
    // 3. Verificar chunks específicos
    console.log('\n🔍 [DIAGNÓSTICO] Verificando chunks específicos...');
    
    const { crearChunksInteligentes } = require('./admin/core/ragInteligente');
    
    // Buscar la sección específica en el contenido
    const secciones = contenido.split(/(?=SECCIÓN: )/g);
    let seccionRelevante = '';
    
    for (const seccion of secciones) {
        if (seccion.includes('9000 bandejas') || seccion.includes('cambio de agua')) {
            seccionRelevante = seccion;
            break;
        }
    }
    
    if (seccionRelevante) {
        console.log(`✅ [DIAGNÓSTICO] Encontrada sección relevante (${seccionRelevante.length} caracteres)`);
        
        // Crear chunks de esta sección
        const chunks = crearChunksInteligentes(seccionRelevante, {
            fuente: 'test-diagnostico',
            tipo: 'seccion_bandejas'
        });
        
        console.log(`📊 [DIAGNÓSTICO] Creados ${chunks.length} chunks de la sección relevante`);
        
        chunks.forEach((chunk, index) => {
            const contiene9000 = chunk.contenido.includes('9000');
            const contieneBandejas = chunk.contenido.toLowerCase().includes('bandeja');
            
            console.log(`   Chunk ${index + 1}: ${contiene9000 ? '✅' : '❌'} 9000, ${contieneBandejas ? '✅' : '❌'} bandeja`);
        });
    } else {
        console.log('❌ [DIAGNÓSTICO] NO se encontró sección relevante');
    }
    
    console.log('\n🎯 [DIAGNÓSTICO] === RESUMEN DEL DIAGNÓSTICO ===');
    console.log('1. ✅ Información existe en el archivo');
    console.log('2. ❓ RAG no la está recuperando correctamente');
    console.log('3. 🔍 Posibles causas: chunking, búsqueda vectorial, o prompt');
}

// Ejecutar diagnóstico
testDiagnosticoBandejas().then(() => {
    console.log('\n✅ [DIAGNÓSTICO] Test de diagnóstico completado');
}).catch(error => {
    console.error('❌ [DIAGNÓSTICO] Error en el diagnóstico:', error);
}); 