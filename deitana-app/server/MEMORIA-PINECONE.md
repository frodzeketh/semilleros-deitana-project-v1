# 🧠 Sistema de Memoria Semántica con Pinecone

## ¿Qué es?

El sistema de memoria semántica permite que Deitana IA **recuerde** conversaciones anteriores y **personalice** sus respuestas basándose en tus preferencias y experiencias pasadas.

## 🚀 Funcionalidades

### 1. **Memoria Automática**
- **Guarda automáticamente** información importante de cada conversación
- **Detecta** preferencias, problemas, éxitos y patrones de uso
- **No requiere** comandos especiales - funciona en segundo plano

### 2. **Búsqueda Semántica**
- Encuentra información **por significado**, no solo por palabras exactas
- Ejemplo: buscas "problemas con tomates" → encuentra "los tomateros tuvieron plagas"

### 3. **Comandos Especiales**
```
• "Recuerda que prefiero bandejas de 104 alvéolos"
• "Mis recuerdos"  
• "Busca en mi memoria sobre sustratos"
• "Qué sabes sobre problemas con lechugas"
```

## 📋 Cómo Usar

### Guardar Preferencias Manualmente
```
👤 Usuario: "Recuerda que siempre uso sustrato orgánico para tomates"
🤖 Deitana: "✅ Perfecto, he guardado tu preferencia: 'siempre uso sustrato orgánico para tomates'. La recordaré para futuras consultas."
```

### Ver Tus Recuerdos
```
👤 Usuario: "Mis recuerdos"
🤖 Deitana: "🧠 Aquí están tus preferencias que tengo guardadas:

1. Siempre uso sustrato orgánico para tomates
2. Prefiero bandejas de 104 alvéolos para lechuga
3. El cliente Juan suele tener problemas con pulgones

¿Te gustaría agregar alguna nueva preferencia?"
```

### Buscar en la Memoria
```
👤 Usuario: "Busca en mi memoria sobre problemas con plagas"
🤖 Deitana: "🔍 Esto es lo que encontré sobre 'problemas con plagas':

1. El cliente Juan suele tener problemas con pulgones (similitud: 89%)
2. Los tomateros del invernadero 3 tuvieron ácaros (similitud: 76%)
```

### Memoria Automática en Acción
```
👤 Usuario: "¿qué bandeja me recomiendas para lechuga?"
🤖 Deitana: "Basándome en tus preferencias anteriores, te recomiendo bandejas de 104 alvéolos que has usado exitosamente para lechuga. 

Aquí tienes las opciones disponibles:
[Datos de la base de datos]"
```

## 🔧 Configuración Técnica

### Variables de Entorno (ya configuradas)
```env
PINECONE_API_KEY=pcsk_6muZqf_4bnwdp2YQ21dH7Kh6ghB7YdGkAvjkDCmNkXfFLaXx5iDTnNJWUrkvZ92F1EuBzm
PINECONE_INDEX=memoria-deitana
PINECONE_ENVIRONMENT=us-east-1-aws
```

### Instalar Dependencias
```bash
cd deitana-app/server
npm install @pinecone-database/pinecone
```

### Probar el Sistema
```bash
node test-pinecone.js
```

## 🧪 Testing

El archivo `test-pinecone.js` incluye pruebas para:
- ✅ Guardar recuerdos
- ✅ Buscar por similitud semántica  
- ✅ Generar embeddings
- ✅ Comandos especiales
- ✅ Contexto de memoria

## 📊 Tipos de Información Guardada

### Automáticamente:
- **Preferencias** expresadas por el usuario
- **Problemas** reportados y sus soluciones
- **Clientes específicos** y sus características
- **Productos/técnicas** que funcionan bien
- **Consultas SQL** exitosas y sus contextos

### Manualmente:
- **Preferencias personales** con comando "Recuerda que..."
- **Notas importantes** que quieras que persistan

## 🔒 Privacidad y Seguridad

- **Separación por usuario**: Cada usuario solo ve sus propios recuerdos
- **Filtrado automático**: Solo información relevante se guarda
- **Similitud mínima**: Solo recuerdos con >70% similitud se muestran
- **Sin datos sensibles**: No se guardan contraseñas ni información confidencial

## 🚀 Flujo de Integración

1. **Usuario hace pregunta** → "¿qué sustrato usar para tomates?"
2. **Sistema busca memoria** → Encuentra "prefiero sustrato orgánico"
3. **Agrega contexto** → "El usuario prefiere sustrato orgánico..."
4. **GPT responde personalizado** → "Te recomiendo sustratos orgánicos como prefieres..."
5. **Guarda automáticamente** → Si la respuesta es útil, se guarda para futuro

## 🔄 Ejemplos de Casos de Uso

### Caso 1: Cliente Problemático
```
Día 1: "El cliente Juan tuvo problemas con pulgones en tomates"
Día 15: "¿qué cliente suele tener problemas con plagas?"
Respuesta: "Juan frecuentemente tiene problemas con pulgones..."
```

### Caso 2: Producto Favorito
```
Día 1: "Las bandejas de 104 alvéolos funcionan genial para lechuga"
Día 10: "¿qué bandeja me recomiendas para verduras de hoja?"
Respuesta: "Te recomiendo las de 104 alvéolos que has usado exitosamente..."
```

### Caso 3: Técnica Exitosa
```
Día 1: "El sustrato XYZ con ese proveedor da excelentes resultados"
Día 20: "¿qué sustrato recomiendas?"
Respuesta: "El sustrato XYZ que usaste anteriormente con buenos resultados..."
```

## ⚡ Ventajas del Sistema

- **🧠 Memoria persistente** - Nunca olvida información importante
- **🎯 Respuestas personalizadas** - Basadas en tu experiencia específica  
- **🔍 Búsqueda inteligente** - Encuentra información por contexto
- **⚙️ Automático** - Funciona sin comandos especiales
- **🔒 Privado** - Cada usuario tiene su propia memoria
- **🚀 Rápido** - Búsquedas vectoriales optimizadas

## 🆘 Solución de Problemas

### Si no funciona la memoria:
1. Verificar variables de entorno en `.env`
2. Ejecutar `node test-pinecone.js`
3. Verificar conexión a internet (APIs externas)
4. Revisar logs de consola para errores específicos

### Si no encuentra recuerdos:
- Los recuerdos necesitan >70% similitud semántica
- Intenta usar palabras clave más específicas
- Los recuerdos recientes tienen más peso

---

¡El sistema ya está listo para usar! 🎉 