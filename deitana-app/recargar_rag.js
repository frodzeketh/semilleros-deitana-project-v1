#!/usr/bin/env node

console.log('🚀 Recargando base de conocimiento RAG...');

const { exec } = require('child_process');

exec('cd server && node cargar_conocimiento.js', (error, stdout, stderr) => {
    if (error) {
        console.error('❌ Error:', error);
        return;
    }
    
    console.log('📊 Salida:', stdout);
    if (stderr) {
        console.error('⚠️ Advertencias:', stderr);
    }
    
    console.log('✅ ¡Recarga completada!');
});
