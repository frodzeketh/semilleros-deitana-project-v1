console.time('Total');
console.log('🚀 Iniciando test de velocidad...');

const { processQuery } = require('./admin/core/openAI');

async function test() {
    try {
        console.time('processQuery');
        const result = await processQuery({
            message: 'dime algo de ti',
            userId: 'test-' + Date.now()
        });
        console.timeEnd('processQuery');
        
        console.log('✅ ÉXITO:', result.success);
        if (result.data?.message) {
            console.log('📝 Respuesta:', result.data.message.substring(0, 100) + '...');
        }
    } catch (error) {
        console.error('❌ ERROR:', error.message);
    }
}

test().then(() => {
    console.timeEnd('Total');
    process.exit(0);
}); 