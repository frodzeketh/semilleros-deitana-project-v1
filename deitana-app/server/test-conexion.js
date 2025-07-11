console.log('🧪 [TEST CONEXIÓN] Verificando configuración...');

// Test 1: Variables de entorno
const pineconeApiKey = process.env.PINECONE_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

console.log('📋 [ENV] Pinecone API Key:', pineconeApiKey ? '✅ Configurada' : '❌ Falta');
console.log('📋 [ENV] OpenAI API Key:', openaiApiKey ? '✅ Configurada' : '❌ Falta');

// Test 2: Imports básicos
try {
    console.log('\n📦 [IMPORTS] Verificando imports...');
    
    const { Pinecone } = require('@pinecone-database/pinecone');
    console.log('✅ Pinecone importado');
    
    const OpenAI = require('openai');
    console.log('✅ OpenAI importado');
    
    console.log('\n🎯 [DIAGNÓSTICO]:');
    
    if (!pineconeApiKey || !openaiApiKey) {
        console.log('❌ PROBLEMA: Faltan variables de entorno');
        console.log('   Solución: Verificar archivo .env');
    } else {
        console.log('✅ Configuración básica correcta');
        console.log('   El problema puede ser de conectividad o en el código');
    }
    
    // Test 3: Crear instancia básica (sin conexión)
    console.log('\n🔧 [INSTANCIAS] Creando instancias...');
    
    if (pineconeApiKey) {
        const pinecone = new Pinecone({ apiKey: pineconeApiKey });
        console.log('✅ Instancia Pinecone creada');
    }
    
    if (openaiApiKey) {
        const openai = new OpenAI({ apiKey: openaiApiKey });
        console.log('✅ Instancia OpenAI creada');
    }
    
    console.log('\n✅ [RESULTADO] Test de configuración completado');
    
} catch (error) {
    console.error('❌ [ERROR]:', error.message);
} 