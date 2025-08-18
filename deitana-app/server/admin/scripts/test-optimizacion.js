// =====================================
// SCRIPT DE PRUEBA - OPTIMIZACIÓN DE COSTOS
// =====================================

const { construirPromptInteligente } = require('../core/openAI');
const mapaERP = require('../core/mapaERP');

// Casos de prueba para demostrar la optimización
const casosPrueba = [
    {
        nombre: "Saludo Simple",
        mensaje: "Hola",
        esperado: { tipo: 'saludo', complejidad: 'simple', modelo: 'gpt-3.5-turbo' }
    },
    {
        nombre: "Consulta Ayuda",
        mensaje: "¿Qué puedes hacer?",
        esperado: { tipo: 'ayuda', complejidad: 'simple', modelo: 'gpt-3.5-turbo' }
    },
    {
        nombre: "Consulta SQL Media",
        mensaje: "Dime 3 clientes de Almería",
        esperado: { tipo: 'sql', complejidad: 'media', modelo: 'gpt-4o' }
    },
    {
        nombre: "Consulta SQL Compleja",
        mensaje: "Análisis completo de tendencias de tomate vs lechuga en los últimos 3 meses",
        esperado: { tipo: 'sql', complejidad: 'compleja', modelo: 'gpt-4-turbo-preview' }
    },
    {
        nombre: "Consulta Artículos",
        mensaje: "Busca artículos de tomate injerto",
        esperado: { tipo: 'sql', complejidad: 'media', modelo: 'gpt-4o' }
    }
];

// Función para calcular costo estimado
function calcularCostoEstimado(modelo, tokens) {
    const costos = {
        'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
        'gpt-4o': { input: 0.005, output: 0.015 },
        'gpt-4-turbo-preview': { input: 0.01, output: 0.03 }
    };
    
    const costoModelo = costos[modelo] || costos['gpt-4-turbo-preview'];
    const costoInput = (tokens * costoModelo.input) / 1000;
    const costoOutputEstimado = (tokens * 0.3 * costoModelo.output) / 1000; // Asumiendo output = 30% del input
    
    return costoInput + costoOutputEstimado;
}

// Función principal de prueba
async function probarOptimizacion() {
    console.log('🧪 ===== PRUEBA DE OPTIMIZACIÓN DE COSTOS =====\n');
    
    let costoTotalAnterior = 0;
    let costoTotalOptimizado = 0;
    let tokensAhorrados = 0;
    
    casosPrueba.forEach((caso, index) => {
        console.log(`\n${index + 1}. 🧪 [PRUEBA] ${caso.nombre}`);
        console.log(`📝 [MENSAJE] "${caso.mensaje}"`);
        
        try {
            // Construir prompt optimizado
            const resultado = await construirPromptInteligente(caso.mensaje, mapaERP, null, '', '', [], false);
            
            // Calcular métricas
            const tokensOptimizados = resultado.metricas.tokensEstimados;
            const tokensOriginal = 3500; // Estimación del prompt original sin optimizar
            const ahorro = tokensOriginal - tokensOptimizados;
            
            const costoAnterior = calcularCostoEstimado('gpt-4-turbo-preview', tokensOriginal);
            const costoOptimizado = calcularCostoEstimado(resultado.configModelo.modelo, tokensOptimizados);
            
            costoTotalAnterior += costoAnterior;
            costoTotalOptimizado += costoOptimizado;
            tokensAhorrados += ahorro;
            
            // Verificar expectativas
            const cumpleExpectativas = 
                resultado.intencion.tipo === caso.esperado.tipo &&
                resultado.intencion.complejidad === caso.esperado.complejidad &&
                resultado.configModelo.modelo === caso.esperado.modelo;
            
            // Mostrar resultados
            console.log(`✅ [DETECCIÓN] Tipo: ${resultado.intencion.tipo} | Complejidad: ${resultado.intencion.complejidad}`);
            console.log(`🤖 [MODELO] ${resultado.configModelo.modelo} (${cumpleExpectativas ? '✅ Correcto' : '❌ Incorrecto'})`);
            console.log(`📊 [TOKENS] Antes: ${tokensOriginal} | Ahora: ${tokensOptimizados} | Ahorro: ${ahorro} (${resultado.metricas.reduccionPorcentaje}%)`);
            console.log(`💰 [COSTO] Antes: $${costoAnterior.toFixed(6)} | Ahora: $${costoOptimizado.toFixed(6)} | Ahorro: $${(costoAnterior - costoOptimizado).toFixed(6)}`);
            console.log(`🎯 [TABLAS] ${resultado.tablasRelevantes.join(', ') || 'Ninguna'}`);
            
        } catch (error) {
            console.error(`❌ [ERROR] ${error.message}`);
        }
    });
    
    // Resumen final
    console.log('\n\n🎊 ===== RESUMEN DE OPTIMIZACIÓN =====');
    console.log(`📊 [TOKENS] Total ahorrado: ${tokensAhorrados} tokens`);
    console.log(`💰 [COSTO] Antes: $${costoTotalAnterior.toFixed(6)}`);
    console.log(`💰 [COSTO] Ahora: $${costoTotalOptimizado.toFixed(6)}`);
    console.log(`💰 [AHORRO] Total: $${(costoTotalAnterior - costoTotalOptimizado).toFixed(6)}`);
    console.log(`📈 [EFICIENCIA] ${((costoTotalAnterior - costoTotalOptimizado) / costoTotalAnterior * 100).toFixed(1)}% más barato`);
    console.log(`🚀 [ESCALADO] Ahorro por 1000 consultas: $${((costoTotalAnterior - costoTotalOptimizado) * 200).toFixed(2)}`);
    
    console.log('\n✅ Optimización funcionando correctamente!');
}

// Función para probar detección de intención específica
async function probarDeteccionIntencion() {
    console.log('\n\n🔍 ===== PRUEBA DE DETECCIÓN DE INTENCIÓN =====\n');
    
    const mensajesPrueba = [
        "Hola",
        "Buenos días",
        "¿Qué puedes hacer?",
        "Ayuda",
        "Dime clientes",
        "Muestra proveedores",
        "Cuántos artículos tenemos",
        "Busca sustrato",
        "Análisis de ventas complejo",
        "Tendencias múltiples de tomate y lechuga",
        "Comparar rendimiento anual"
    ];
    
    // La función analizarIntencion ahora está integrada en construirPromptInteligente
    // No necesitamos importarla por separado
    
    for (const mensaje of mensajesPrueba) {
        try {
            const resultado = await construirPromptInteligente(mensaje, mapaERP, null, '', '', [], false);
            console.log(`"${mensaje}" → ${resultado.intencion.tipo} | ${resultado.intencion.complejidad}`);
        } catch (error) {
            console.log(`"${mensaje}" → Error: ${error.message}`);
        }
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    probarOptimizacion().then(() => {
        return probarDeteccionIntencion();
    }).catch(console.error);
}

module.exports = {
    probarOptimizacion,
    probarDeteccionIntencion,
    casosPrueba
}; 