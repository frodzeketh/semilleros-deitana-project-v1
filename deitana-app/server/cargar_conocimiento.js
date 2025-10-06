#!/usr/bin/env node

const PineconeLoader = require('./admin/rag/cargar_pinecone');
require('dotenv').config();

async function main() {
    console.log('🚀 DEITANA IA - CARGADOR DE BASE DE CONOCIMIENTO');
    console.log('================================================');
    
    const loader = new PineconeLoader();
    
    try {
        console.log('📋 Iniciando proceso de carga...');
        await loader.loadRAGFile();
        
        console.log('\n🎉 ¡PROCESO COMPLETADO EXITOSAMENTE!');
        console.log('🤖 Tu asistente IA ahora tiene acceso a toda la información de Deitana');
        console.log('💡 Puedes hacer preguntas específicas sobre procesos, tratamientos, productos, etc.');
        
    } catch (error) {
        console.error('\n💥 ERROR EN EL PROCESO:', error.message);
        process.exit(1);
    }
}

main();
