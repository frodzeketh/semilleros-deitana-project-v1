// =====================================
// TEST: PROCESAMIENTO DE VIÑETAS
// =====================================

const ragInteligente = require('./admin/core/ragInteligente');

// Contenido de prueba con viñetas
const contenidoConViñetas = `
SECCIÓN: TAREAS Y PROCESOS
DESCRIPCIÓN GENERAL: Las tareas y procesos de Semilleros Deitana incluyen una amplia gama de actividades relacionadas con la producción de plantas hortícolas.

TAREAS PRINCIPALES:
• H. CARRETILLERO INJERTOS (259)
• MOVER BANDEJAS INJERTOS (260)
• SACUDIR BANDEJAS INJERTOS (261)
• Z-CARGAR PARA INJERTAR (65)
• Z-DEVOLVER PLANTA SOBRANTE (66)
• Z-ENTERRAR (63)
• Z-ENTERRAR PUA (300)
• Z-HORAS FORMACION INJERTOS (276)
• Z-INJERTAR PEPINO (237)
• Z-INJERTAR SANDIA (62)
• Z-INJERTAR SANDIA PUA (299)
• Z-INJERTAR TOMATE(104) (179)
• Z-LIMPIAR ALMACEN DE INJERTOS (183)
• Z-MOVER INJERTOS EN CAMARA (67)
• Z-PREP.BAND.PARA INJERTOS (185)
• Z-REPICAR EN ALMACEN INJ. (64)

TAREAS DE SIEMBRA:
- CAMBIAR FUNDAS (221)
- CAMBIAR MAQUINA (91)
- H.SIEMBRA (8)
- LIMPIAR MAQUINA (94)
- PONER ETIQUETAS (37)
- SEMBRAR EN 104 ALV (48)
- SEMBRAR EN 150 ALV (49)
- SEMBRAR EN 198 ALV (50)
- SEMBRAR EN 260 ALV (51)
- SEMBRAR EN 322 ALV (52)
- SEMBRAR EN 54 ALV (47)
- SEMBRAR EN 589 ALV (280)
- SEMBRAR EN 874 ALV (53)

TAREAS DE RIEGO:
* APRENDIZAJE RIEGOS (282)
* GUARDIA DE RIEGO (226)
* H.ENCARGADO RIEGO (239)
* H.RIEGO (18)
* SUPERVISION TECNICOS (ALP)

TARIFAS DE PRECIOS:
1. Tarifa A: Clientes grandes con volúmenes muy altos de plantas al año
2. Tarifa B: Clientes medianos con precios intermedios
3. Tarifa C: Clientes pequeños o de baja frecuencia
4. Tarifa D: Casos especiales
5. Tarifa G: Exclusiva para planta producida internamente

PROCESO DE PRODUCCIÓN:
a) El cliente solicita plantas específicas
b) Se verifica disponibilidad en la cámara de semillas
c) Se programa la siembra con fechas específicas
d) Se genera etiqueta con código de barras
e) Se traslada al invernadero asignado
f) Se registra ubicación real en el sistema
g) Se programa riegos y tratamientos
h) Se notifica al cliente cuando está listo
`;

async function testProcesamientoViñetas() {
    console.log('🧪 [TEST] === INICIANDO TEST DE PROCESAMIENTO DE VIÑETAS ===');
    
    try {
        // Procesar el contenido con viñetas
        const chunks = ragInteligente.crearChunksInteligentes(contenidoConViñetas, {
            fuente: 'test-viñetas',
            tipo: 'procesos'
        });
        
        console.log(`\n📊 [TEST] Resultados del procesamiento:`);
        console.log(`• Total de chunks creados: ${chunks.length}`);
        
        chunks.forEach((chunk, index) => {
            console.log(`\n--- CHUNK ${index + 1} ---`);
            console.log(`Título: ${chunk.titulo}`);
            console.log(`Longitud: ${chunk.contenido.length} caracteres`);
            console.log(`Tipo: ${chunk.metadatos.tipo}`);
            console.log(`Palabras clave: ${chunk.metadatos.palabrasClave.join(', ')}`);
            
            // Verificar si las viñetas se procesaron correctamente
            const tieneViñetas = /• |\* |\- |\d+\. |[a-zA-Z]\)/.test(chunk.contenido);
            console.log(`Contiene viñetas: ${tieneViñetas ? 'SÍ' : 'NO'}`);
            
            // Mostrar primeras líneas del contenido
            const primerasLineas = chunk.contenido.split('\n').slice(0, 5).join('\n');
            console.log(`Primeras líneas:\n${primerasLineas}${chunk.contenido.split('\n').length > 5 ? '...' : ''}`);
        });
        
        // Verificar que las listas se mantuvieron juntas
        const chunksConListas = chunks.filter(chunk => 
            chunk.contenido.includes('LISTA DE ELEMENTOS:') ||
            (chunk.contenido.match(/• /g) || []).length > 5
        );
        
        console.log(`\n✅ [TEST] Chunks con listas preservadas: ${chunksConListas.length}`);
        
        if (chunksConListas.length > 0) {
            console.log('✅ [TEST] El procesamiento de viñetas funciona correctamente');
        } else {
            console.log('⚠️ [TEST] No se detectaron listas preservadas');
        }
        
    } catch (error) {
        console.error('❌ [TEST] Error en el test:', error);
    }
}

// Ejecutar el test
testProcesamientoViñetas(); 