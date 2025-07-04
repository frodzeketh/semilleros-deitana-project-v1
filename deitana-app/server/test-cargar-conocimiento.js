// =====================================
// TEST: CARGAR CONOCIMIENTO REAL EN PINECONE
// =====================================

const { cargarConocimientoDesdeArchivo, procesarYAlmacenarConocimiento } = require('./admin/core/ragInteligente');
const fs = require('fs');
const path = require('path');

async function cargarConocimientoReal() {
    console.log('📚 [TEST] Cargando conocimiento real del archivo informacionEmpresa.txt...');
    
    const archivoPath = path.join(__dirname, 'admin', 'data', 'informacionEmpresa.txt');
    console.log(`📁 [TEST] Ruta del archivo: ${archivoPath}`);
    
    if (!fs.existsSync(archivoPath)) {
        console.log('❌ [TEST] El archivo NO existe');
        return;
    }
    
    try {
        // Cargar el contenido real del archivo
        const contenido = fs.readFileSync(archivoPath, 'utf8');
        console.log(`📊 [TEST] Tamaño del archivo: ${contenido.length} caracteres`);
        
        // Verificar que contiene información de tarifas
        if (contenido.toLowerCase().includes('tarifa')) {
            console.log('✅ [TEST] El archivo contiene información de tarifas');
        } else {
            console.log('❌ [TEST] El archivo NO contiene información de tarifas');
            return;
        }
        
        // Procesar y almacenar el conocimiento real
        console.log('🔄 [TEST] Procesando y almacenando conocimiento real...');
        
        const resultado = await procesarYAlmacenarConocimiento(contenido, {
            fuente: 'informacionEmpresa.txt',
            tipo: 'conocimiento_empresa',
            categoria: 'empresa_completa',
            timestamp: new Date().toISOString()
        });
        
        console.log(`✅ [TEST] Conocimiento cargado exitosamente:`);
        console.log(`   - Total chunks: ${resultado.totalChunks}`);
        console.log(`   - Exitosos: ${resultado.exitosos}`);
        console.log(`   - Fallidos: ${resultado.fallidos}`);
        
        // Verificar que se cargó correctamente
        console.log('\n🔍 [TEST] Verificando que el conocimiento se cargó correctamente...');
        
        const { recuperarConocimientoRelevante } = require('./admin/core/ragInteligente');
        const consulta = '¿Cuál es la sección de tarifas?';
        
        const resultadoRAG = await recuperarConocimientoRelevante(consulta, 'test-carga');
        
        if (resultadoRAG && resultadoRAG.length > 0) {
            console.log(`✅ [TEST] RAG devolvió ${resultadoRAG.length} caracteres`);
            console.log(`📄 [TEST] Respuesta RAG:`);
            console.log(resultadoRAG.substring(0, 500) + '...');
            
            // Verificar si ahora contiene información real de tarifas
            if (resultadoRAG.toLowerCase().includes('sección: tarifas') || 
                resultadoRAG.toLowerCase().includes('tarifas de plantas') ||
                resultadoRAG.toLowerCase().includes('denominación') ||
                resultadoRAG.toLowerCase().includes('identificador único')) {
                console.log('✅ [TEST] ¡ÉXITO! La respuesta ahora contiene información real de tarifas');
            } else {
                console.log('❌ [TEST] La respuesta aún NO contiene información real de tarifas');
            }
        } else {
            console.log('❌ [TEST] RAG devolvió respuesta vacía');
        }
        
    } catch (error) {
        console.error('❌ [TEST] Error cargando conocimiento:', error);
    }
}

// Ejecutar carga
cargarConocimientoReal().then(() => {
    console.log('\n✅ [TEST] Proceso de carga completado');
}).catch(error => {
    console.error('❌ [TEST] Error en el proceso:', error);
}); 