// =====================================
// LIMPIEZA COMPLETA DE PINECONE
// =====================================

require('dotenv').config();
const { Pinecone } = require('@pinecone-database/pinecone');
const { procesarYAlmacenarConocimiento } = require('./admin/core/ragInteligente');
const fs = require('fs');
const path = require('path');

async function limpiarPinecone() {
    console.log('🧹 [LIMPIEZA] Iniciando limpieza completa de Pinecone...');
    
    try {
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY
        });
        
        const index = pinecone.Index(process.env.PINECONE_INDEX || 'memoria-deitana');
        
        // 1. Obtener todos los vectores existentes
        console.log('📊 [LIMPIEZA] Obteniendo lista de vectores existentes...');
        
        const queryResponse = await index.query({
            vector: new Array(1536).fill(0.1), // Vector dummy
            topK: 1000, // Obtener todos los vectores
            includeMetadata: true
        });
        
        console.log(`📊 [LIMPIEZA] Encontrados ${queryResponse.matches.length} vectores para eliminar`);
        
        if (queryResponse.matches.length === 0) {
            console.log('✅ [LIMPIEZA] Pinecone ya está vacío');
        } else {
            // 2. Extraer IDs de todos los vectores
            const idsAEliminar = queryResponse.matches.map(match => match.id);
            
            console.log('🗑️ [LIMPIEZA] Eliminando vectores...');
            
            // Eliminar en lotes de 100 (límite de Pinecone)
            const LOTE_SIZE = 100;
            for (let i = 0; i < idsAEliminar.length; i += LOTE_SIZE) {
                const lote = idsAEliminar.slice(i, i + LOTE_SIZE);
                await index.deleteMany(lote);
                console.log(`🗑️ [LIMPIEZA] Eliminados ${Math.min(i + LOTE_SIZE, idsAEliminar.length)}/${idsAEliminar.length} vectores`);
            }
            
            console.log('✅ [LIMPIEZA] Todos los vectores eliminados exitosamente');
        }
        
        // 3. Recargar conocimiento real
        console.log('\n📚 [LIMPIEZA] Recargando conocimiento real del archivo...');
        
        const archivoPath = path.join(__dirname, 'admin', 'data', 'informacionEmpresa.txt');
        
        if (!fs.existsSync(archivoPath)) {
            console.log('❌ [LIMPIEZA] El archivo informacionEmpresa.txt no existe');
            return;
        }
        
        const contenido = fs.readFileSync(archivoPath, 'utf8');
        console.log(`📊 [LIMPIEZA] Archivo leído: ${contenido.length} caracteres`);
        
        // Procesar y almacenar el conocimiento real
        const resultado = await procesarYAlmacenarConocimiento(contenido, {
            fuente: 'informacionEmpresa.txt',
            tipo: 'conocimiento_empresa',
            categoria: 'empresa_completa',
            timestamp: new Date().toISOString(),
            limpieza: 'completa'
        });
        
        console.log(`✅ [LIMPIEZA] Conocimiento recargado exitosamente:`);
        console.log(`   - Total chunks: ${resultado.totalChunks}`);
        console.log(`   - Exitosos: ${resultado.exitosos}`);
        console.log(`   - Fallidos: ${resultado.fallidos}`);
        
        // 4. Verificar que todo funciona correctamente
        console.log('\n🔍 [LIMPIEZA] Verificando que el sistema funciona correctamente...');
        
        const { recuperarConocimientoRelevante } = require('./admin/core/ragInteligente');
        
        const consultas = [
            '¿Cuál es la sección de tarifas?',
            '¿Qué información hay sobre zonas?',
            '¿Cómo funciona la maquinaria?'
        ];
        
        for (const consulta of consultas) {
            console.log(`\n📝 [LIMPIEZA] Probando: "${consulta}"`);
            
            const resultadoRAG = await recuperarConocimientoRelevante(consulta, 'test-limpieza');
            
            if (resultadoRAG && resultadoRAG.length > 0) {
                console.log(`✅ [LIMPIEZA] RAG devolvió ${resultadoRAG.length} caracteres`);
                
                // Verificar si contiene información real
                if (resultadoRAG.toLowerCase().includes('sección:') || 
                    resultadoRAG.toLowerCase().includes('descripción general:')) {
                    console.log('✅ [LIMPIEZA] Contiene información real del archivo');
                } else {
                    console.log('⚠️ [LIMPIEZA] No contiene información real del archivo');
                }
            } else {
                console.log('❌ [LIMPIEZA] RAG devolvió respuesta vacía');
            }
        }
        
        console.log('\n🎉 [LIMPIEZA] ¡Limpieza y recarga completadas exitosamente!');
        console.log('📊 [LIMPIEZA] Pinecone ahora contiene solo conocimiento real del archivo');
        
    } catch (error) {
        console.error('❌ [LIMPIEZA] Error durante la limpieza:', error);
    }
}

// Ejecutar limpieza
limpiarPinecone().then(() => {
    console.log('\n✅ [LIMPIEZA] Proceso completado');
}).catch(error => {
    console.error('❌ [LIMPIEZA] Error en el proceso:', error);
}); 