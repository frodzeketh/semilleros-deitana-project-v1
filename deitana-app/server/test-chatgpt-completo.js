// =====================================
// TEST COMPLETO DE COMPORTAMIENTO CHATGPT
// =====================================

const { processQueryStream } = require('./admin/core/openAI')

async function testComportamientoChatGPT() {
  console.log('🤖 INICIANDO TEST DE COMPORTAMIENTO CHATGPT COMPLETO...\n')
  
  const pruebasComportamiento = [
    {
      categoria: "🧠 RAZONAMIENTO PASO A PASO",
      consultas: [
        "¿Cómo optimizar la germinación de semillas de tomate?",
        "Explícame el proceso de injerto paso a paso"
      ]
    },
    {
      categoria: "🎨 FORMATO VISUAL COMPLETO", 
      consultas: [
        "Compara los diferentes tipos de sustratos para semilleros",
        "Dame una guía completa de mantenimiento de cámaras de germinación"
      ]
    },
    {
      categoria: "💬 CONTINUIDAD CONVERSACIONAL",
      consultas: [
        // Primera pregunta
        "¿Qué factores afectan la germinación?",
        // Seguimiento (simular segunda pregunta)
        "entonces?"
      ]
    },
    {
      categoria: "🔧 RESPUESTAS TÉCNICAS CON EJEMPLOS",
      consultas: [
        "Explícame los problemas más comunes en bandejas de germinación",
        "¿Cómo configurar un protocolo de riego automatizado?"
      ]
    },
    {
      categoria: "📊 ANÁLISIS Y TABLAS",
      consultas: [
        "Crea una tabla comparativa de variedades de tomate para invernadero",
        "Analiza las ventajas y desventajas de diferentes sistemas de cultivo"
      ]
    }
  ]

  for (const { categoria, consultas } of pruebasComportamiento) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`${categoria}`)
    console.log('='.repeat(60))
    
    for (const consulta of consultas) {
      console.log(`\n📝 CONSULTA: "${consulta}"`)
      console.log('─'.repeat(50))
      
      try {
        let respuestaCompleta = ''
        
        const stream = await processQueryStream(consulta, [], '')
        
        await new Promise((resolve) => {
          stream.on('data', (chunk) => {
            const lines = chunk.toString().split('\n').filter(line => line.trim())
            
            for (const line of lines) {
              try {
                const data = JSON.parse(line)
                if (data.type === 'chunk' && data.content) {
                  respuestaCompleta += data.content
                } else if (data.type === 'end') {
                  console.log('🎨 RESPUESTA GENERADA:')
                  console.log(respuestaCompleta)
                  console.log('\n🔍 ANÁLISIS DE CALIDAD CHATGPT:')
                  
                  // Verificaciones específicas de comportamiento ChatGPT
                  const verificaciones = [
                    {
                      aspecto: '🏷️ Título con emoji',
                      regex: /^#\s*[🎯🌱🔧📊🚀💡🌿🍅⚡🎨🔬]/m,
                      peso: 10
                    },
                    {
                      aspecto: '📋 Estructura con encabezados',
                      regex: /#{2,4}\s*[\w\s🎯📋⚙️💡✅❌🔧📊🤔]/gm,
                      peso: 15
                    },
                    {
                      aspecto: '✅ Listas con emojis',
                      regex: /-\s*[✅❌🔧📊💡🎯🌱]/gm,
                      peso: 10
                    },
                    {
                      aspecto: '**Texto en negrita**',
                      regex: /\*\*[^*]+\*\*/g,
                      peso: 8
                    },
                    {
                      aspecto: '*Texto en cursiva*',
                      regex: /\*[^*]+\*/g,
                      peso: 5
                    },
                    {
                      aspecto: '`Código inline`',
                      regex: /`[^`]+`/g,
                      peso: 8
                    },
                    {
                      aspecto: '```Bloques de código```',
                      regex: /```[\s\S]*?```/g,
                      peso: 12
                    },
                    {
                      aspecto: '> Blockquotes importantes',
                      regex: /^>\s*[\w\s💡⚠️📝🎯]/gm,
                      peso: 10
                    },
                    {
                      aspecto: '📊 Tablas organizadas',
                      regex: /\|.*\|/g,
                      peso: 15
                    },
                    {
                      aspecto: '😊 Emojis apropiados',
                      regex: /[🎯🌱🔧📊🚀💡🌿🍅⚡🎨🔬✅❌💬🤔📝🏷️📋]/g,
                      peso: 12
                    },
                    {
                      aspecto: '🤔 Preguntas de seguimiento',
                      regex: /¿[^?]+\?(?=\s*$|\s*😊)/gm,
                      peso: 8
                    },
                    {
                      aspecto: '📚 Explicación paso a paso',
                      regex: /(paso\s*\d+|primero|segundo|tercero|1️⃣|2️⃣|3️⃣)/gi,
                      peso: 12
                    }
                  ]
                  
                  let puntuacionTotal = 0
                  let puntuacionMaxima = 0
                  
                  verificaciones.forEach(v => {
                    const matches = respuestaCompleta.match(v.regex)
                    const encontrado = matches && matches.length > 0
                    const status = encontrado ? '✅' : '❌'
                    const cantidad = matches ? matches.length : 0
                    
                    console.log(`  ${status} ${v.aspecto} ${cantidad > 0 ? `(${cantidad})` : ''}`)
                    
                    if (encontrado) {
                      puntuacionTotal += v.peso
                    }
                    puntuacionMaxima += v.peso
                  })
                  
                  const porcentajeCalidad = (puntuacionTotal / puntuacionMaxima * 100).toFixed(1)
                  
                  console.log(`\n📈 PUNTUACIÓN CHATGPT: ${puntuacionTotal}/${puntuacionMaxima} (${porcentajeCalidad}%)`)
                  
                  // Evaluación final
                  if (porcentajeCalidad >= 80) {
                    console.log('🎉 ¡EXCELENTE! Comportamiento igual a ChatGPT')
                  } else if (porcentajeCalidad >= 60) {
                    console.log('👍 BUENO - Se acerca al comportamiento de ChatGPT')
                  } else if (porcentajeCalidad >= 40) {
                    console.log('⚠️ REGULAR - Necesita mejoras para ser como ChatGPT')
                  } else {
                    console.log('❌ MALO - Muy diferente a ChatGPT')
                  }
                  
                  // Análisis específico
                  const tieneEstructura = respuestaCompleta.match(/#{1,4}/g)
                  const tieneEmojis = respuestaCompleta.match(/[🎯🌱🔧📊🚀💡🌿🍅⚡🎨🔬✅❌]/g)
                  const tieneFormato = respuestaCompleta.match(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
                  
                  console.log('\n📋 DIAGNÓSTICO ESPECÍFICO:')
                  if (!tieneEstructura) console.log('  ⚠️ Falta estructura con encabezados')
                  if (!tieneEmojis) console.log('  ⚠️ Falta uso apropiado de emojis')
                  if (!tieneFormato) console.log('  ⚠️ Falta formato de texto (negritas, cursivas, código)')
                  
                  if (respuestaCompleta.length < 200) {
                    console.log('  ⚠️ Respuesta demasiado corta - ChatGPT es más detallado')
                  }
                  
                  if (!respuestaCompleta.includes('?')) {
                    console.log('  ⚠️ Falta pregunta de seguimiento - ChatGPT siempre ofrece continuar')
                  }
                  
                  resolve()
                }
              } catch (e) {
                // Ignorar líneas que no son JSON válido
              }
            }
          })
          
          // Timeout por si no llega el 'end'
          setTimeout(resolve, 8000)
        })
        
      } catch (error) {
        console.error('❌ Error en la prueba:', error.message)
      }
      
      console.log('\n' + '─'.repeat(50))
    }
  }
  
  console.log('\n🏁 TEST COMPLETADO')
  console.log('\n🎯 RESUMEN:')
  console.log('Si ves muchos ✅ y puntuaciones >80%, tu asistente se comporta como ChatGPT')
  console.log('Si ves muchos ❌ y puntuaciones <60%, necesita ajustes adicionales')
  console.log('\n🚀 El objetivo es que TODAS las respuestas tengan formato rico, emojis, estructura y sean útiles como ChatGPT')
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  testComportamientoChatGPT().catch(console.error)
}

module.exports = { testComportamientoChatGPT } 