// =====================================
// TEST: ANÁLISIS DE ALUCINACIONES - 25 CONSULTAS VARIADAS
// =====================================

const { processQuery } = require('./admin/core/openAI');

async function testAlucinaciones() {
    console.log('🧪 [TEST] Iniciando análisis de alucinaciones con 25 consultas variadas...');
    
    const testQueries = [
        // === CONSULTAS SOBRE PROCESOS Y PROCEDIMIENTOS ===
        {
            message: '¿Cuál es el proceso de entrada en cámara de germinación?',
            category: 'procesos',
            expectedInfo: 'traslado en carros, registro en ERP, control automático, avisos PDA'
        },
        {
            message: '¿Cómo funciona el protocolo cuando el cliente dice "quiero todo"?',
            category: 'protocolos',
            expectedInfo: 'cálculo obligatorio, 198 plantas por bandeja, 185 para injertos, gestión excedente'
        },
        {
            message: '¿Qué es el sistema de fichaje y organización por sectores?',
            category: 'organización',
            expectedInfo: '14 sectores, encargados con PDA, fichaje interno, asignación de tareas'
        },
        {
            message: '¿Cómo se gestiona el etiquetado de bandejas?',
            category: 'procesos',
            expectedInfo: 'etiqueta grande con código de barras, etiquetas individuales, escaneado PDA'
        },
        {
            message: '¿Cuál es el proceso de facturación?',
            category: 'financiero',
            expectedInfo: 'manual, después de entrega, verificación albarán, conciliación bancaria'
        },

        // === CONSULTAS SOBRE DATOS ESPECÍFICOS ===
        {
            message: '¿Qué tipos de bandejas utilizan?',
            category: 'productos',
            expectedInfo: '52, 54, 104, 150, 198, 260, 322, 874, 589 para cebolla, 322 plástico'
        },
        {
            message: '¿Cuáles son los cultivos principales de Semilleros Deitana?',
            category: 'productos',
            expectedInfo: 'tomate, sandía, pepino, melón, puerro, brócoli, lechuga, cebolla, apio'
        },
        {
            message: '¿Dónde está ubicada la empresa?',
            category: 'empresa',
            expectedInfo: 'Totana, Murcia, Carretera de Mazarrón km 2, 30850'
        },
        {
            message: '¿Cuándo fue fundada la empresa?',
            category: 'empresa',
            expectedInfo: '1989'
        },
        {
            message: '¿Qué certificación tiene la empresa?',
            category: 'empresa',
            expectedInfo: 'ISO 9001'
        },

        // === CONSULTAS SOBRE PERSONAS ===
        {
            message: '¿Quiénes son los dueños de Semilleros Deitana?',
            category: 'personas',
            expectedInfo: 'hermanos Galera Carmona, Antonio Francisco y José Luis'
        },
        {
            message: '¿Quién es Pedro Muñoz?',
            category: 'personas',
            expectedInfo: 'responsable de encargos, aplicación de fórmulas'
        },
        {
            message: '¿Cuántos empleados tiene la empresa?',
            category: 'empresa',
            expectedInfo: 'entre 51 y 200 empleados (según LinkedIn), 13 (según RocketReach)'
        },

        // === CONSULTAS SOBRE SISTEMAS Y ERP ===
        {
            message: '¿Cómo funciona el sistema ERP?',
            category: 'sistemas',
            expectedInfo: 'gestión de partidas, control automático, trazabilidad, módulos específicos'
        },
        {
            message: '¿Qué módulos tiene el ERP?',
            category: 'sistemas',
            expectedInfo: 'Ventas, Compras, Archivos, Producción, Cobros, Partes y Tratamientos'
        },
        {
            message: '¿Cómo se registran las partidas en el sistema?',
            category: 'sistemas',
            expectedInfo: 'Ventas - Otros - Partidas, número único, datos completos'
        },

        // === CONSULTAS SOBRE PROVEEDORES Y CLIENTES ===
        {
            message: '¿Quiénes son los principales proveedores?',
            category: 'comercial',
            expectedInfo: 'Semillas Fitó, Sakata, SUMINISTROS AGRICOLAS S.A.'
        },
        {
            message: '¿Cómo se gestionan los clientes?',
            category: 'comercial',
            expectedInfo: 'datos completos, tarifas, IBAN, seguimiento'
        },
        {
            message: '¿Qué formas de pago aceptan?',
            category: 'financiero',
            expectedInfo: 'transferencia, recibo, 30 días, anticipado, parcial'
        },

        // === CONSULTAS SOBRE INVERNADEROS Y CÁMARAS ===
        {
            message: '¿Cómo funcionan los invernaderos?',
            category: 'infraestructura',
            expectedInfo: 'sectores, subsectores, ubicaciones, gestión por PDA'
        },
        {
            message: '¿Cuántas cámaras de germinación tienen?',
            category: 'infraestructura',
            expectedInfo: 'no especificado en el archivo'
        },
        {
            message: '¿Qué condiciones mantienen en las cámaras?',
            category: 'infraestructura',
            expectedInfo: 'humedad/temperatura óptima, tiempo estimado, restricciones tratamientos'
        },

        // === CONSULTAS SOBRE PRODUCTOS FITOSANITARIOS ===
        {
            message: '¿Qué productos fitosanitarios utilizan?',
            category: 'productos',
            expectedInfo: 'fungicidas para tratamientos iniciales, archivos auxiliares'
        },
        {
            message: '¿Cómo se aplican los tratamientos?',
            category: 'procesos',
            expectedInfo: 'aplicadores fitosanitarios, equipos, partes de tratamiento'
        },

        // === CONSULTAS SOBRE MAQUINARIA ===
        {
            message: '¿Qué maquinaria utilizan?',
            category: 'equipos',
            expectedInfo: 'sembradoras, equipos fitosanitarios, maquinaria específica'
        },
        {
            message: '¿Cómo funciona la sembradora?',
            category: 'equipos',
            expectedInfo: 'ajuste al tipo de semilla, bandeja y cultivo'
        },

        // === CONSULTAS SOBRE SUSTRATOS ===
        {
            message: '¿Qué sustratos utilizan?',
            category: 'productos',
            expectedInfo: 'sustratos específicos, archivos auxiliares'
        }
    ];
    
    const resultados = [];
    
    for (let i = 0; i < testQueries.length; i++) {
        const testQuery = testQueries[i];
        console.log(`\n📝 [TEST ${i + 1}/${testQueries.length}] ${testQuery.category.toUpperCase()}`);
        console.log(`📝 [TEST ${i + 1}] Consulta: "${testQuery.message}"`);
        console.log(`📝 [TEST ${i + 1}] Información esperada: ${testQuery.expectedInfo}`);
        
        try {
            const resultado = await processQuery({
                message: testQuery.message,
                userId: `test-user-alucinaciones-${i}`
            });
            
            if (resultado.success) {
                const respuesta = resultado.data.message.toLowerCase();
                const longitud = resultado.data.message.length;
                
                // Análisis de alucinaciones
                const analisis = {
                    consulta: testQuery.message,
                    categoria: testQuery.category,
                    informacionEsperada: testQuery.expectedInfo,
                    respuesta: resultado.data.message.substring(0, 200) + '...',
                    longitud: longitud,
                    contieneInfoEsperada: false,
                    palabrasClaveEncontradas: [],
                    posibleAlucinacion: false,
                    razonesAlucinacion: []
                };
                
                // Verificar si contiene la información esperada
                const palabrasClave = testQuery.expectedInfo.toLowerCase().split(/[,\s]+/);
                const palabrasEncontradas = palabrasClave.filter(palabra => 
                    palabra.length > 2 && respuesta.includes(palabra)
                );
                
                analisis.palabrasClaveEncontradas = palabrasEncontradas;
                analisis.contieneInfoEsperada = palabrasEncontradas.length >= Math.ceil(palabrasClave.length * 0.3);
                
                // Detectar posibles alucinaciones
                const indicadoresAlucinacion = [
                    'generalmente', 'típicamente', 'normalmente', 'comúnmente',
                    'en la mayoría de casos', 'por lo general', 'habitualmente',
                    'se suele', 'se acostumbra', 'es frecuente',
                    'plantones', 'desinfección', 'tratamiento previo',
                    'configuración de condiciones', 'monitoreo y ajustes',
                    'registro y control', 'trazabilidad', 'embalaje',
                    'envíos', 'envío', 'manual de procedimientos para la selección'
                ];
                
                const indicadoresEncontrados = indicadoresAlucinacion.filter(indicator => 
                    respuesta.includes(indicator)
                );
                
                if (indicadoresEncontrados.length > 0) {
                    analisis.posibleAlucinacion = true;
                    analisis.razonesAlucinacion = indicadoresEncontrados;
                }
                
                // Verificar si la respuesta es muy genérica
                if (respuesta.includes('es un proceso') && !analisis.contieneInfoEsperada) {
                    analisis.posibleAlucinacion = true;
                    analisis.razonesAlucinacion.push('respuesta genérica sin información específica');
                }
                
                resultados.push(analisis);
                
                console.log(`✅ [TEST ${i + 1}] Estado: ÉXITO`);
                console.log(`📊 [TEST ${i + 1}] Longitud: ${longitud} caracteres`);
                console.log(`🔍 [TEST ${i + 1}] Palabras clave encontradas: ${palabrasEncontradas.length}/${palabrasClave.length}`);
                console.log(`🎯 [TEST ${i + 1}] Contiene info esperada: ${analisis.contieneInfoEsperada ? '✅' : '❌'}`);
                console.log(`⚠️ [TEST ${i + 1}] Posible alucinación: ${analisis.posibleAlucinacion ? '❌' : '✅'}`);
                
                if (analisis.posibleAlucinacion) {
                    console.log(`🚨 [TEST ${i + 1}] Razones: ${analisis.razonesAlucinacion.join(', ')}`);
                }
                
            } else {
                console.log(`❌ [TEST ${i + 1}] El sistema falló al procesar la consulta`);
                resultados.push({
                    consulta: testQuery.message,
                    categoria: testQuery.category,
                    error: true
                });
            }
            
        } catch (error) {
            console.error(`❌ [TEST ${i + 1}] Error durante la prueba:`, error.message);
            resultados.push({
                consulta: testQuery.message,
                categoria: testQuery.category,
                error: true,
                errorMessage: error.message
            });
        }
        
        // Pausa entre pruebas
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Análisis final
    console.log('\n📊 [ANÁLISIS FINAL] Resumen de alucinaciones:');
    
    const exitosos = resultados.filter(r => !r.error);
    const alucinaciones = exitosos.filter(r => r.posibleAlucinacion);
    const conInfoEsperada = exitosos.filter(r => r.contieneInfoEsperada);
    
    console.log(`📈 Total consultas: ${resultados.length}`);
    console.log(`✅ Exitosas: ${exitosos.length}`);
    console.log(`❌ Con posible alucinación: ${alucinaciones.length}`);
    console.log(`🎯 Con información esperada: ${conInfoEsperada.length}`);
    
    console.log('\n🚨 [ALUCINACIONES DETECTADAS]:');
    alucinaciones.forEach((r, i) => {
        console.log(`${i + 1}. ${r.categoria}: "${r.consulta}"`);
        console.log(`   Razones: ${r.razonesAlucinacion.join(', ')}`);
    });
    
    console.log('\n✅ [CONSULTAS CORRECTAS]:');
    conInfoEsperada.forEach((r, i) => {
        console.log(`${i + 1}. ${r.categoria}: "${r.consulta}"`);
    });
    
    return resultados;
}

// Ejecutar la prueba
testAlucinaciones().then((resultados) => {
    console.log('\n🏁 [TEST] Análisis de alucinaciones completado');
    process.exit(0);
}).catch(error => {
    console.error('💥 [TEST] Error fatal:', error);
    process.exit(1);
}); 