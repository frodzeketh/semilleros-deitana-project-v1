require('dotenv').config();
const pineconeUtils = require('./utils/pinecone');

async function buscarSinFiltros() {
    console.log('🔍 [BÚSQUEDA SIN FILTROS] Buscando chunks de informacionEmpresa.txt');
    
    try {
        // Modificar temporalmente el threshold en pinecone.js para mostrar TODO
        console.log('\n1️⃣ Buscando "SEMILLEROS DEITANA" (debe encontrar chunks de empresa)...');
        const resultados1 = await pineconeUtils.buscarRecuerdos('SEMILLEROS DEITANA', 20);
        
        console.log(`📊 Resultados "SEMILLEROS DEITANA": ${resultados1.length}`);
        
        const chunkEmpresa = resultados1.filter(r => 
            r.contenido.includes('SEMILLEROS DEITANA') || 
            r.contenido.includes('informacionEmpresa.txt')
        );
        console.log(`✅ De empresa: ${chunkEmpresa.length}`);
        
        if (chunkEmpresa.length > 0) {
            console.log('\n🎯 CHUNKS DE EMPRESA ENCONTRADOS:');
            chunkEmpresa.slice(0, 3).forEach((chunk, i) => {
                console.log(`${i+1}. ID: ${chunk.id}`);
                console.log(`   Score: ${chunk.score}`);
                console.log(`   ${chunk.contenido.substring(0, 100)}...`);
            });
        }
        
        console.log('\n2️⃣ Buscando "FRECUENCIA DEL PROCESO" (sección específica)...');
        const resultados2 = await pineconeUtils.buscarRecuerdos('FRECUENCIA DEL PROCESO', 20);
        console.log(`📊 Resultados "FRECUENCIA DEL PROCESO": ${resultados2.length}`);
        
        const conFrecuencia = resultados2.filter(r => r.contenido.includes('FRECUENCIA'));
        console.log(`✅ Con frecuencia: ${conFrecuencia.length}`);
        
        console.log('\n3️⃣ Buscando "informacion_empresa" (buscar por ID)...');
        const resultados3 = await pineconeUtils.buscarRecuerdos('informacion empresa seccion', 20);
        console.log(`📊 Resultados por ID: ${resultados3.length}`);
        
        const porId = resultados3.filter(r => 
            r.id && r.id.includes('informacion_empresa')
        );
        console.log(`✅ Con ID de empresa: ${porId.length}`);
        
        if (porId.length > 0) {
            console.log('\n🎯 CHUNKS POR ID ENCONTRADOS:');
            porId.slice(0, 3).forEach((chunk, i) => {
                console.log(`${i+1}. ID: ${chunk.id}`);
                console.log(`   Score: ${chunk.score}`);
                console.log(`   ${chunk.contenido.substring(0, 100)}...`);
            });
        }
        
        // Análisis final
        console.log('\n🎯 [ANÁLISIS FINAL]:');
        
        const totalEmpresa = chunkEmpresa.length + porId.length;
        
        if (totalEmpresa === 0) {
            console.log('❌ CRÍTICO: NO se encuentran chunks de informacionEmpresa.txt');
            console.log('   Los 111 chunks reportados como "guardados" NO están en Pinecone');
            console.log('   Posible problema: Namespace, errores de guardado, o API keys diferentes');
        } else {
            console.log(`✅ SÍ existen ${totalEmpresa} chunks de empresa`);
            console.log('   Problema: Scoring o priorización en la búsqueda');
        }
        
    } catch (error) {
        console.error('❌ ERROR:', error.message);
    }
}

buscarSinFiltros(); 