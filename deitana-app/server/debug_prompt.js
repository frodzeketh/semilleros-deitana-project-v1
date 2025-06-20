const { OpenAI } = require('openai');
const promptBase = require('./employee/promptBaseEmployee').promptBase;
const mapaERP = require('./employee/mapaERPEmployee');
require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Función para obtener contenido relevante de mapaERP
function obtenerContenidoMapaERP(consulta) {
    try {
        const palabrasClave = consulta.toLowerCase().split(' ');
        console.log('🔍 Palabras clave de la consulta:', palabrasClave);

        // Buscar coincidencias en las descripciones y nombres de tablas
        const tablasRelevantes = Object.entries(mapaERP).filter(([key, value]) => {
            const descripcion = value.descripcion.toLowerCase();
            const coincide = palabrasClave.some(palabra => 
                descripcion.includes(palabra) || 
                key.toLowerCase().includes(palabra)
            );
            if (coincide) {
                console.log(`✅ Tabla relevante encontrada: ${key}`);
            }
            return coincide;
        });

        console.log(`📊 Total de tablas relevantes: ${tablasRelevantes.length}`);

        if (tablasRelevantes.length === 0) {
            return `Tablas disponibles: ${Object.keys(mapaERP).join(', ')}`;
        }

        let respuesta = '';
        tablasRelevantes.forEach(([tabla, info]) => {
            respuesta += `\nTABLA ${tabla}:\n`;
            respuesta += `Descripción: ${info.descripcion}\n`;
            respuesta += `Columnas principales: ${Object.keys(info.columnas).join(', ')}\n`;
        });

        return respuesta;
    } catch (error) {
        console.error('❌ Error al obtener contenido de mapaERP:', error);
        return '';
    }
}

async function testPrompt() {
    console.log('🧪 INICIANDO TEST DE DIAGNÓSTICO DEL PROMPT...\n');
    
    const message = 'puedes decirme una bandeja?';
    console.log('📝 Consulta de test:', message);
    
    // Obtener información del mapaERP
    const mapaERPInfo = obtenerContenidoMapaERP(message);
    console.log('\n📋 Información extraída del mapaERP:');
    console.log(mapaERPInfo);
    
    // Construir el prompt completo
    const fullPrompt = `${promptBase}\n\n${mapaERPInfo}`;
    console.log('\n📏 Longitud del prompt completo:', fullPrompt.length, 'caracteres');
    
    // Mostrar las primeras líneas del prompt
    console.log('\n🔤 Primeras 500 caracteres del prompt:');
    console.log(fullPrompt.substring(0, 500) + '...');
    
    // Mostrar las últimas líneas del prompt
    console.log('\n🔤 Últimos 500 caracteres del prompt:');
    console.log('...' + fullPrompt.substring(fullPrompt.length - 500));
    
    // Verificar si contiene las instrucciones críticas
    const tieneProhibiciones = fullPrompt.includes('NUNCA DIGAS ESTAS FRASES');
    const tieneSQL = fullPrompt.includes('<sql></sql>');
    const tieneBandejas = fullPrompt.toLowerCase().includes('bandeja');
    
    console.log('\n✅ Verificaciones de contenido:');
    console.log('- Contiene prohibiciones de frases robóticas:', tieneProhibiciones);
    console.log('- Contiene instrucciones de SQL:', tieneSQL);
    console.log('- Contiene información de bandejas:', tieneBandejas);
    
    console.log('\n🚀 Enviando consulta a GPT...');
    
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: [
                {
                    role: "system",
                    content: fullPrompt
                },
                {
                    role: "user", 
                    content: message
                }
            ],
            temperature: 0.7,
            max_tokens: 800
        });

        const response = completion.choices[0].message.content;
        console.log('\n📤 RESPUESTA DE GPT:');
        console.log(response);
        
        // Verificar si contiene SQL
        const tieneTagSQL = response.includes('<sql>');
        const tieneFrasesProhibidas = response.includes('No tengo acceso') || response.includes('no puedo confirmar');
        
        console.log('\n🔍 Análisis de la respuesta:');
        console.log('- Contiene etiquetas <sql>:', tieneTagSQL);
        console.log('- Contiene frases prohibidas:', tieneFrasesProhibidas);
        console.log('- Longitud de respuesta:', response.length, 'caracteres');
        
    } catch (error) {
        console.error('❌ Error al consultar GPT:', error);
    }
}

testPrompt(); 