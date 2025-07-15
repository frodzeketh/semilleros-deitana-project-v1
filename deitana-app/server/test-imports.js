// =====================================
// TEST DE IMPORTACIONES
// =====================================

console.log('🧪 [TEST] Iniciando test de importaciones...');

try {
    console.log('📦 [TEST] Importando openAI...');
    const { processQueryStream } = require('./admin/core/openAI');
    console.log('✅ [TEST] Importación exitosa');
    
    console.log('📦 [TEST] Verificando función...');
    console.log('📦 [TEST] processQueryStream es función:', typeof processQueryStream);
    
} catch (error) {
    console.error('❌ [TEST] Error en importación:', error);
    console.error('❌ [TEST] Stack trace:', error.stack);
} 