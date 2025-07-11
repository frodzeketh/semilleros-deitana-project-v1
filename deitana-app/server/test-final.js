const openAI = require('./admin/core/openAI');

async function probarPreguntasCorregidas() {
    console.log('🔧 Probando las tres preguntas corregidas...\n');
    
    const preguntas = [
        '¿Qué producto y en qué cantidad se utiliza para desinfectar bandejas de 260 y 322 alvéolos en una cuba de 140 litros?',
        '¿Qué tipo de producto está explícitamente prohibido cuando se desinfectan bandejas de 54, 104, 150 y 198 alvéolos con MERPAN 80 WDG?',
        '¿Cuál es la frecuencia indicada para realizar el proceso de desinfección de bandejas, según el documento?'
    ];
    
    for (let i = 0; i < preguntas.length; i++) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`🔍 PREGUNTA ${i + 1}:`);
        console.log(preguntas[i]);
        console.log(`${'='.repeat(80)}`);
        
        try {
            const respuesta = await openAI.processQuery({ message: preguntas[i], userId: 'test-admin' });
            console.log('\n📝 RESPUESTA:');
            console.log(respuesta);
            
            // Verificaciones específicas
            const contieneZZCuprocol = respuesta.toLowerCase().includes('zz-cuprocol');
            const contiene469ml = respuesta.toLowerCase().includes('469');
            const contieneSinCobre = respuesta.toLowerCase().includes('sin cobre');
            const contieneCadaVez = respuesta.toLowerCase().includes('cada vez que se termine');
            const contieneOxiPremium = respuesta.toLowerCase().includes('oxi premium');
            const contieneCloro = respuesta.toLowerCase().includes('cloro');
            
            console.log('\n✅ VERIFICACIONES:');
            if (i === 0) {
                console.log(`- Menciona ZZ-CUPROCOL: ${contieneZZCuprocol ? '✅' : '❌'}`);
                console.log(`- Menciona 469ml: ${contiene469ml ? '✅' : '❌'}`);
                console.log(`- NO menciona Oxi Premium (incorrecto): ${!contieneOxiPremium ? '✅' : '❌'}`);
            } else if (i === 1) {
                console.log(`- Menciona SIN COBRE: ${contieneSinCobre ? '✅' : '❌'}`);
                console.log(`- NO menciona cloro (incorrecto): ${!contieneCloro ? '✅' : '❌'}`);
            } else if (i === 2) {
                console.log(`- Menciona "cada vez que se termine": ${contieneCadaVez ? '✅' : '❌'}`);
            }
            
        } catch (error) {
            console.error('❌ Error:', error.message);
        }
    }
}

probarPreguntasCorregidas(); 