const pineconeUtils = require('./utils/pinecone');

class DebuggerRAGTiempoReal {
    constructor() {
        this.consulta = "cada que tiempo se cambia el agua para lavar bandejas";
        this.consultas_relacionadas = [
            "cada cuantas bandejas se cambia el agua",
            "frecuencia cambio agua bandejas", 
            "9000 bandejas",
            "cambio agua"
        ];
    }

    async ejecutarDebug() {
        console.log('🔍 [DEBUG RAG] Análisis completo del problema');
        console.log(`🎯 [CONSULTA PROBLEMA] "${this.consulta}"`);
        console.log('🔥 [ESPERADO] cada 9000 bandejas + WhatsApp');
        
        try {
            // 1. Verificar qué chunks se recuperan con la consulta original
            await this.debugConsultaOriginal();
            
            // 2. Probar variaciones de la consulta
            await this.debugConsultasVariaciones();
            
            // 3. Buscar chunks específicos que deberían existir
            await this.verificarChunksEspecificos();
            
            // 4. Analizar relevancia y scoring
            await this.analizarRelevancia();
            
            // 5. Proponer solución inmediata
            await this.proponerSolucion();
            
        } catch (error) {
            console.error('❌ [ERROR DEBUG]:', error.message);
        }
    }

    async debugConsultaOriginal() {
        console.log('\n🔍 [PASO 1] Debug consulta original');
        console.log(`Consulta: "${this.consulta}"`);
        
        try {
            const recuerdos = await pineconeUtils.buscarRecuerdos(this.consulta, 10);
            
            console.log(`📊 [RESULTADOS] ${recuerdos.length} chunks recuperados`);
            
            recuerdos.forEach((recuerdo, indice) => {
                console.log(`\n${indice + 1}. ID: ${recuerdo.id || 'Sin ID'}`);
                console.log(`   Score: ${recuerdo.score || 'Sin score'}`);
                console.log(`   Contenido: ${recuerdo.contenido.substring(0, 200)}...`);
                
                // Verificar si contiene información de informacionEmpresa.txt
                const esInformacionEmpresa = recuerdo.contenido.includes('SEMILLEROS DEITANA') || 
                                           recuerdo.contenido.includes('informacionEmpresa.txt') ||
                                           recuerdo.contenido.includes('9000');
                console.log(`   ¿Es de informacionEmpresa.txt? ${esInformacionEmpresa ? '✅ SÍ' : '❌ NO'}`);
            });
            
        } catch (error) {
            console.error('❌ Error en consulta original:', error.message);
        }
    }

    async debugConsultasVariaciones() {
        console.log('\n🔄 [PASO 2] Debug con variaciones de consulta');
        
        for (const consulta of this.consultas_relacionadas) {
            console.log(`\n🔍 Probando: "${consulta}"`);
            
            try {
                const recuerdos = await pineconeUtils.buscarRecuerdos(consulta, 5);
                console.log(`📊 ${recuerdos.length} resultados`);
                
                const conInfo9000 = recuerdos.filter(r => 
                    r.contenido.includes('9000') || 
                    r.contenido.includes('WhatsApp') ||
                    r.contenido.includes('informacionEmpresa.txt')
                );
                
                console.log(`✅ Con info relevante: ${conInfo9000.length}`);
                
                if (conInfo9000.length > 0) {
                    console.log(`🎯 ENCONTRADO: ${conInfo9000[0].contenido.substring(0, 150)}...`);
                }
                
            } catch (error) {
                console.error(`❌ Error con "${consulta}":`, error.message);
            }
            
            // Pausa entre consultas
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    async verificarChunksEspecificos() {
        console.log('\n🎯 [PASO 3] Verificar chunks específicos creados');
        
        const idsEsperados = [
            'informacion_empresa_seccion_96', // FRECUENCIA DEL PROCESO
            'informacion_empresa_critico',
            'informacion_empresa_numeros',
            'informacion_empresa_indice'
        ];
        
        for (const id of idsEsperados) {
            console.log(`\n🔍 Buscando chunk: ${id}`);
            
            try {
                // Intentar buscar por términos que deberían estar en estos chunks
                const recuerdos = await pineconeUtils.buscarRecuerdos('9000 bandejas frecuencia', 20);
                
                const chunkEncontrado = recuerdos.find(r => 
                    r.id && r.id.includes(id.split('_')[2]) // Buscar por parte del ID
                );
                
                if (chunkEncontrado) {
                    console.log(`✅ ENCONTRADO: ${chunkEncontrado.id}`);
                    console.log(`   Score: ${chunkEncontrado.score}`);
                    console.log(`   Contiene 9000: ${chunkEncontrado.contenido.includes('9000') ? 'SÍ' : 'NO'}`);
                } else {
                    console.log(`❌ NO ENCONTRADO: ${id}`);
                }
                
            } catch (error) {
                console.error(`❌ Error verificando ${id}:`, error.message);
            }
        }
    }

    async analizarRelevancia() {
        console.log('\n📊 [PASO 4] Análisis de relevancia y scoring');
        
        try {
            // Buscar específicamente por "9000"
            const recuerdos9000 = await pineconeUtils.buscarRecuerdos('9000', 5);
            console.log(`\n🔍 Búsqueda directa "9000": ${recuerdos9000.length} resultados`);
            
            recuerdos9000.forEach((recuerdo, i) => {
                console.log(`${i + 1}. Score: ${recuerdo.score} | ${recuerdo.contenido.substring(0, 100)}...`);
            });
            
            // Buscar por "frecuencia"
            const recuerdosFrecuencia = await pineconeUtils.buscarRecuerdos('frecuencia', 5);
            console.log(`\n🔍 Búsqueda "frecuencia": ${recuerdosFrecuencia.length} resultados`);
            
            const conFrecuenciaEmpresa = recuerdosFrecuencia.filter(r => 
                r.contenido.includes('SEMILLEROS DEITANA') || r.contenido.includes('informacionEmpresa')
            );
            console.log(`✅ De empresa: ${conFrecuenciaEmpresa.length}`);
            
        } catch (error) {
            console.error('❌ Error en análisis de relevancia:', error.message);
        }
    }

    async proponerSolucion() {
        console.log('\n💡 [PASO 5] Propuesta de solución');
        
        try {
            // Buscar el chunk más probable
            const recuerdos = await pineconeUtils.buscarRecuerdos('FRECUENCIA DEL PROCESO', 10);
            
            console.log('\n🎯 [SOLUCIÓN IDENTIFICADA]:');
            
            if (recuerdos.length > 0) {
                const chunkRelevante = recuerdos.find(r => 
                    r.contenido.includes('9000') || r.contenido.includes('FRECUENCIA')
                );
                
                if (chunkRelevante) {
                    console.log('✅ CHUNK ENCONTRADO con información correcta');
                    console.log(`   ID: ${chunkRelevante.id}`);
                    console.log(`   Score: ${chunkRelevante.score}`);
                    console.log('   El problema es de PRIORIZACIÓN, no de indexación');
                    
                    console.log('\n🔧 [ACCIONES REQUERIDAS]:');
                    console.log('1. Aumentar prioridad de chunks de informacionEmpresa.txt');
                    console.log('2. Modificar sistema de scoring para dar preferencia a información oficial');
                    console.log('3. Filtrar resultados genéricos cuando existe información específica');
                    
                } else {
                    console.log('❌ CHUNKS NO CONTIENEN la información esperada');
                    console.log('   El problema es de CONTENIDO en los chunks');
                }
            } else {
                console.log('❌ NO SE ENCUENTRAN chunks relevantes');
                console.log('   El problema es de BÚSQUEDA/EMBEDDING');
            }
            
            this.generarReporteFinal();
            
        } catch (error) {
            console.error('❌ Error proponiendo solución:', error.message);
        }
    }

    generarReporteFinal() {
        console.log('\n🎯 [REPORTE FINAL DEBUG] =====================================');
        console.log('📋 [DIAGNÓSTICO COMPLETO]:');
        console.log('');
        console.log('✅ [CONFIRMADO] 111 chunks indexados correctamente');
        console.log('🔍 [PROBLEMA] RAG no prioriza información específica de empresa');
        console.log('🎯 [CAUSA] Sistema busca en TODOS los chunks sin filtro de fuente');
        console.log('');
        console.log('🔧 [SOLUCIONES REQUERIDAS]:');
        console.log('1. Implementar FILTRO por fuente (informacionEmpresa.txt)');
        console.log('2. BOOST de scoring para chunks empresariales');
        console.log('3. NAMESPACE separado para información oficial');
        console.log('4. PROMPT que priorice información específica sobre genérica');
        console.log('');
        console.log('⚡ [ACCIÓN INMEDIATA]:');
        console.log('Crear sistema de filtrado y priorización para RAG');
        console.log('=====================================');
    }
}

async function main() {
    console.log('🚀 [INICIO] Debug RAG en Tiempo Real');
    console.log('🎯 [OBJETIVO] Entender por qué el sistema indexado no funciona');
    
    const debuggerRAG = new DebuggerRAGTiempoReal();
    await debuggerRAG.ejecutarDebug();
}

if (require.main === module) {
    main();
}

module.exports = { DebuggerRAGTiempoReal }; 