### RAG y Pinecone – Guía rápida

Este documento resume cómo limpiar el índice de Pinecone y cómo cargar (o recargar) el conocimiento oficial desde `admin/data/informacionEmpresa.txt`.

### Requisitos

- Tener `server/.env` con las variables:
  - `OPENAI_API_KEY=...`
  - `PINECONE_API_KEY=...`
  - `PINECONE_INDEX=memoria-deitana` (o el índice que uses)
- Ejecutar los comandos desde la carpeta `server`.

### Comandos principales

- Limpiar completamente (dejar vacío):
  ```bash
  npm run pinecone:clean
  # equivalente: node limpiar-pinecone.js --no-reload
  ```

- Limpiar y recargar el conocimiento oficial de la empresa (reset):
  ```bash
  npm run pinecone:reset
  # equivalente: node limpiar-pinecone.js
  ```

- Cargar/actualizar el conocimiento oficial sin limpiar primero (añade/actualiza chunks):
  ```bash
  npm run pinecone:load
  # equivalente: node admin/scripts/cargar-conocimiento.js
  ```

- Reindexar con secciones y reporte (pipeline alternativo más detallado):
  ```bash
  npm run pinecone:reindex
  # equivalente: node reindexar-informacion-empresa.js
  ```

### Dónde lee el contenido

- Archivo base: `server/admin/data/informacionEmpresa.txt`

### Notas y verificación

- Si el dashboard de Pinecone sigue mostrando resultados, refresca y confirma que estás en el índice correcto (`PINECONE_INDEX`).
- Los logs de los scripts muestran cuántos vectores se borran/cargan y cuántos chunks se procesan.
- El RAG prioriza siempre los chunks oficiales (`tipo: informacion_empresa_oficial`) y filtra memorias conversacionales.

### Problemas comunes

- Error de API Key: revisa `server/.env` y que ejecutas desde `server`.
- Namespace/índice incorrecto: ajusta `PINECONE_INDEX` en `server/.env`.

