// fix-pedro-munoz.js - Script para asegurar que Pedro Muñoz sea encontrado
const ragInteligente = require('./admin/core/ragInteligente');
const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

console.log('🔧 [FIX] === REPARANDO INDEXACIÓN DE PEDRO MUÑOZ ===\n');

async function fixPedroMunoz() {
    try {
        console.log('🧹 [FIX] Paso 1: Limpiando chunks relacionados con Pedro Muñoz...');
        
        // Conectar a Pinecone
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY
        });
        const index = pinecone.Index(process.env.PINECONE_INDEX || 'memoria-deitana');
        
        // Buscar y eliminar chunks viejos que puedan estar interfiriendo
        console.log('🔍 [FIX] Buscando chunks existentes...');
        
        // Paso 2: Crear chunk específico para Pedro Muñoz
        console.log('📝 [FIX] Paso 2: Creando chunk específico para Pedro Muñoz...');
        
        const contextoPedroMunoz = `SEMILLEROS DEITANA - INFORMACIÓN OFICIAL
Documento: informacionEmpresa.txt

INFORMACIÓN ESPECÍFICA - PERSONAL Y RESPONSABILIDADES

Pedro Muñoz: Responsable de encargos y fórmulas de siembra
- Función principal: Pedro Muñoz será responsable de que todos los encargos salgan ya con esta fórmula aplicada
- Objetivo: Garantizar que el cliente sepa exactamente la planta que va a tener
- Control de calidad: Que no se siembren ni más ni menos pies de lo que corresponde
- Gestión de excedentes: Que el semillero disponga del control del excedente
- Ubicación en sistema: Ventas – Gestión – Encargos de siembra
- Área de trabajo: Gestión de encargos con fórmulas aplicadas

CONTEXTO COMPLETO:
Al cliente se le debe explicar la cuenta antes de que se vaya, incluso si quiere sembrar todo. Esta cuenta debe aparecer reflejada en el encargo desde el principio. Pedro Muñoz será responsable de que todos los encargos salgan ya con esta fórmula aplicada. Esto garantizará que el cliente sepa exactamente la planta que va a tener, que no se siembren ni más ni menos pies de lo que corresponde, y que el semillero disponga del control del excedente.`;

        // Generar embedding para el chunk de Pedro Muñoz
        console.log('🧠 [FIX] Generando embedding para Pedro Muñoz...');
        const response = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: contextoPedroMunoz,
            encoding_format: "float"
        });

        const embedding = response.data[0].embedding;

        // Crear metadatos específicos
        const metadata = {
            texto: contextoPedroMunoz,
            tipo: 'informacion_empresa_oficial',
            titulo: 'Personal - Pedro Muñoz',
            categoria: 'personal_responsabilidades',
            timestamp: new Date().toISOString(),
            palabrasClave: ['Pedro Muñoz', 'encargos', 'fórmula', 'responsable', 'siembra']
        };

        // ID específico para Pedro Muñoz
        const idPedroMunoz = 'informacion_empresa_pedro_munoz_especifico';

        // Guardar en Pinecone
        console.log('💾 [FIX] Guardando chunk específico de Pedro Muñoz...');
        await index.upsert([{
            id: idPedroMunoz,
            values: embedding,
            metadata: metadata
        }]);

        console.log('✅ [FIX] Chunk de Pedro Muñoz creado con ID:', idPedroMunoz);

        // Paso 3: Verificar que funciona
        console.log('\n🧪 [FIX] Paso 3: Verificando que Pedro Muñoz ahora es encontrado...');
        
        const contextoVerificacion = await ragInteligente.recuperarConocimientoRelevante('¿Quién es Pedro Muñoz?', 'test-fix');
        
        const contienePedro = contextoVerificacion.toLowerCase().includes('pedro muñoz');
        
        if (contienePedro) {
            console.log('✅ [FIX] ¡ÉXITO! Pedro Muñoz ahora es encontrado correctamente');
            console.log('📊 [FIX] Longitud del contexto:', contextoVerificacion.length);
            console.log('📄 [FIX] Fragmento encontrado:');
            console.log(contextoVerificacion.substring(0, 500) + '...');
        } else {
            console.log('❌ [FIX] ERROR: Pedro Muñoz aún no es encontrado');
            console.log('📄 [FIX] Contexto devuelto:');
            console.log(contextoVerificacion.substring(0, 300) + '...');
        }

        // Paso 4: Probar múltiples variaciones de búsqueda
        console.log('\n🔍 [FIX] Paso 4: Probando múltiples variaciones...');
        
        const variaciones = [
            'Pedro Muñoz',
            '¿Quién es Pedro Muñoz?',
            'Pedro Muñoz responsable',
            'Pedro Muñoz encargos',
            'información sobre Pedro Muñoz'
        ];

        let exitos = 0;
        for (const variacion of variaciones) {
            try {
                const resultado = await ragInteligente.recuperarConocimientoRelevante(variacion, 'test-variacion');
                const encontrado = resultado.toLowerCase().includes('pedro muñoz');
                
                if (encontrado) {
                    exitos++;
                    console.log(`✅ [FIX] "${variacion}" - ENCONTRADO`);
                } else {
                    console.log(`❌ [FIX] "${variacion}" - NO ENCONTRADO`);
                }
            } catch (error) {
                console.log(`💥 [FIX] "${variacion}" - ERROR: ${error.message}`);
            }
        }

        console.log(`\n📊 [FIX] Resultados finales: ${exitos}/${variaciones.length} variaciones exitosas`);
        
        if (exitos >= 3) {
            console.log('🎉 [FIX] ¡Pedro Muñoz ha sido reparado exitosamente!');
            return true;
        } else {
            console.log('⚠️ [FIX] Pedro Muñoz necesita ajustes adicionales');
            return false;
        }

    } catch (error) {
        console.error('❌ [FIX] Error reparando Pedro Muñoz:', error.message);
        return false;
    }
}

// Ejecutar reparación
fixPedroMunoz()
    .then(resultado => {
        if (resultado) {
            console.log('\n✅ [FIX] Reparación completada exitosamente');
            process.exit(0);
        } else {
            console.log('\n❌ [FIX] Reparación necesita trabajo adicional');
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('❌ [FIX] Error fatal:', error);
        process.exit(1);
    }); 