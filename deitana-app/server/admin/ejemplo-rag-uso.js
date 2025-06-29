// =====================================
// EJEMPLO DE USO: SISTEMA RAG INTELIGENTE
// =====================================

const ragInteligente = require('./ragInteligente');
const path = require('path');

console.log(`
🧠 SISTEMA RAG INTELIGENTE - SEMILLEROS DEITANA
==============================================

💰 ANÁLISIS DE COSTOS COMPARATIVO:
`);

// =====================================
// ANÁLISIS DE COSTOS
// =====================================

function mostrarAnalisisCostos() {
    console.log('💰 [COSTOS] Calculando estimaciones...\n');
    
    // Escenario 1: Sistema naive (cargar todo)
    const costoNaive = {
        caracteresPorConsulta: 50000,
        tokensPorConsulta: Math.ceil(50000 / 3.5),
        costoPorToken: 0.00001,
        consultas: 100
    };
    
    const costoTotalNaive = costoNaive.tokensPorConsulta * costoNaive.costoPorToken * costoNaive.consultas;
    
    console.log('❌ ENFOQUE NAIVE (cargar todo el conocimiento):');
    console.log(`   📄 Caracteres por consulta: ${costoNaive.caracteresPorConsulta.toLocaleString()}`);
    console.log(`   🎯 Tokens por consulta: ${costoNaive.tokensPorConsulta.toLocaleString()}`);
    console.log(`   💸 Costo por consulta: $${(costoNaive.tokensPorConsulta * costoNaive.costoPorToken).toFixed(4)}`);
    console.log(`   💸 Costo 100 consultas: $${costoTotalNaive.toFixed(2)}`);
    console.log(`   💸 Costo mensual (3000 consultas): $${(costoTotalNaive * 30).toFixed(2)}`);
    console.log(`   🚨 RESULTADO: INSOSTENIBLE\n`);
    
    // Escenario 2: Sistema RAG inteligente
    const costosRAG = ragInteligente.calcularCostoEstimado(100);
    
    console.log('✅ ENFOQUE RAG INTELIGENTE (retrieval selectivo):');
    console.log(`   🔍 Embedding por consulta: $${costosRAG.porConsulta.embedding.toFixed(6)}`);
    console.log(`   📄 Contexto promedio: $${costosRAG.porConsulta.contexto.toFixed(6)}`);
    console.log(`   💸 Costo por consulta: $${costosRAG.porConsulta.total.toFixed(6)}`);
    console.log(`   💸 Costo 100 consultas: $${costosRAG.diario.total.toFixed(4)}`);
    console.log(`   💸 Costo mensual: $${costosRAG.mensual.toFixed(2)}`);
    console.log(`   🎯 RESULTADO: SOSTENIBLE\n`);
    
    // Comparación
    const ahorro = ((costoTotalNaive - costosRAG.diario.total) / costoTotalNaive * 100);
    console.log(`🏆 AHORRO RAG vs NAIVE: ${ahorro.toFixed(1)}%`);
    console.log(`💰 AHORRO MENSUAL: $${((costoTotalNaive * 30) - costosRAG.mensual).toFixed(2)}\n`);
}

// =====================================
// EJEMPLO DE USO PRÁCTICO
// =====================================

async function ejemploUso() {
    console.log('🧪 EJEMPLO DE USO PRÁCTICO:\n');
    
    // Simular consultas típicas
    const consultasEjemplo = [
        "¿Qué es Semilleros Deitana?",
        "¿Cuáles son los procesos de injerto de tomate?", 
        "¿Qué certificaciones tiene la empresa?",
        "¿Cómo se cultiva lechuga en invernadero?",
        "¿Cuál es la historia de la empresa?"
    ];
    
    console.log('📋 CONSULTAS DE EJEMPLO:');
    consultasEjemplo.forEach((consulta, i) => {
        console.log(`${i + 1}. "${consulta}"`);
    });
    
    console.log('\n🔍 PROCESO RAG PARA CADA CONSULTA:');
    console.log('   1. 🧠 Generar embedding de la consulta (~$0.00002)');
    console.log('   2. 🔍 Buscar fragmentos similares en Pinecone');
    console.log('   3. 🎯 Filtrar top 3 fragmentos más relevantes');
    console.log('   4. 📝 Construir contexto optimizado (~1000 tokens)');
    console.log('   5. ✅ Agregar al prompt del asistente\n');
    
    console.log('💡 BENEFICIOS:');
    console.log('   ✅ Solo información relevante para cada consulta');
    console.log('   ✅ Contexto específico y actualizado');
    console.log('   ✅ Costos predecibles y sostenibles');
    console.log('   ✅ Escalable hasta millones de documentos');
    console.log('   ✅ Actualizaciones incrementales fáciles\n');
}

// =====================================
// GUÍA DE IMPLEMENTACIÓN
// =====================================

function mostrarGuiaImplementacion() {
    console.log('🚀 GUÍA DE IMPLEMENTACIÓN:\n');
    
    console.log('📝 PASO 1: Preparar tu archivo de conocimiento');
    console.log('   • Crear archivo .txt con información de la empresa');
    console.log('   • Usar títulos y secciones claras (### Título ###)');
    console.log('   • Incluir procesos, cultivos, historia, certificaciones');
    console.log('   • Ejemplo: server/admin/conocimiento-empresa.txt\n');
    
    console.log('⚡ PASO 2: Cargar conocimiento inicial');
    console.log('   const rag = require("./ragInteligente");');
    console.log('   await rag.cargarConocimientoDesdeArchivo("conocimiento-empresa.txt");\n');
    
    console.log('🔄 PASO 3: Usar en consultas (ya integrado)');
    console.log('   • El sistema detecta automáticamente cuándo usar RAG');
    console.log('   • Se activa para consultas sobre empresa, procesos, cultivos');
    console.log('   • Agrega contexto relevante al prompt del asistente\n');
    
    console.log('➕ PASO 4: Actualizaciones incrementales');
    console.log('   await rag.añadirConocimientoNuevo(nuevoContenido, {');
    console.log('     categoria: "procesos",');
    console.log('     version: "2.0"');
    console.log('   });\n');
}

// =====================================
// EJEMPLO DE ARCHIVO DE CONOCIMIENTO
// =====================================

function crearEjemploArchivo() {
    const ejemploContenido = `
### SEMILLEROS DEITANA - INFORMACIÓN GENERAL ###

==================================================
HISTORIA Y FUNDACIÓN
==================================================

Semilleros Deitana, S.L. es una empresa española con sede en Totana, Murcia, fundada en 1989.
Los propietarios son los hermanos Galera Carmona: Antonio Francisco Galera Carmona y José Luis Galera Carmona.
Con más de 25 años de experiencia en el sector agrícola.

==================================================
ESPECIALIDADES Y PRODUCTOS
==================================================

### INJERTOS ESPECIALIZADOS ###
- Injertos de tomate
- Injertos de sandía  
- Injertos de pepino
- Injertos de melón

### OTROS CULTIVOS ###
- Puerro
- Brócoli
- Lechuga
- Cebolla
- Apio
- Plantas aromáticas

==================================================
PROCESOS DE INJERTO DE TOMATE
==================================================

1. **Preparación de Plantas Madre**
   - Selección de variedades resistentes
   - Siembra en bandejas específicas
   - Control de temperatura y humedad

2. **Proceso de Injerto**
   - Corte preciso en bisel
   - Unión de porta-injerto y variedad
   - Fijación con clips especializados

3. **Cámara de Cicatrización**
   - Temperatura: 24-26°C
   - Humedad: 85-90%
   - Período: 7-10 días

==================================================
CERTIFICACIONES Y CALIDAD
==================================================

### ISO 9001 ###
Certificación de calidad que avala nuestros procesos y compromiso con la excelencia.

### PRÁCTICAS SOSTENIBLES ###
- Agricultura responsable
- Optimización de recursos hídricos
- Reducción de impacto ambiental
- Investigación en resistencia natural

==================================================
UBICACIÓN Y CONTACTO
==================================================

**Dirección:** Carretera de Mazarrón km 2, Totana, Murcia 30850, España
**Región:** Murcia - zona ideal para agricultura mediterránea
**Empleados:** Entre 51 y 200 empleados según temporada
`;

    console.log('📝 EJEMPLO DE ARCHIVO DE CONOCIMIENTO:\n');
    console.log('```');
    console.log(ejemploContenido.trim());
    console.log('```\n');
    
    console.log('💡 CARACTERÍSTICAS DEL FORMATO:');
    console.log('   ✅ Títulos claros con ### o ===');
    console.log('   ✅ Secciones bien definidas');
    console.log('   ✅ Información específica y práctica');
    console.log('   ✅ Estructura jerárquica');
    console.log('   ✅ Contenido relevante para consultas');
}

// =====================================
// EJECUCIÓN DEL EJEMPLO
// =====================================

async function main() {
    try {
        mostrarAnalisisCostos();
        await ejemploUso();
        mostrarGuiaImplementacion();
        crearEjemploArchivo();
        
        console.log('🎯 PRÓXIMOS PASOS RECOMENDADOS:');
        console.log('   1. 📝 Crear archivo de conocimiento con información de Semilleros Deitana');
        console.log('   2. ⚡ Ejecutar carga inicial: node cargar-conocimiento.js');
        console.log('   3. 🧪 Probar consultas sobre la empresa');
        console.log('   4. 📊 Monitorear costos y efectividad');
        console.log('   5. ➕ Añadir más conocimiento gradualmente\n');
        
        console.log('💰 RESUMEN DE BENEFICIOS:');
        console.log('   🏆 98%+ reducción en costos vs enfoque naive');
        console.log('   ⚡ Respuestas más precisas y contextuales');
        console.log('   🔄 Escalabilidad ilimitada');
        console.log('   📈 Mejora continua del conocimiento');
        
    } catch (error) {
        console.error('❌ Error en ejemplo:', error.message);
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    main();
}

module.exports = { main, mostrarAnalisisCostos, ejemploUso }; 