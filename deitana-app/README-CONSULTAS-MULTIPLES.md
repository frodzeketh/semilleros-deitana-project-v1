# 🔄 Sistema de Consultas Múltiples Inteligentes

## 🎯 **¿Qué es?**

El **Sistema de Consultas Múltiples Inteligentes** es una mejora significativa que permite al asistente ejecutar hasta **3 consultas SQL diferentes** cuando la primera no encuentra resultados, incluyendo búsquedas fuzzy y variaciones de términos.

## 🚀 **¿Por qué se implementó?**

### **Problemas anteriores:**
- ❌ Una sola consulta SQL → Si no encuentra resultados, falla
- ❌ No maneja errores tipográficos ("brocoli" vs "brócoli")
- ❌ No encuentra variaciones de nombres ("tomatee amareloo" vs "amarelo")
- ❌ No busca términos similares ("certificado" vs "CERTIFICADA")

### **Soluciones implementadas:**
- ✅ **Hasta 3 consultas automáticas** cuando la primera falla
- ✅ **Búsqueda fuzzy** con LIKE '%termino%'
- ✅ **Variaciones de términos** inteligentes
- ✅ **Búsqueda genérica** como último recurso

## 🔍 **Estrategias de Búsqueda**

### **1️⃣ Búsqueda Fuzzy Amplia**
```sql
-- Primera consulta (original)
SELECT id, AR_DENO FROM articulos WHERE AR_DENO LIKE '%brocoli%' AND AR_DENO LIKE '%certificado%'

-- Si no encuentra, búsqueda fuzzy
SELECT id, AR_DENO FROM articulos WHERE AR_DENO LIKE '%BROC%' AND AR_DENO LIKE '%CERTIFICADA%'
```

### **2️⃣ Variaciones de Términos**
```javascript
// Mapeo inteligente de variaciones
"brocoli" → ["brócoli", "BROC", "BROCOLI"]
"tomatee" → ["tomate", "TOMAT"]
"amareloo" → ["amarelo", "AMARELO"]
"certificado" → ["CERTIFICADA", "SEMILLA"]
```

### **3️⃣ Búsqueda Genérica**
```sql
-- Si no encuentra nada específico, muestra registros generales
SELECT * FROM articulos WHERE AR_DENO LIKE '%BROC%' LIMIT 20
```

## 📋 **Casos de Uso Reales**

### **Caso 1: Error tipográfico en producto**
```
Usuario: "necesito el id del brocoli certificado"
Problema: Escribe "brocoli" en lugar de "brócoli"
Solución: Sistema encuentra "BROC. GREENBELT SEMILLA CERTIFICADA"
```

### **Caso 2: Variación de nombre de cliente**
```
Usuario: "informacion del cliente tomatee amareloo"
Problema: Escribe "tomatee amareloo" en lugar de "amarelo"
Solución: Sistema encuentra cliente con "amarelo" en el nombre
```

### **Caso 3: Búsqueda de proveedor**
```
Usuario: "dame el proveedor del tomate amarelo"
Problema: Producto puede estar registrado con variaciones
Solución: Sistema busca en artículos y encuentra proveedor
```

## 🔧 **Implementación Técnica**

### **Archivos modificados:**
- `server/admin/core/openAI.js` - Función principal de consultas múltiples
- `server/admin/prompts/sqlRules.js` - Reglas SQL actualizadas

### **Nuevas funciones:**
```javascript
// Función principal
async function ejecutarConsultasMultiplesInteligentes(userQuery, primeraConsulta, resultadosPrimera)

// Funciones auxiliares
async function generarConsultasAlternativas(userQuery, primeraConsulta)
function generarConsultaFuzzy(userQuery, primeraConsulta)
function generarConsultaVariaciones(userQuery, primeraConsulta)
function generarConsultaGenerica(userQuery, primeraConsulta)
function extraerTerminosBusqueda(userQuery)
function generarVariacionesTerminos(terminos)
```

### **Flujo de ejecución:**
1. **Ejecuta consulta original** generada por IA
2. **Si no hay resultados** → Ejecuta búsqueda fuzzy
3. **Si no hay resultados** → Ejecuta variaciones de términos
4. **Si no hay resultados** → Ejecuta búsqueda genérica
5. **Máximo 3 consultas adicionales**

## 📊 **Beneficios**

### **Para el usuario:**
- ✅ **Mayor tasa de éxito** en búsquedas
- ✅ **Manejo automático** de errores tipográficos
- ✅ **Búsquedas más flexibles** y naturales
- ✅ **Mejor experiencia** de usuario

### **Para el sistema:**
- ✅ **Reducción de consultas fallidas**
- ✅ **Búsquedas más inteligentes**
- ✅ **Mejor aprovechamiento** de la base de datos
- ✅ **Sistema más robusto**

## 🧪 **Pruebas**

### **Archivo de prueba:**
```bash
node server/test-consultas-multiples.js
```

### **Ejemplos de prueba:**
1. `"necesito el id del brocoli certificado"`
2. `"informacion del cliente tomatee amareloo"`
3. `"dame el proveedor del tomate amarelo"`

## 🎯 **Configuración**

### **Límites configurables:**
- **Máximo consultas adicionales**: 3
- **Límite de resultados**: 20 por consulta
- **Tiempo de espera**: Configurable por consulta

### **Variaciones personalizables:**
```javascript
// En generarVariacionesTerminos()
if (termino.includes('brocoli')) {
    variaciones.push('brócoli', 'brocoli', 'BROC');
}
```

## 🔄 **Compatibilidad**

### **Con sistemas existentes:**
- ✅ **Compatible** con el sistema actual
- ✅ **No afecta** consultas que ya funcionan
- ✅ **Mejora** solo consultas que fallan
- ✅ **Mantiene** toda la funcionalidad anterior

### **Con streaming:**
- ✅ **Funciona** con streaming en tiempo real
- ✅ **Mantiene** la experiencia de usuario
- ✅ **No afecta** el rendimiento

## 📈 **Métricas de Éxito**

### **Antes:**
- ❌ Consulta única → Si falla, no hay resultados
- ❌ No maneja errores tipográficos
- ❌ No encuentra variaciones

### **Después:**
- ✅ **Hasta 4 consultas** (1 original + 3 adicionales)
- ✅ **Manejo inteligente** de errores tipográficos
- ✅ **Búsqueda fuzzy** y variaciones
- ✅ **Tasa de éxito significativamente mayor**

## 🚀 **Próximas Mejoras**

### **Futuras implementaciones:**
- 🔄 **Búsqueda semántica** más avanzada
- 🔄 **Machine Learning** para mejorar variaciones
- 🔄 **Análisis de contexto** conversacional
- 🔄 **Optimización automática** de consultas

---

## 📞 **Soporte**

Para preguntas o problemas con el sistema de consultas múltiples:
- Revisar logs en `server/admin/core/openAI.js`
- Ejecutar pruebas con `test-consultas-multiples.js`
- Verificar configuración en `sqlRules.js` 