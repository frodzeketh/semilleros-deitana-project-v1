console.log('🧪 [TEST ENV] Verificando carga de variables de entorno...');

// Cargar dotenv explícitamente
require('dotenv').config();

console.log('\n📋 [VARIABLES] Estado después de cargar .env:');
console.log('PINECONE_API_KEY:', process.env.PINECONE_API_KEY ? '✅ Configurada' : '❌ No encontrada');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Configurada' : '❌ No encontrada');
console.log('PINECONE_INDEX_NAME:', process.env.PINECONE_INDEX_NAME || '❌ No encontrada');

console.log('\n🔍 [DEBUG] Listando todas las variables que empiezan con PINECONE o OPENAI:');
Object.keys(process.env)
    .filter(key => key.startsWith('PINECONE') || key.startsWith('OPENAI'))
    .forEach(key => {
        const value = process.env[key];
        console.log(`${key}: ${value ? `${value.substring(0, 10)}...` : 'undefined'}`);
    });

console.log('\n🎯 [DIAGNÓSTICO]:');
if (!process.env.PINECONE_API_KEY || !process.env.OPENAI_API_KEY) {
    console.log('❌ PROBLEMA: Variables de entorno no están configuradas');
    console.log('📝 SOLUCIÓN:');
    console.log('1. Verificar que existe .env en el directorio server/');
    console.log('2. Añadir las siguientes líneas al .env:');
    console.log('   PINECONE_API_KEY=tu_api_key_aqui');
    console.log('   OPENAI_API_KEY=tu_api_key_aqui');
    console.log('   PINECONE_INDEX_NAME=tu_indice_aqui');
} else {
    console.log('✅ Variables configuradas correctamente');
} 