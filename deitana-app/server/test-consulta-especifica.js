const { recuperarConocimientoRelevante } = require('./admin/core/ragInteligente');

async function testConsultaEspecifica() {
    console.log('🧪 === TEST CONSULTA ESPECÍFICA - DOSIS MERPAN ===\n');
    
    const consulta = '¿Cuál es la dosis exacta de MERPAN 80 WDG para bandejas de 54 alveolos?';
    
    console.log(`🔍 Consulta: "${consulta}"`);
    
    try {
        const resultado = await recuperarConocimientoRelevante(consulta);
        
        console.log('\n📋 RESULTADO COMPLETO:');
        console.log(resultado);
        
        // Verificar si contiene la dosis específica
        const contiene083 = resultado.includes('0,83 KG / CUBA 140L');
        const contiene166 = resultado.includes('1,66 KG / 140L');
        const contieneMerpan = resultado.toLowerCase().includes('merpan');
        const contieneDosis = /(\d+[,\.]\d+)\s*(kg|ml)/i.test(resultado);
        
        console.log('\n📊 VERIFICACIÓN:');
        console.log(`- Contiene MERPAN: ${contieneMerpan}`);
        console.log(`- Contiene dosis específica: ${contieneDosis}`);
        console.log(`- Contiene 0,83 KG / CUBA 140L: ${contiene083}`);
        console.log(`- Contiene 1,66 KG / 140L: ${contiene166}`);
        
        if (contiene083 || contiene166) {
            console.log('✅ ÉXITO: El sistema encontró y citó la dosis específica');
        } else if (contieneDosis) {
            console.log('⚠️ PARCIAL: Encontró dosis pero no la citó textualmente');
        } else {
            console.log('❌ FALLO: No encontró dosis específica');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testConsultaEspecifica().catch(console.error); 