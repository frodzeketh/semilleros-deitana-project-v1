// =====================================
// TEST DE CONTEXTO MEJORADO - DEITANA IA
// =====================================
// 
// Este archivo prueba las mejoras implementadas en el manejo de contexto
// para preguntas de seguimiento como "a que cliente corresponde?"
// =====================================

const { detectarPreguntaSeguimiento, analizarComplejidadRapida } = require('./admin/core/openAI');

// Simular historial de conversación
const historialEjemplo = [
    {
        role: 'user',
        content: 'tenemos stock de semillas tomate ananas'
    },
    {
        role: 'assistant',
        content: '¡Hola, Rodrigo! 😊 He revisado la consulta que hiciste sobre el stock de semillas de "tomate ananas" y aquí te cuento lo que encontré.\n\nActualmente, sí tenemos stock de estas semillas. 🎉 La información que obtuvimos es la siguiente:\n\nTipo de semilla: Tomate Ananas 🍅\nLote de remesa: 492YJ353\nStock actual: 792 unidades\n\nEsto significa que, en el lote identificado como "492YJ353", contamos con 792 unidades de semillas de tomate ananas disponibles. Así que si estás pensando en plantar estos deliciosos tomates, estás de suerte, ¡tenemos suficiente para empezar! 🌱\n\nEspero que esta información te sea útil y si necesitas más detalles, aquí estoy para ayudarte. ¡Feliz jardinería! 🌻'
    }
];

// Casos de prueba
const casosPrueba = [
    {
        mensaje: 'a que cliente corresponde?',
        esperado: true,
        descripcion: 'Pregunta de seguimiento sobre cliente'
    },
    {
        mensaje: 'a que lote corresponde?',
        esperado: true,
        descripcion: 'Pregunta de seguimiento sobre lote'
    },
    {
        mensaje: 'hola',
        esperado: false,
        descripcion: 'Saludo simple'
    },
    {
        mensaje: 'gracias',
        esperado: false,
        descripcion: 'Agradecimiento'
    },
    {
        mensaje: '¿cuál es el stock actual?',
        esperado: true,
        descripcion: 'Pregunta específica que requiere contexto'
    }
];

console.log('🧪 [TEST] Iniciando pruebas de contexto mejorado...\n');

casosPrueba.forEach((caso, index) => {
    console.log(`📋 [TEST ${index + 1}] ${caso.descripcion}`);
    console.log(`   Mensaje: "${caso.mensaje}"`);
    
    // Probar detección de pregunta de seguimiento
    const esSeguimiento = detectarPreguntaSeguimiento(caso.mensaje, historialEjemplo);
    console.log(`   ¿Es pregunta de seguimiento? ${esSeguimiento} (esperado: ${caso.esperado})`);
    
    // Probar análisis de complejidad
    const complejidad = analizarComplejidadRapida(caso.mensaje);
    console.log(`   Complejidad: ${complejidad.toFixed(2)}`);
    
    // Verificar resultado
    const resultado = esSeguimiento === caso.esperado ? '✅ PASÓ' : '❌ FALLÓ';
    console.log(`   Resultado: ${resultado}\n`);
});

console.log('🏁 [TEST] Pruebas completadas.');
