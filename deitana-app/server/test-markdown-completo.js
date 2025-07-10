// =====================================
// TEST DE MARKDOWN COMPLETO - COMO CHATGPT
// =====================================

const { processQueryStream } = require('./admin/core/openAI')

async function testMarkdownCompleto() {
  console.log('🧪 INICIANDO TEST DE MARKDOWN COMPLETO...\n')
  
  const pregutas = [
    {
      consulta: "Explícame los diferentes tipos de listas en HTML con ejemplos de código",
      descripcion: "Test para código, listas y estructura"
    },
    {
      consulta: "Crea una tabla comparativa entre React y Vue.js con sus ventajas y desventajas",
      descripcion: "Test para tablas y formato estructurado"
    },
    {
      consulta: "¿Cómo configurar un servidor Express.js? Dame los pasos con código",
      descripcion: "Test para encabezados, listas numeradas y bloques de código"
    },
    {
      consulta: "Explícame qué es REST API usando ejemplos y formato visual atractivo",
      descripcion: "Test para uso completo de Markdown como ChatGPT"
    }
  ]

  for (const { consulta, descripcion } of pregutas) {
    console.log(`\n📝 ${descripcion}`)
    console.log(`❓ Pregunta: "${consulta}"`)
    console.log('💭 Esperando respuesta con Markdown completo...\n')
    
    try {
      // Simular el streaming y capturar respuesta completa
      let respuestaCompleta = ''
      
      const stream = await processQueryStream(consulta, [], '')
      
      stream.on('data', (chunk) => {
        const lines = chunk.toString().split('\n').filter(line => line.trim())
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line)
            if (data.type === 'chunk' && data.content) {
              respuestaCompleta += data.content
            } else if (data.type === 'end') {
              console.log('🎨 RESPUESTA CON MARKDOWN:')
              console.log('─'.repeat(60))
              console.log(respuestaCompleta)
              console.log('─'.repeat(60))
              
              // Verificar elementos de Markdown
              console.log('\n🔍 ANÁLISIS DE FORMATO:')
              
              const verificaciones = [
                { elemento: 'Encabezados (#)', regex: /^#{1,6}\s/m, encontrado: false },
                { elemento: 'Negrita (**)', regex: /\*\*[^*]+\*\*/g, encontrado: false },
                { elemento: 'Cursiva (*)', regex: /\*[^*]+\*/g, encontrado: false },
                { elemento: 'Código inline (`)', regex: /`[^`]+`/g, encontrado: false },
                { elemento: 'Bloques código (```)', regex: /```[\s\S]*?```/g, encontrado: false },
                { elemento: 'Listas (-)', regex: /^[\s]*[-*+]\s/m, encontrado: false },
                { elemento: 'Listas numeradas (1.)', regex: /^\d+\.\s/m, encontrado: false },
                { elemento: 'Enlaces ([texto](url))', regex: /\[([^\]]+)\]\(([^)]+)\)/g, encontrado: false },
                { elemento: 'Tablas (|)', regex: /\|.*\|/g, encontrado: false },
                { elemento: 'Emojis', regex: /[\u{1F600}-\u{1F6FF}]|[\u{2600}-\u{26FF}]/gu, encontrado: false }
              ]
              
              verificaciones.forEach(v => {
                v.encontrado = v.regex.test(respuestaCompleta)
                const status = v.encontrado ? '✅' : '❌'
                console.log(`  ${status} ${v.elemento}`)
              })
              
              const elementosUsados = verificaciones.filter(v => v.encontrado).length
              const porcentaje = (elementosUsados / verificaciones.length * 100).toFixed(1)
              
              console.log(`\n📊 Uso de Markdown: ${elementosUsados}/${verificaciones.length} elementos (${porcentaje}%)`)
              
              if (porcentaje >= 50) {
                console.log('🎉 ¡Excelente! El asistente está usando Markdown como ChatGPT')
              } else if (porcentaje >= 25) {
                console.log('⚠️  Bien, pero puede mejorar el uso de formato')
              } else {
                console.log('❌ Muy poco uso de Markdown - necesita mejoras')
              }
              
              console.log('\n' + '='.repeat(80))
            }
          } catch (e) {
            // Ignorar líneas que no son JSON válido
          }
        }
      })
      
      // Esperar un momento para que termine el stream
      await new Promise(resolve => setTimeout(resolve, 5000))
      
    } catch (error) {
      console.error('❌ Error en la prueba:', error.message)
    }
  }
  
  console.log('\n🏁 TEST COMPLETADO')
  console.log('Si ves muchos ✅ arriba, tu asistente ya funciona como ChatGPT!')
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  testMarkdownCompleto().catch(console.error)
}

module.exports = { testMarkdownCompleto } 