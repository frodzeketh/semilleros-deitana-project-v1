const mapaERP = {
  /* ======================================================================================================================================================================*/
  /* ARCHIVOS                                                                                                                                                            */
  /* ======================================================================================================================================================================*/

  /* ================================================*/
  /* Archivos – Generales – Acciones Comerciales */
  /* ================================================*/
  acciones_com: {
    descripcion:
      "Las acciones comerciales son todas aquellas actividades planificadas y ejecutadas por nuestra empresa para establecer, mantener o fortalecer la relación con sus clientes. Incluyen visitas, llamadas, seguimientos, ofertas, asesoramientos y cualquier otra interacción orientada a impulsar ventas, fidelizar clientes y mejorar el servicio ofrecido. Esta información se encuentra en el ERP en la sección del menú inferior Archivos – Generales – Acciones Comerciales",
    columnas: {
      id: "Identificador único de la acción comercial",
      ACCO_DENO: "Denominación o tipo de acción comercial",
      ACCO_CDCL: "Código del cliente",
      ACCO_CDVD: "Código del vendedor",
      ACCO_FEC: "Fecha de la acción",
      ACCO_HOR: "Hora de la acción",
    },
    relaciones: [
      {
        tablaDestino: "clientes",
        campoOrigen: "ACCO_CDCL",
        campoDestino: "id",
        tipo: "muchos-a-uno",
        uso: "Para obtener información detallada del cliente asociado a la acción comercial",
      },
      {
        tablaDestino: "vendedores",
        campoOrigen: "ACCO_CDVD",
        campoDestino: "id",
        tipo: "muchos-a-uno",
        uso: "Para conocer el vendedor responsable de la acción",
      },
      {
        tablaDestino: "acciones_com_acco_not",
        campoOrigen: "id",
        campoDestino: "id",
        tipo: "uno-a-muchos",
        uso: "Para obtener las observaciones asociadas a la acción comercial",
      },
    ],
    ejemplos: [
      {
        descripcion: "Obtener información completa de una acción comercial",
        query: "SELECT a.*, c.CL_DENO as cliente, v.VD_DENO as vendedor, o.C0 as observacion FROM acciones_com a LEFT JOIN clientes c ON a.ACCO_CDCL = c.id LEFT JOIN vendedores v ON a.ACCO_CDVD = v.id LEFT JOIN acciones_com_acco_not o ON a.id = o.id WHERE a.id = 1",
      },
    ],
  },

  acciones_com_acco_not: {
    descripcion:
      "Tabla que registra información detallada sobre observaciones, incidencias y feedback. Almacena notas asociadas a cada acción en acciones_com, divididas en filas según el id2.",
    tabla: "acciones_com_acco_not",
    columnas: {
      id: "Identificador de la acción comercial a la que se refiere la observación",
      id2: "Identificador secuencial de la parte del texto de la observación",
      C0: "Texto de la observación o nota",
    },
    ejemplos: {
      consulta_observaciones:
        "Para obtener todas las observaciones de una acción, se buscaría por el mismo id en diferentes id2",
      ejemplo_observacion:
        "Una observación puede estar dividida en múltiples registros, por ejemplo:\nid: '0000000293', id2: '1', C0: 'INCIDENCIA 348'\nid: '0000000293', id2: '2', C0: 'Salvador Garro llama a Antonio G...'\nid: '0000000293', id2: '3', C0: 'planta que no se puede poner...'",
    },
  },

/* ================================================*/
/* Archivos – Generales – Artículos */
/* ================================================*/
articulos: {
    descripcion:
      "Nuestros artículos son los productos, insumos o bienes con los que trabajamos en Semilleros Deitana. Para cada uno registramos información clave como su descripción, categoría, unidad de medida, precio y características específicas, lo que nos permite asegurar su correcta gestión, control y trazabilidad en cada etapa del proceso. Incluye detalles de stock. Esta información se encuentra en el ERP en la sección del menú inferior Archivos – Generales – Artículos",
    tabla: "articulos", // Nombre de tabla inferido
    columnas: {
      id: "Código único del artículo (Clave Primaria). ",
      AR_DENO: "Denominación o descripción del artículo.",
      AR_REF: "Referencia adicional del artículo.",
      AR_BAR: "Código de barras del artículo.",
      AR_TIVA: "Tipo de IVA aplicado al artículo.",
      AR_GRP: "Código del grupo al que pertenece el artículo.",
      AR_FAM: "Código de la familia del artículo. Clave foránea a la tabla 'familias'.",
      AR_PRV: "Código del proveedor principal del artículo. Clave foránea a la tabla 'proveedores'. Si está vacío, el proveedor no está cargado o se adquirió de otra forma.",
      AR_WEB: "Información adicional para la web.",
      AR_IVAP: "IVA aplicado al precio.",
      AR_PGE: "Porcentaje de germinación.",
      AR_DCG: "Tiempo de germinacion en dias",
      
    },
    relaciones: {
      proveedores: {
        tabla_relacionada: "proveedores",
        tipo: "Muchos a uno (un proveedor puede proveer muchos artículos)",
        campo_enlace_local: "AR_PRV",
        campo_enlace_externo: "id",
        descripcion:
          "Permite identificar qué proveedor principal suministra cada artículo. Si el campo 'AR_PRV' está vacío en un registro de artículo, significa que el proveedor principal no está registrado para ese artículo en este sistema.",
      },
      familias: {
        tabla_relacionada: "familias",
        tipo: "Muchos a uno (varios artículos pueden pertenecer a la misma familia)",
        campo_enlace_local: "AR_FAM",
        campo_enlace_externo: "id",
        descripcion:
          "Vincula el artículo con su familia correspondiente, permitiendo agrupar y filtrar artículos por familia.",
      },

    },
    ejemplos: {
      consulta_proveedor:
        "Un artículo con id '00000042' y AR_DENO 'TOMATE RIO GRANDE( PERA RASTRERO)' tiene AR_PRV '00040'. Esto significa que el proveedor con id '00040' en la tabla 'proveedores' es el encargado de proveer este artículo.",
      consulta_grupo_familia:
        "Se puede filtrar o agrupar artículos por su código de grupo (AR_GRP) o familia (AR_FAM).",
      consulta_barra:
        "Buscar un artículo por su código de barras utilizando el campo AR_BAR.",
    },
  },


  /* ================================================*/
  /* Archivos – Generales – Clientes */
  /* ================================================*/
  clientes: {
    alias: "Clientes",
    descripcion: "Información de clientes activos",
    tabla: "clientes",
    columnas: {
      CL_DENO: "Nombre del cliente",
      CL_DOM: "Dirección",
      CL_POB: "Población",
      CL_PROV: "Provincia",
      CL_CDP: "Código postal",
      CL_TEL: "Teléfono",
      CL_CIF: "CIF",
      CL_PAIS: "País",
      CL_ZONA: "Zona al que pertenece el cliente",
      CL_TARI: "Tarifa de precios asociada al cliente",
      CL_FPAG: "Forma de pago asociada al cliente",
    },
    relaciones: {
      almacenes: {    
        tabla_relacionada: "zonas",
        tipo: "Muchos a uno (varios clientes pueden pertenecer a la misma zona de almacén)",
        campo_enlace_local: "CL_ZONA",
        campo_enlace_externo: "id",
        descripcion:
          "Vincula el cliente con la zonaa la que pertenece, permitiendo agrupar y filtrar clientes por su zona",
      },
    }

  },



/* ================================================*/
/* Archivos – Generales – Familias y Grupos */
/* ================================================*/
familias: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Catálogo de familias y grupos, incluyendo su denominación, nombre en latín y porcentaje de germinación. Permite registrar observaciones sobre cambios o notas relevantes para cada familia.",
    tabla: `familias`, // Nombre de la tabla principal
    columnas: {
      id: "Código único de la familia (Clave Primaria)",
      FM_DENO: "Nombre del Grupo/Familia.",
      FM_LAT: "Nombre en Latín.",
      FM_PGER: "Porcentaje de germinación.",
    },
    relaciones: {
      familias_fm_obs: {
        tabla_relacionada: "familias_fm_obs",
        tipo: "Uno a muchos (una familia puede tener múltiples observaciones)",
        campo_enlace_local: "id", // ID de la familia
        campo_enlace_externo: "id", // ID de la familia en la tabla de observaciones
        descripcion: "Tabla de observaciones para cada familia, registrando cambios o notas relevantes.",
        estructura_relacionada: {
          id: "ID de la familia.",
          id2: "Identificador secuencial de la observación.",
          C0: "Contenido de la observación.",
        },
      },
    },
    ejemplos: {
      consulta_familia_por_id:
        "Obtener la denominación, nombre en latín y porcentaje de germinación de una familia específica usando su 'id'.",
      listar_todas_familias:
        "Listar todas las familias y grupos registrados.",
      consultar_observaciones_familia:
        "Para una familia específica (usando su id), consultar la tabla 'familias_fm_obs' para ver todas las observaciones registradas sobre ella.",
      buscar_familia_por_nombre:
        "Buscar una familia por su denominación (FM_DENO) o nombre en latín (FM_LAT).",
    },
  },

  /* ================================================*/
  /* Archivos – Generales – Formas de pago/cobro */
  /* ================================================*/
  fpago: {
    // Usamos fpago como clave, ya que es la tabla principal descrita
    descripcion:
      "Define y gestiona las formas de pago y cobro utilizadas en transacciones comerciales. Actúa como un catálogo maestro para estandarizar operaciones financieras, vincular transacciones y gestionar vencimientos.",
    tabla: "fpago", // Nombre de tabla original
    alias: "Formas de pago/cobro",
    columnas: {
      id: "Código único de la forma de pago/cobro (Clave Primaria)",
      FP_DENO: "Denominación o descripción de la forma de pago (ej: 'RECIBO 90 DIAS F.F.')",
      FP_NVT: "Número de vencimientos asociados",
      FP_CART: "Indica si se gestiona en cartera de cobros/pagos",
      FP_RW: "Referencia relacionada con la web (propósito no especificado)",
    },
    relaciones: {
      // Esta tabla es referenciada por muchas otras tablas en relaciones Muchos a Uno (varias transacciones usan la misma forma de pago).
      // Es clave foránea en tablas de Ventas, Compras, Cobros, Pagos, etc.
      // Ejemplos de tablas que la referencian (a través de campos como ENG_FP, AC_FP, PP_FP, FR_FP, AV_FP, CB_FP, PG_FP que apuntan a fpago.id):
      // Ventas - Encargos de siembra
      // Compras - Albarenes compra
      // Compras - Pedidos a Proveedor
      // Compras - Registro de Facturas Recibidas
      // Ornamental - Ventas - Albaran Venta Ornamental
      // Cobros - Cartera de cobros
      // Pagos - Cartera de pagos
      referenciada_por: {
        tablas: [
          "Encargos de siembra",
          "Albarenes compra",
          "Pedidos a Proveedor",
          "Registro de Facturas Recibidas",
          "Albaran Venta Ornamental",
          "Cartera de cobros",
          "Cartera de pagos",
        ],
        tipo: "Uno a muchos (una forma de pago puede estar en muchos registros de otras tablas)",
        campo_enlace_externo: "id",
        campo_enlace_local_ejemplos: ["*_FP"], // Patrón típico de nombres de campos en tablas que referencian a fpago
        descripcion:
          "Esta tabla es referenciada por numerosas tablas de transacciones y documentos para especificar la forma de pago/cobro utilizada.",
      },
    },
    ejemplos: {
      consulta_fpago_por_id: "Obtener los detalles de una forma de pago/cobro específica usando su 'id'.",
      consulta_fpago_por_denominacion: "Buscar una forma de pago/cobro por su denominación (FP_DENO).",
      consultar_transacciones_por_fpago:
        "Listar todas las transacciones (pedidos, facturas, etc.) que utilizan una forma de pago específica (requiere consultar las tablas que referencian a fpago).",
    },
  },

  /* ================================================*/
  /* Archivos – Generales – Nuestros bancos */
  /* ================================================*/
  bancos: {
    // Usamos el nombre de la tabla principal, que es la misma
    descripcion:
      "Gestión centralizada de información de las entidades bancarias con las que opera Semilleros Deitana ('Nuestros bancos'). Sirve para la correcta ejecución de operaciones financieras, pagos y cobros.",
    tabla: "bancos",
    alias: "Nuestros bancos",
    columnas: {
      id: "Código único del banco (Clave Primaria)",
      BA_DENO: "Denominación o nombre del banco",
      BA_DOM: "Domicilio del banco",
      BA_POB: "Población del banco",
      BA_PROV: "Provincia del banco",
      BA_CDP: "Código postal del banco",
      BA_TEL: "Número(s) de teléfono del banco",
      BA_FAX: "Número de FAX del banco",
      BA_EMA: "Dirección de correo electrónico del banco",
      BA_IBAN: "Número de cuenta bancaria en formato IBAN",
      BA_COD: "Código de la entidad bancaria",
      BA_OFI: "Código de la oficina bancaria",
      BA_CUEN: "Número de cuenta bancaria tradicional",
      BA_SWI: "Código SWIFT/BIC",
      BA_RIES: "Nivel de riesgo interno",
      BA_TIPO: "Tipo de banco (clasificación interna)",
      BA_OBS: "Observaciones o comentarios internos",
      // Nota: También se pueden registrar Contactos bancarios (Contacto, Cargo, Teléfono, Email) asociados a cada entidad, aunque no están detallados como campos directos aquí.
    },
    relaciones: {
      // No se especifican relaciones explícitas con otras tablas en el texto proporcionado.
    },
    ejemplos: {
      consulta_filtrada:
        "Buscar bancos por denominación (BA_DENO), código postal (BA_CDP) o código SWIFT (BA_SWI).",
      consulta_completa:
        "Obtener todos los datos cargados (BA_DENO, BA_DOM, BA_IBAN, BA_SWI, etc.) de un banco específico. Si un campo no tiene información, se indicará (ej: 'Código SWIFT: No hay información disponible').",
      consulta_contactos:
        "Consultar la información de los contactos bancarios asociados a una entidad (Contacto, Cargo, Teléfono, Email).",
    },
  },

  /* ================================================*/
  /* Archivos – Generales – Proveedores */
  /* ================================================*/
  proveedores: {
    descripcion:
      "La tabla 'proveedores' dentro del sistema ERP centraliza la información detallada de todos los proveedores con los que opera Semilleros Deitana. Cada registro representa un proveedor único, identificado mediante un código (id). Esta tabla almacena datos cruciales que abarcan información fiscal, detalles de contacto, datos bancarios y aspectos administrativos, incluyendo domicilio, provincia, CIF, y registros de la última compra, entre otros. Disponer de esta información completa y organizada es esencial para la gestión eficiente de la cadena de suministro y las relaciones con los proveedores.",
    tabla: "proveedores",
    columnas: {
      id: "Código único que identifica a cada proveedor",
      PR_DENO: "Nombre del proveedor",
      PR_DOM: "Domicilio del proveedor",
      PR_POB: "Población",
      PR_PROV: "Provincia",
      PR_CDP: "Código postal del proveedor",
      PR_TEL: "Número(s) de teléfono del proveedor",
      PR_FAX: "Número de FAX del proveedor",
      PR_CIF: "Código de Identificación Fiscal (CIF) del proveedor",
      PR_EMA: "Dirección de correo electrónico del proveedor",
      PR_WEB: "Dirección de la página web del proveedor",
      PR_DOMEN: "Domicilio o detalles para el envío de facturas",
      PR_PAIS: "País de residencia del proveedor",
      PR_FPG: "Forma de pago preferida del proveedor tiene relacion con la tabla referencia a la tabla fpago",
      PR_IBAN: "Número de cuenta bancaria en formato IBAN del proveedor",
      // Nota sobre campos vacíos: Si un campo no tiene información, se asume 'No hay información disponible'.
    },
    relaciones: {
      fpago: {
        tabla_relacionada: "fpago",
        tipo: "Muchos a uno (varios proveedores pueden tener la misma forma de pago preferida)",
        campo_enlace_local: "PR_FPG",
        campo_enlace_externo: "id",
        descripcion:
          "Vincula el proveedor con su forma de pago preferida, permitiendo identificar cómo se gestionan los pagos a cada proveedor.",
      },
    },
    ejemplos: {
      consulta_provincia:
        "Para encontrar proveedores ubicados en la provincia de 'Almeria', se consultaría la tabla proveedores filtrando por el campo PR_PROV con el valor 'ALMERIA'.",
      consulta_email:
        "Si se buscan proveedores con un correo electrónico registrado, se verificaría la existencia de un valor en el campo PR_EMA.",
      consulta_completa:
        "Al solicitar la información completa de un proveedor, se proporcionarían los datos cargados en los campos correspondientes (PR_DENO, PR_DOM, PR_POB, etc.)",
    },
  },

  /* ================================================*/
  /* Archivos – Generales – Vendedores/Usuarios */
  /* ================================================*/
  vendedores: {
    descripcion:
      "La tabla 'vendedores'  del sistema ERP de Semilleros Deitana constituye el repositorio centralizado para la gestión de la información de los usuarios internos que desempeñan funciones de venta o que simplemente tienen acceso al sistema como usuarios.",
    tabla: "vendedores",
    columnas: {
      id: "Código único que identifica a cada vendedor/usuario",
      VD_DENO: "Denominación o nombre completo del vendedor/usuario",
      VD_DOM: "Domicilio del vendedor/usuario",
      VD_POB: "Población de residencia",
      VD_PROV: "Provincia de residencia",
      VD_PDA: "Número técnico asociado (clave foránea a tabla tecnicos)",
    },
    ejemplos: {
      consulta_nombre:
        "Para buscar un vendedor por nombre, se consultaría el campo VD_DENO",
      consulta_ubicacion:
        "Se puede filtrar por población (VD_POB) o provincia (VD_PROV)",
      consulta_completa:
        "Si se solicita la información completa de un vendedor, se proporcionarán los datos cargados en los campos correspondientes (VD_DENO, VD_DOM, VD_POB, etc.)",
    },
  },

   /* ==============================================================================================================================================*/

  /* ================================================*/
  /* Archivos – Auxiliares – Bandejas */
  /* ================================================*/
  bandejas: {
    descripcion:
      "La tabla 'bandejas' dentro del sistema ERP contiene un listado exhaustivo y detallado de las características técnicas y económicas asociadas a los diferentes tipos de bandejas (ya sean físicas, reutilizables o desechables) que se emplean en los procesos de siembra y cultivo en alvéolos. Es importante notar que esta sección también puede incluir información relativa a macetas u otros contenedores utilizados en estos procesos.",
    tabla: "bandejas",
    columnas: {
      id: "Identificador único asignado a cada bandeja.", // Clave Primaria
      BN_DENO: "Nombre descriptivo que identifica la bandeja",
      BN_ALV: "Número total de alvéolos",
      BN_RET: "Reutilizable",
      BN_PVP: "Precio de venta de la bandeja",
      BN_COS: "Coste",
      BN_IVA1: "Información IVA 1",
      BN_IVA2: "Información IVA 2",
      BN_ART: "Identificador del artículo asociado (referencia a la tabla 'articulos')",
      BN_ALVC: "Número de alvéolos a cobrar.",
      BN_ALVG: "Número de alvéolos a germinar.",
      
    },
    relaciones: {
      articulos: {  
        tabla_relacionada: "articulos",
        tipo: "Muchos a uno (varias bandejas pueden estar asociadas al mismo artículo)",
        campo_enlace_local: "BN_ART",
        campo_enlace_externo: "id",
        descripcion:
          "Vincula la bandeja con el artículo correspondiente, permitiendo identificar qué artículo utiliza esa bandeja en particular.",
      },
    },
    ejemplos: {
      // El texto proporcionado no incluye ejemplos de consultas o uso específicos de la tabla 'bandejas'.
      // Los ejemplos dados son valores de ejemplo para campos específicos.
    },
  },
  /* ================================================*/
  /* Archivos – Auxiliares – Calendarios */
  /* ================================================*/



  /* ================================================*/
  /* Archivos – Auxiliares – Casas comerciales */
  /* ================================================*/
  casas_com: {
    // Usamos el nombre de la tabla como clave principal
    descripcion:
      "Gestión y almacenamiento de información de las casas comerciales con las que Semilleros Deitana interactúa. Es fundamental para mantener un registro organizado de socios comerciales y sus datos clave.",
    tabla: "casas_com",
    columnas: {
      id: "Identificador único de la casa comercial (Clave Primaria)",
      CC_DENO: "Denominación social legal",
      CC_NOM: "Nombre comercial",
      CC_DOM: "Domicilio físico",
      CC_POB: "Población",
      CC_PROV: "Provincia",
      CC_CDP: "Código Postal",
      CC_TEL: "Número de teléfono",
      CC_FAX: "Número de fax",
      CC_CIF: "Código de Identificación Fiscal (CIF)",
      CC_EMA: "Dirección de correo electrónico",
      CC_WEB: "Dirección del sitio web",
      CC_PAIS: "País de ubicación",
     
      // Nota sobre datos: La completitud de CC_DOM, CC_TEL, CC_FAX, CC_CIF, CC_EMA, CC_WEB, CC_DFEC, CC_HFEC puede variar (pueden ser NULL o vacíos).
    },
    relaciones: {
      // No se especifican relaciones explícitas con otras tablas en el texto proporcionado.
    },
    ejemplos: {
      // El texto proporcionado no incluye ejemplos de consultas o uso específicos de la tabla 'casas_comerciales'.
      // Se menciona la variabilidad de los datos en ciertos campos.
    },
  },

  /* ================================================*/
  /* Archivos – Auxiliares – Categorias */
  /* ================================================*/
  categorias: {
    descripcion:
      "Define las categorías laborales utilizadas en Semilleros Deitana para establecer condiciones contractuales y económicas de los trabajadores (salario, horarios, costes). No son categorías de producto.",
    tabla: "categorias",
    columnas: {
      id: "Identificador único de la categoría laboral (Clave Primaria)",
      CG_DENO: "Nombre o denominación de la categoría laboral (Ej: PRODUCCION, ENCARGADO)",
      CG_SALDIA: "Salario diario base para esta categoría (Tipo: DECIMAL)",
      CG_COSHOR: "Coste calculado por hora de trabajo normal (Tipo: DECIMAL)",
      CG_SDIA: "Coste calculado por hora extra (Tipo: DECIMAL). Nota: Aunque el nombre sugiere 'Salario Día', representa el coste por hora extra según la descripción.",
    },
    relaciones: {
      // No se especifican relaciones explícitas con otras tablas en el texto proporcionado (ej: con empleados).
    },
    ejemplos: {
      // El texto proporcionado no incluye ejemplos de consultas o uso específicos de la tabla 'categorias'.
      // Los ejemplos dados son valores de ejemplo para campos específicos.
    },
  },

  /* ================================================*/
  /* Archivos – Auxiliares – Clasificacón Cli */
  /* ================================================*/

  /* ================================================*/
  /* Archivos – Auxiliares – Codigo Postal */
  /* ================================================*/

  /* ================================================*/
  /* Archivos – Auxiliares – Conceptos incidencias */
  /* ================================================*/

  /* ================================================*/
  /* Archivos – Auxiliares – Créditos caución */
  /* ================================================*/
  creditocau: {
    descripcion:
      "Gestión y seguimiento de seguros de crédito (créditos caución) asociados a clientes para proteger frente al riesgo de impago. Permite registrar y consultar pólizas o acuerdos de seguro de crédito específicos.",
    tabla: "creditocau",
    columnas: {
      id: "Identificador único del crédito caución (Clave Primaria)",
      CAU_CCL: "Código del cliente asociado. Clave foránea a la tabla 'clientes'.",
      CAU_DIAS: "Número máximo de días de crédito permitidos (Tipo: INT).",
      CAU_TIPO: "Tipo de crédito caución ('N': No asegurado, 'A': Asegurado).",
    },
    relaciones: {
      clientes: {
        tabla_relacionada: "clientes",
        tipo: "Muchos a uno (varios créditos caución para un cliente)",
        campo_enlace_local: "CAU_CCL",
        campo_enlace_externo: "id",
        descripcion:
          "Vincula el crédito caución con la información detallada del cliente correspondiente.",
      },
      creditocau_cau_obs: {
        tabla_relacionada: "creditocau_cau_obs",
        tipo: "Uno a muchos (un crédito caución puede tener varias observaciones)",
        campo_enlace_local: "id", // El id del crédito caución
        campo_enlace_externo: "id", // El campo id en creditocau_cau_obs que referencia al crédito caución
        descripcion:
          "Almacena observaciones o seguimientos. Las observaciones completas para un crédito caución se reconstruyen concatenando el campo 'C0' de los registros vinculados por 'id'.",
      },
    },
    ejemplos: {
      consulta_cliente:
        "Para obtener información del cliente asociado a un crédito caución, usar el campo CAU_CCL del registro creditocau para consultar la tabla 'clientes' por su 'id'.",
      consulta_observaciones:
        "Para ver las observaciones de un crédito caución, consultar la tabla 'creditocau_cau_obs' usando el 'id' del crédito caución y concatenar el contenido del campo 'C0' de los resultados.",
      consulta_tipo_dias:
        "Se puede filtrar o consultar créditos caución por el número de días (CAU_DIAS) o el tipo de cobertura (CAU_TIPO).",
    },
  },

  /* ================================================*/
  /* Archivos – Auxiliares – Delegaciones */
  /* ================================================*/
  almacenes: {
    // Usamos almacenes como clave, ya que es la tabla principal descrita
    descripcion:
      "Representa las delegaciones o almacenes físicos y operativos de la empresa. Sirve como referencia para identificar la ubicación asociada a una acción en el ERP y vincular recursos financieros por defecto.",
    tabla: "almacenes", // Nombre de tabla original
    columnas: {
      id: "Código único de la delegación o almacén (Clave Primaria)",
      AM_DENO: "Denominación o nombre de la delegación/almacén (Ej: 'GARDEN')",
      AM_CAJA:
        "Denominación de la 'Caja Almacen / Sucursal Efectivo' por defecto. Se relaciona con 'bancos' (id) para obtener la denominación (BA_DENO).", // Descripción basada estrictamente en el texto provisto
      AM_BCO:
        "Denominación del 'Banco Cobros / Pagos Defectos' por defecto. Se relaciona con 'bancos' (id) para obtener la denominación (BA_DENO).", // Descripción basada estrictamente en el texto provisto
    },
    relaciones: {
      bancos_caja_defecto: {
        tabla_relacionada: "bancos",
        tipo: "Muchos a uno (varios almacenes pueden usar la misma caja por defecto)", // Implícito
        campo_enlace_local: "AM_CAJA", // El campo local que contiene el ID del banco/caja
        campo_enlace_externo: "id", // El campo referenciado en la tabla bancos
        descripcion:
          "Vincula la delegación/almacén con la caja de efectivo por defecto, obteniendo su denominación desde la tabla 'bancos'.", // Adaptado a la descripción del texto
      },
      bancos_banco_defecto: {
        tabla_relacionada: "bancos",
        tipo: "Muchos a uno (varios almacenes pueden usar el mismo banco por defecto)", // Implícito
        campo_enlace_local: "AM_BCO", // El campo local que contiene el ID del banco
        campo_enlace_externo: "id", // El campo referenciado en la tabla bancos
        descripcion:
          "Vincula la delegación/almacén con el banco por defecto para cobros/pagos, obteniendo su denominación desde la tabla 'bancos'.", // Adaptado a la descripción del texto
      },
      // En esta versión de la descripción, no se menciona explícitamente que otras tablas referencien a 'almacenes'.
    },
    ejemplos: {
      consulta_almacen_por_id: "Obtener los detalles de una delegación/almacén específico usando su 'id'.",
      consulta_almacen_por_denominacion:
        "Buscar una delegación/almacén por su denominación (AM_DENO).",
      consultar_bancos_defecto:
        "Para una delegación/almacén, usar AM_CAJA y AM_BCO para consultar la tabla 'bancos' y obtener los nombres de la caja y el banco por defecto asociados.",
    },
  },

  /* ================================================*/
  /* Archivos – Auxiliares – Dispositivos móviles */
  /* ================================================*/
  dispositivos: {
    descripcion:
      "Gestión centralizada de dispositivos móviles (PDAs u otros terminales portátiles) utilizados en Semilleros Deitana...",
    columnas: {
      id: "Código único del dispositivo móvil (Clave Primaria)",
      DIS_DENO: "Denominación o nombre descriptivo del dispositivo",
      DIS_MARCA: "Marca comercial del dispositivo",
      DIS_MOD: "Modelo técnico del dispositivo",
      DIS_FCOM: "Fecha de adquisición (Puede ser NULL)",
      DIS_MAC: "Dirección MAC del dispositivo",
      DIS_IP: "Dirección IP asignada al dispositivo",
      DIS_KEY: "Clave o identificador de seguridad",
      DIS_BAJA: "Estado operativo (0: Activo, 1: Dado de baja)",
    },
    relaciones: {
      tablaDestino: "dispositivos_dis_obs",
      campoOrigen: "id",
      campoDestino: "id",
      tipo: "uno-a-muchos",
      uso: "Para obtener las observaciones asociadas a los dispositivos",
    },
    ejemplos: {
      consulta_basica:
        "Obtener información principal de un dispositivo directamente de la tabla 'dispositivos' usando su 'id'.",
      consulta_observaciones:
        "Para ver las observaciones de un dispositivo, consultar 'dispositivos_dis_obs' usando el 'id' del dispositivo. Concatenar 'C0' de las filas resultantes. Nota: No todos los dispositivos pueden tener observaciones.",
      consulta_estado: "Filtrar dispositivos por su estado operativo (DIS_BAJA).",
    },
  },

  /* ================================================*/
  /* Archivos – Auxiliares – Envases de venta */
  /* ================================================*/
  envases_vta: {
    descripcion:
      "Cataloga los diferentes tipos de envases y formatos utilizados para la comercialización de semillas y productos, detallando características físicas y comerciales.",
    tabla: "envases_vta",
    columnas: {
      id: "Identificador único del envase de venta (Clave Primaria)",
      EV_DENO: "Denominación o nombre del envase (Ej: Sobre pequeño, Bolsa 1 Kg)",
      EV_NEM: "Unidad de medida del envase (Ej: UD, SB, L, KG)",
      EV_CANT: "Cantidad total contenida en el envase",
      EV_UDSS: "Número de unidades por presentación o sobre, si aplica",
    },
    relaciones: {
      // No se especifican relaciones explícitas con otras tablas en el texto proporcionado (ej: con artículos).
    },
    ejemplos: {
      consulta_denominacion: "Buscar envases por su denominación (EV_DENO).",
      consulta_contenido: "Consultar la cantidad total (EV_CANT) y la unidad de medida (EV_NEM) de un envase.",
      consulta_presentacion: "Obtener el número de unidades por presentación (EV_UDSS) si aplica para un envase específico.",
    },
  },

  /* ================================================*/
  /* Archivos – Auxiliares – Fincas Clientes */
  /* ================================================*/


alm_clientes: {
  descripcion:
    "Gestiona el registro de las fincas o ubicaciones de los clientes, detallando la información de contacto y su ubicación geográfica. Es una herramienta clave para la organización y la logística.",
  tabla: `alm-clientes`, // Nombre de la tabla principal
  columnas: {
    id: "Identificador único de la finca del cliente (Clave Primaria).",
    AL_DENO: "Nombre o denominación de la finca.",
    AL_CCL: "Código del cliente asociado a la finca. Clave foránea a la tabla 'clientes' para obtener la denominación (CL_DENO).",
    AL_TEL: "Número de teléfono de la finca.",
    AL_FAX: "Número de fax de la finca.",
    AL_EMA: "Dirección de correo electrónico de la finca.",
    AL_CON: "Nombre de la persona de contacto en la finca.",
    AL_DOM: "Domicilio o dirección física de la finca.",
    AL_POB: "Población o localidad de la finca.",
    AL_PAIS: "País de la finca.",
    AL_ZONA: "Código de la zona geográfica de la finca. Clave foránea a la tabla 'zonas' para obtener la denominación (ZN_DENO).",
    AL_CLF: "Nombre del cliente final.",
    AL_PROV: "Provincia de la finca.",
  },
  relaciones: {
    clientes: {
      tabla_relacionada: "clientes",
      tipo: "Muchos a uno",
      campo_enlace_local: "AL_CCL",
      campo_enlace_externo: "id", // Suponiendo 'id' es la clave primaria de 'clientes'
      descripcion: "Vincula la finca con la información principal del cliente propietario.",
    },
    zonas: {
      tabla_relacionada: "zonas",
      tipo: "Muchos a uno",
      campo_enlace_local: "AL_ZONA",
      campo_enlace_externo: "id", // Suponiendo 'id' es la clave primaria de 'zonas'
      descripcion: "Vincula la finca con la zona geográfica correspondiente.",
    },
  },
  ejemplos: {
    consulta_finca_por_id:
      "Obtener todos los datos de una finca de cliente específica usando su 'id'.",
    consultar_datos_contacto:
      "Para una finca, obtener su nombre ('AL_DENO'), teléfono ('AL_TEL'), email ('AL_EMA') y persona de contacto ('AL_CON').",
    filtrar_fincas_por_cliente_o_zona:
      "Listar todas las fincas de un cliente en particular (filtrando por 'AL_CCL') o agrupar las fincas por zona geográfica ('AL_ZONA').",
    analisis_geografico:
      "Identificar la distribución de las fincas de los clientes por población, provincia o país ('AL_POB', 'AL_PROV', 'AL_PAIS').",
    buscar_cliente_final:
      "Buscar fincas según el nombre del cliente final ('AL_CLF').",
  },
},

 /* ================================================*/
  /* Archivos – Auxiliares – Incidencias Fras */
  /* ================================================*/

  /* ================================================*/
  /* Archivos - Auxiliares - Invernaderos */
  /* ================================================*/
  invernaderos: {
    descripcion:
      "Contiene la información base de las estructuras físicas de invernaderos, utilizadas para siembra y cultivo. Incluye identificación, vinculación a almacenes, secciones y filas. Nota: Existen otras tablas relacionadas (secciones, filas, tratamientos) no detalladas aquí.",
    tabla: "invernaderos",
    columnas: {
      id: "Identificador único del invernadero (Clave Primaria)",
      INV_DENO: "Denominación o nombre completo del invernadero (Ej: A4 Pg.28-Parcela.1000)",
      INV_ALM: "Código del almacén asociado o vinculado a este invernadero.", // Clave foránea a la tabla 'almacenes'
      INV_NSECI: "Número de secciones inicial o de referencia",
      INV_NSEC: "Número total de secciones",
      INV_NFIL: "Número total de filas",
      INV_EXLT: "Secciones excluidas de tratamientos"
    },
    relaciones: {
      almacenes: {
        tabla_relacionada: "almacenes",
        tipo: "Muchos a uno (varios invernaderos pueden estar en un almacén)", // Inferred type
        campo_enlace_local: "INV_ALM",
        campo_enlace_externo: "id",
        descripcion:
          "Vincula el invernadero con el almacén asociado. La tabla 'almacenes' tiene campos como 'id' (código del almacén) y 'AM_DENO' (nombre del almacén).",
      },
      
      // Otras relaciones con secciones, filas, tratamientos, etc., existen pero no están detalladas.
    },
    ejemplos: {
      consulta_almacen_asociado:
        "Para obtener el nombre del almacén asociado a un invernadero, usar el campo INV_ALM del invernadero para consultar el campo 'id' en la tabla 'almacenes' y obtener su AM_DENO.",
      consulta_basica:
        "Obtener la identificación (id, INV_DENO), número de secciones (INV_NSEC) o filas (INV_NFIL) de un invernadero específico.",
    },
  },

  /* ================================================*/
  /* Archivos - Auxiliares - Motivos */
  /* ================================================*/
  motivos: {
    descripcion:
      "Catálogo estandarizado de causas o razones predefinidas utilizadas para documentar y clasificar eventos, acciones o situaciones internas (Ej: plagas, descartes, incidencias).",
    tabla: "motivos",
    columnas: {
      id: "Código único del motivo (Clave Primaria)",
      MOT_DENO: "Denominación o descripción del motivo (Ej: PLAGA, DESCARTE)",
    },
    relaciones: {
      // No se especifican relaciones explícitas en el texto, pero esta tabla es likely referenciada por otras tablas de eventos o incidencias.
    },
    ejemplos: {
      listar_motivos:
        "Obtener el listado de motivos, combinando el código (id) y la descripción (MOT_DENO) para presentación (Ej: '0001 - PLAGA').",
      clasificar_evento:
        "Utilizar el 'id' o 'MOT_DENO' de esta tabla para clasificar un evento registrado en otro lugar del sistema.",
    },
  },

  /* ================================================*/
  /* Archivos - Auxiliares - Paises */
  /* ================================================*/
  paises: {
    descripcion:
      "Catálogo maestro de referencia con el listado de países relevantes para la actividad comercial y productiva de la empresa (origen/destino productos, ubicación clientes/proveedores). Diseñada para servir como soporte a otras tablas.",
    tabla: "paises",
    columnas: {
      id: "Código único del país (Clave Primaria)",
      PA_DENO: "Denominación o nombre completo del país (Ej: FRANCIA, ESPAÑA)",
    },
    relaciones: {
      // No se especifican relaciones explícitas documentadas que referencien a 'paises' desde otras tablas en este contexto.
      // Sin embargo, se infieren relaciones potenciales (donde 'paises.id' sería clave foránea en otras tablas) con:
      // clientes: Para país de residencia o ubicación.
      // proveedores: Para país de origen o sede.
      // Registros de producción/exportación: Para país de destino de productos.
      // Información de semillas/variedades: Para país de origen o procedencia.
    },
    ejemplos: {
      listar_paises: "Obtener el listado de todos los países registrados (id y PA_DENO).",
      // Ejemplos de uso potencial en combinación con otras tablas (si las relaciones se confirman):
      // consultar_clientes_por_pais: "Encontrar clientes ubicados en un país específico (requiere relación con tabla 'clientes').",
      // consultar_proveedores_por_pais: "Listar proveedores de un país determinado (requiere relación con tabla 'proveedores')."
    },
  },

  /* ================================================*/
  /* Archivos - Auxiliares - Procesos */
  /* ================================================*/
  procesos: {
    descripcion:
      "Define las etapas o procedimientos del ciclo productivo agrícola (semillero), como germinación o trasplante. Contiene campos que controlan la lógica interna del ERP para estas etapas.",
    tabla: "procesos",
    columnas: {
      id: "Código único del proceso (Clave Primaria)",
      PRO_DENO: "Denominación o nombre del proceso (Ej: GERMINACIÓN)",
      PRO_MGER: "¿Modifica germinación? ('S' o '')",
      PRO_MBAN: "¿Modifica bandejas? ('S' o '')",
      PRO_MSOP: "¿Modifica soporte? ('S' o '')",
      PRO_CDIF: "¿Calcular por diferencia? ('S' o '')",
      PRO_NOUBI: "¿Permitir sin ubicación? ('S' o '')",
      PRO_NEM: "Nemotécnico (abreviatura del proceso)",
      PRO_SEMB: "¿Es parte del proceso de siembra?",
      PRO_IDIAS: "Porcentaje o cantidad de días estimados de siembra",
      PRO_OBS: "Campo OBSOLETO para observaciones. Las observaciones se almacenan en una tabla separada (procesos_pro_obs).",
      // Otros campos internos no detallados...
    },
    relaciones: {
      procesos_pro_obs: {
        tabla_relacionada: "procesos_pro_obs",
        tipo: "Uno a muchos (un proceso puede tener varias observaciones)",
        campo_enlace_local: "id", // El id del proceso
        campo_enlace_externo: "id", // El campo id en procesos_pro_obs que referencia al proceso
        descripcion:
          "Almacena observaciones adicionales para los procesos. Las observaciones completas se reconstruyen concatenando el campo 'C0' de las filas vinculadas por 'id', ordenadas por 'id2'.",
        estructura_relacionada: {
          // Estructura de la tabla relacionada para referencia
          id: "ID del proceso asociado",
          id2: "Línea u orden de la observación",
          C0: "Texto de la observación",
        },
      },
      // Relaciones potenciales inferidas de la interfaz (pestañas como General, Ornamental, Producción, Consumos, Incremento de días).
      // Es probable que existan relaciones con tablas de producción (produccion_*), consumos (consumos_*), tratamientos (p-tratamientos), siembras (p-siembras), inventario o invernaderos.
    },
    ejemplos: {
      consulta_procesos: "Listar todos los procesos registrados (id, PRO_DENO, etc.).",
      consulta_procesos_por_logica:
        "Filtrar procesos por su configuración (Ej: ¿Modifican bandejas? PRO_MBAN = 'S', ¿Permiten sin ubicación? PRO_NOUBI = 'S').",
      consulta_observaciones:
        "Buscar observaciones para un proceso específico usando su 'id' en la tabla 'procesos_pro_obs' y reconstruir el texto completo desde el campo 'C0'. Nota: No todos los procesos tienen observaciones.",
      consulta_siembra: "Identificar procesos que son parte de la siembra (PRO_SEMB).",
    },
  },

  /* ================================================*/
  /* Archivos – Auxiliares – Productos Fitosanitarios */
  /* ================================================*/
  tipo_trat: {
    descripcion:
      "Gestión y registro detallado de productos fitosanitarios para tratamientos agronómicos (prevención, control de plagas/enfermedades). Centraliza información técnica y de uso para aplicación segura y trazabilidad.",
    tabla: "tipo_trat",
    alias: "Productos Fitosanitarios",
    columnas: {
      id: "Identificador único del producto fitosanitario (Clave Primaria)",
      TTR_NOM: "Nombre comercial del producto (Ej: PREVICUR ENERGY)",
      TTR_DOS: "Dosis estándar o recomendada (Ej: 0,2-0,3 %)",
      TTR_FOR: "Fórmula o principio(s) activo(s)",
      TTR_ENS: "Campo auxiliar (Información incierta, puede estar vacío)", // Nota sobre validación/significado
      TTR_ECO: "Indica si es ecológico ('S'/'N')",
      TTR_BIO: "Indica si es de origen biológico ('S'/'N')",
      TTR_ESP: "Especies vegetales autorizadas o recomendadas (Ej: CALABACÍN - MELÓN)",
      TTR_AGN: "Agentes nocivos que combate (Ej: FITOPHTHORA - PITIUM)",
      TTR_INT: "Enlace web (ficha técnica, registro, etc.)",
      TTR_REG: "Número de registro oficial",
      TTR_FCAD: "Fecha de caducidad",
    },
    relaciones: {
      // No se especifican relaciones explícitas con otras tablas en el texto proporcionado (ej: con tratamientos aplicados).
    },
    ejemplos: {
      consulta_producto_por_nombre_id:
        "Buscar un producto fitosanitario por su id o TTR_NOM para obtener sus detalles técnicos y de uso.",
      listar_productos_por_tipo:
        "Filtrar productos fitosanitarios que son ecológicos (TTR_ECO='S') o biológicos (TTR_BIO='S').",
      consultar_aplicabilidad:
        "Verificar las especies (TTR_ESPE) o agentes (TTR_AGN) para los que un producto está autorizado.",
    },
  },

/* ================================================*/
/* Archivos – Auxiliares – Rutas */
/* ================================================*/
rutas: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Define las rutas, incluyendo su código, nombre y el artículo asociado, que generalmente representa un servicio de transporte.",
    tabla: `rutas`, // Nombre de la tabla principal
    columnas: {
      id: "Código único de la ruta (Clave Primaria)",
      RU_DENO: "Nombre de la ruta.",
      RU_CDAR: "Artículo asociado a la ruta. Clave foránea a la tabla 'articulos' para obtener la denominación (AR_DENO), que suele ser un servicio de transporte.",
    },
    relaciones: {
      articulos: {
        tabla_relacionada: "articulos",
        tipo: "Muchos a uno",
        campo_enlace_local: "RU_CDAR",
        campo_enlace_externo: "id",
        descripcion: "Vincula la ruta con el artículo que representa su servicio asociado (ej. servicio de transporte).",
      },
    },
    ejemplos: {
      consulta_ruta_por_id:
        "Obtener el nombre y el artículo asociado a una ruta específica usando su 'id'.",
      listar_todas_rutas:
        "Listar todas las rutas definidas en el sistema.",
      buscar_ruta_por_nombre:
        "Buscar una ruta por su nombre (filtrando por RU_DENO).",
      consultar_articulo_de_ruta:
        "Para una ruta, obtener la denominación del artículo de servicio asociado (ej. 'N/SERVICIO DE TRANSPORTE').",
    },
  },


  /* ================================================*/
  /* Archivos – Auxiliares – Sección Tareas */
  /* ================================================*/
  tareas_seccion: {
    descripcion:
      "Catálogo de categorías o tipos de tareas operativas y administrativas (injertos, siembra, riegos, limpieza, etc.). Fundamental para clasificar y cuantificar mano de obra y actividades en partes de trabajo y reportes.",
    tabla: "tareas_seccion",
    columnas: {
      id: "Identificador único de la sección de tarea (Clave Primaria, también TARS_COD)",
      TARS_DENO: "Denominación o nombre de la sección de tarea (Ej: INJERTOS HACER, SIEMBRA)",
      TARS_UNDM: "Unidad de medida asociada a la tarea (Ej: 'Planta', 'Bandeja', o vacío para tareas sin unidad productiva). Indica cómo se cuantifica la tarea.",
    },
    relaciones: {
      // No se especifican relaciones explícitas en el texto, pero esta tabla es referenciada por tablas que registran actividades o partes de trabajo.
    },
    ejemplos: {
      consulta_seccion:
        "Buscar una sección de tarea por su id o TARS_DENO para obtener su unidad de medida (TARS_UNDM).",
      clasificacion_actividad:
        "Utilizar el id o TARS_DENO de esta tabla para clasificar una actividad registrada (ej: en un parte de trabajo).",
      consulta_unidad_medida:
        "Identificar la unidad de medida (TARS_UNDM) usada para cuantificar una tarea específica, como 'Bandeja' para 'SIEMBRA'.",
    },
  },

  /* ================================================*/
  /* Archivos – Auxiliares – Sectores y Subsectores */
  /* ================================================*/
  sectores: {
    descripcion:
      "Define clasificaciones de origen para pedidos y clientesCrucial para análisis segmentación y seguimiento por canal. Nota: Aunque la gestión directa no siempre es visible en el entorno de prueba, los datos existen y se usan para clasificación.",
    tabla: "sectores",
    columnas: {
      id: "Código único del sector o subsector (Clave Primaria)",
      SC_DENO: "Nombre o denominación del sector o subsector (Ej: SIN ASIGNAR, TIENDA, INTERNET, PROFESIONAL)",
    },
    relaciones: {
      // No se especifican relaciones explícitas documentadas que referencien a 'sectores' desde otras tablas en este contexto.
      // Se infiere que esta tabla es utilizada como clave foránea en tablas como 'clientes' y 'pedidos' para clasificar registros.
    },
    ejemplos: {
      listar_sectores:
        "Obtener el listado de todos los sectores/subsectores registrados (id y SC_DENO).",
      clasificar_registro:
        "Utilizar el id o SC_DENO de esta tabla para clasificar clientes, pedidos u otras transacciones.",
      // Ejemplos de uso potencial en combinación con otras tablas (si las relaciones se confirman):
      // analisis_por_sector: "Agrupar y analizar pedidos o clientes según su sector asignado (requiere relación con tablas correspondientes)."
    },
  },

  /* ================================================*/
  /* Archivos – Auxiliares – Series Facturacion */
  /* ================================================*/

  /* ================================================*/
  /* Archivos – Auxiliares – Situaciones */
  /* ================================================*/

  /* ================================================*/
  /* Archivos – Auxiliares – Sustratos */
  /* ================================================*/
  sustratos: {
    descripcion:
      "Gestión y registro de materiales o mezclas utilizados como medio de cultivo. Esencial para control de costes, precios y planificación de materiales en la producción.",
    tabla: "sustratos",
    columnas: {
      id: "Código único del sustrato (Clave Primaria, también SUS_COD)",
      SUS_DENO: "Denominación o nombre descriptivo del sustrato (Ej: PERLITA PELIGRAM, SUST.ESPECIAL)",
      SUS_PVP: "Precio de venta al público por alveolo (Tipo: DECIMAL)",
      SUS_COS: "Coste interno por alveolo (Tipo: DECIMAL)",
    },
    relaciones: {
      // No se especifican relaciones explícitas en el texto, pero esta tabla es referenciada por tablas relacionadas con producción o costos.
    },
    ejemplos: {
      consulta_sustrato:
        "Buscar un sustrato por su id o SUS_DENO para obtener su nombre, PVP y coste por alveolo.",
      calcular_coste_produccion:
        "Utilizar el campo SUS_COS en módulos de producción para calcular el coste del sustrato por alveolo o bandeja.",
      // Ejemplo de posible inconsistencia (basado en la observación):
      // visualizar_inconsistencia: "Observar posibles diferencias en la visualización de datos (PVP, COS, Denominación) para un mismo sustrato (ej: id 001) entre la base de datos y la interfaz del ERP de pruebas."
    },
    notas: {
      inconsistencia_datos_pruebas:
        "Se ha observado que los datos de un mismo sustrato (ej. id 001) pueden diferir entre la base de datos y la visualización en el entorno de pruebas del ERP. Se recomienda validar los datos críticos directamente en la base de datos.",
    },
  },



  /* ================================================*/
  /* Archivos – Auxiliares – Tarifas de precios */
  /* ================================================*/











/* ================================================*/
/* Archivos – Auxiliares – Tipos de siembra */
/* ================================================*/
t_siembras: {
  // Clave principal (nombre de tabla)
  descripcion:
    "Cataloga los diferentes tipos de siembra utilizados en la empresa, detallando las características clave como la bandeja, el sustrato, el número de alveolos y la densidad de plantas. También se vincula a los procesos y observaciones específicas de cada tipo de siembra.",
  tabla: `t-siembras`, // Nombre de la tabla principal
  columnas: {
    id: "Identificador único del tipo de siembra (Clave Primaria).",
    TSI_DENO: "Denominación del tipo de siembra.",
    TSI_BAN: "Código de la bandeja utilizada. Clave foránea a la tabla 'bandejas' para obtener la denominación (BN_DENO).",
    TSI_SUS: "Código del sustrato utilizado. Clave foránea a la tabla 'sustratos' para obtener la denominación (SUS_DENO).",
    TSI_ALV: "Número de alveolos en la bandeja.",
    TSI_PALV: "Cantidad de plantas por alveolo.",
    TSI_PBSI: "Cantidad de plantas por bandeja de siembra.",
  },
  relaciones: {
    bandejas: {
      tabla_relacionada: "bandejas",
      tipo: "Muchos a uno",
      campo_enlace_local: "TSI_BAN",
      campo_enlace_externo: "id",
      descripcion: "Vincula el tipo de siembra con el tipo de bandeja utilizada.",
    },
    sustratos: {
      tabla_relacionada: "sustratos",
      tipo: "Muchos a uno",
      campo_enlace_local: "TSI_SUS",
      campo_enlace_externo: "id",
      descripcion: "Vincula el tipo de siembra con el sustrato utilizado.",
    },
    t_siembras_tsi_pro: {
      tabla_relacionada: "t-siembras_tsi_pro",
      tipo: "Uno a muchos (un tipo de siembra puede tener varios procesos asociados)",
      campo_enlace_local: "id", // ID del tipo de siembra en la tabla principal
      campo_enlace_externo: "id", // ID del tipo de siembra en la tabla de procesos
      descripcion: "Detalla los procesos específicos que se aplican a este tipo de siembra.",
      estructura_relacionada: {
        id: "ID del tipo de siembra (igual que 't-siembras.id').",
        id2: "Identificador secuencial del proceso.",
        C0: "Código del proceso. Clave foránea a la tabla 'procesos' para obtener la denominación (PRO_DENO).",
      },
      relaciones_internas_de_detalle: {
        procesos: {
          tabla_relacionada: "procesos",
          tipo: "Muchos a uno",
          campo_enlace_local: "C0",
          campo_enlace_externo: "id",
          descripcion: "Vincula el código del proceso con su denominación y detalles en la tabla 'procesos'.",
        },
      },
    },
    t_siembras_tsi_obs: {
      tabla_relacionada: "t-siembras_tsi_obs",
      tipo: "Uno a muchos (un tipo de siembra puede tener múltiples observaciones)",
      campo_enlace_local: "id", // ID del tipo de siembra en la tabla principal
      campo_enlace_externo: "id", // ID del tipo de siembra en la tabla de observaciones
      descripcion: "Almacena observaciones y características detalladas para cada tipo de siembra.",
      estructura_relacionada: {
        id: "ID del tipo de siembra (igual que 't-siembras.id').",
        id2: "Identificador secuencial de la observación.",
        C0: "Contenido de la observación o característica.",
      },
    },
  },
  ejemplos: {
    consulta_tipo_siembra_por_id:
      "Obtener la denominación, bandeja, sustrato y detalles de alveolos para un tipo de siembra específico.",
    consultar_procesos:
      "Para un tipo de siembra (ej. ID '0001'), listar los procesos asociados uniéndose a la tabla 'procesos' a través de 't-siembras_tsi_pro'.",
    consultar_observaciones:
      "Obtener todas las observaciones y características de un tipo de siembra específico desde la tabla 't-siembras_tsi_obs'.",
    analisis_de_insumos:
      "Agrupar los tipos de siembra por bandeja ('TSI_BAN') o sustrato ('TSI_SUS') para analizar el uso de insumos.",
  },
},






  /* ================================================*/
  /* Archivos – Auxiliares – Ubicaciones */
  /* ================================================*/
  ubicaciones: {
    descripcion:
      "Catálogo centralizado de ubicaciones físicas o lógicas (invernaderos, semilleros, almacenes) relevantes para las operaciones. Proporciona referencia espacial estandarizada para organizar, trazar y optimizar actividades y recursos.",
    tabla: "ubicaciones", // Nombre de tabla original
    columnas: {
      id: "Código único de la ubicación (Clave Primaria)",
      UBI_DENO: "Denominación o nombre descriptivo de la ubicación (Ej: 'SEMILLERO A', 'Semillero C')",
    },
    relaciones: {
      // La descripción no detalla explícitamente relaciones formales (claves foráneas) desde otras tablas.
      // Sin embargo, se infiere que esta tabla es referenciada por numerosas tablas en módulos como inventario, producción y logística (relaciones Muchos a Uno)
      // para asignar y gestionar elementos o actividades por ubicación, utilizando ubicaciones.id como clave foránea.
    },
    ejemplos: {
      listar_ubicaciones: "Obtener el listado de todas las ubicaciones registradas (id y UBI_DENO).",
      consulta_denominacion_por_id:
        "Buscar la denominación (UBI_DENO) de una ubicación dado su código (id).",
      consulta_id_por_denominacion:
        "Buscar el código (id) de una ubicación dada su denominación (UBI_DENO).",
      // Ejemplos de uso potencial en combinación con otras tablas (si las relaciones se confirman):
      // filtrar_inventario_por_ubicacion: "Ver el inventario disponible en una ubicación específica (requiere que la tabla de inventario referencie a 'ubicaciones')."
      // registrar_proceso_en_ubicacion: "Asignar una ubicación (invernadero, etc.) a un registro de proceso productivo (requiere que la tabla de procesos referencie a 'ubicaciones')."
    },
  },

  /* ================================================*/
  /* Archivos – Auxiliares – Zonas */
  /* ================================================*/
  zonas: {
    descripcion:
      "Catálogo para organizar áreas físicas o lógicas operativas (trabajo, producción, almacenamiento). Fundamental para estructurar espacialmente, mejorar trazabilidad y optimizar gestión de inventario y tareas.",
    tabla: "zonas",
    columnas: {
      id: "Código único de la zona (Clave Primaria)",
      ZN_DENO: "Denominación o nombre descriptivo de la zona (Ej: Garden, ZONA)",
      ZN_SUB: "Subzona o código de agrupación secundaria (Puede estar vacío)",
      ZN_RUTA: "Campo asociado a una ruta (Puede estar vacío)",
    },
    relaciones: {
      // No se especifican relaciones explícitas documentadas que referencien a 'zonas' desde otras tablas en este contexto.
      // Sin embargo, esta tabla es referenciada por módulos como inventario, producción y logística para asignar y gestionar elementos por área.
    },
    ejemplos: {
      listar_zonas: "Obtener el listado de todas las zonas registradas (id, ZN_DENO, etc.).",
      consulta_denominacion_por_id:
        "Buscar la denominación (ZN_DENO) de una zona dado su código (id).",
      consulta_zonas_por_subzona:
        "Filtrar zonas que pertenecen a una subzona específica (ZN_SUB).",
      // Ejemplos de uso en combinación con otras tablas (si las relaciones se confirman):
      // filtrar_inventario_por_zona: "Ver el inventario en una zona específica (requiere relación con tabla de inventario)."
      // asignar_tarea_a_zona: "Planificar una tarea a realizar en una zona determinada."
    },
  },

   /* ==============================================================================================================================================*/

  /* ================================================*/
  /* Archivos – Otros – Departamentos */
  /* ================================================*/
  departamentos: {
    descripcion:
      "Cataloga las áreas o unidades funcionales de la empresa (administración, producción, etc.). Fundamental para asignar responsabilidades, gestionar usuarios/roles, clasificar tareas y generar reportes por área.",
    tabla: "departamentos",
    columnas: {
      id: "Código único del departamento (Clave Primaria)",
      DEP_DENO: "Denominación o nombre del departamento (Ej: COORDINADOR, ADMINISTRACION)",
    },
    relaciones: {
      // No se especifican relaciones explícitas documentadas que referencien a 'departamentos' desde otras tablas en este contexto.
      // Sin embargo, esta tabla es clave y referenciada por tablas como 'usuarios', 'tareas', o 'empleados'
      // para vincular registros a una unidad organizacional.
    },
    ejemplos: {
      listar_departamentos: "Obtener el listado de todos los departamentos registrados (id y DEP_DENO).",
      consulta_denominacion_por_id:
        "Buscar la denominación (DEP_DENO) de un departamento dado su código (id).",
      consulta_id_por_denominacion:
        "Buscar el código (id) de un departamento dada su denominación (DEP_DENO).",
      // Ejemplos de uso en combinación con otras tablas (si las relaciones se confirman):
      // filtrar_usuarios_por_departamento: "Listar usuarios que pertenecen a un departamento específico (requiere relación con tabla de usuarios)."
      // asignar_tarea_a_departamento: "Vincular una tarea a un departamento responsable."
    },
  },

  /* ================================================*/
  /* Archivos – Otros – Empresa */
  /* ================================================*/

  /* ================================================*/
  /* Archivos – Otros – Invernaderos */
  /* ================================================*/

  /* ================================================*/
  /* Archivos – Otros – Secciones Trabajadores */
  /* ================================================*/
  secciones_trabajadores: {
    // Usamos el nombre que aparece en la descripción de campos
    descripcion:
      "Cataloga áreas funcionales, grupos o secciones internas a las que pertenecen los trabajadores. Fundamental para la gestión de RRHH, asignación de tareas y reportes de personal segmentados.",
    // Nota: El texto fuente menciona "Tabla principal: secciones", pero luego describe campos para "secciones_trabajadores". Asumimos que 'secciones_trabajadores' es el nombre de tabla relevante aquí.
    tabla: "secciones", // Nombre de tabla basado en los campos descritos
    columnas: {
      id: "Código único de la sección de trabajador (Clave Primaria)",
      SE_DENO: "Denominación o nombre de la sección (Ej: ADMINISTRACION, PRODUCCION)",
    },
    relaciones: {
      // No se especifican relaciones explícitas documentadas que referencien a 'secciones_trabajadores' desde otras tablas en este contexto.
      // Sin embargo, esta tabla es clave y es referenciada por la tabla 'trabajadores' para asignar a cada empleado su sección.
    },
    ejemplos: {
      listar_secciones: "Obtener el listado de todas las secciones de trabajadores registradas (id y SE_DENO).",
      consulta_denominacion_por_id:
        "Buscar la denominación (SE_DENO) de una sección dado su código (id).",
      consulta_id_por_denominacion:
        "Buscar el código (id) de una sección dada su denominación (SE_DENO).",
      // Ejemplos de uso en combinación con la tabla trabajadores (si la relación se confirma):
      // filtrar_trabajadores_por_seccion: "Listar trabajadores que pertenecen a una sección específica (requiere relación con tabla de trabajadores)."
      // contar_trabajadores_por_seccion: "Obtener el número de trabajadores en una sección determinada (requiere relación y conteo en tabla de trabajadores)."
    },
  },

  /* ================================================*/
  /* Archivos – Otros – Tareas Per */
  /* ================================================*/
  tareas_per: {
    descripcion:
      "Gestión detallada de tareas internas realizadas por el personal. Cada tarea se vincula a una 'Sección de Tarea' (de la tabla tareas_seccion). Esencial para partes de trabajo, seguimiento de tiempo/recursos y análisis de productividad.",
    tabla: "tareas_per",
    columnas: {
      id: "Código único de la tarea (Clave Primaria)",
      TARP_DENO: "Denominación o nombre de la tarea (Ej: H.CARRETILLERO, H.LIMPIEZA GENERAL)",
      TARP_SECC: "Código de la sección de tarea a la que pertenece. Clave foránea a la tabla 'tareas_seccion'.",
      TARP_TIPO: "Tipo general de tarea (Ej: 'Otros', 'Siembra', 'Mantenimiento')",
    },
    relaciones: {
      tareas_seccion: {
        tabla_relacionada: "tareas_seccion",
        tipo: "Muchos a uno (varias tareas_per pueden estar en una tareas_seccion)",
        campo_enlace_local: "TARP_SECC",
        campo_enlace_externo: "id", // o TARS_COD en tareas_seccion
        descripcion:
          "Vincula cada tarea con su sección de tarea correspondiente. Permite obtener la denominación de la sección (TARS_DENO) a partir del código TARP_SECC.",
      },
    },
    ejemplos: {
      listar_tareas: "Obtener el listado de todas las tareas registradas (id, TARP_DENO, etc.).",
      consulta_tarea_por_id: "Buscar una tarea por su código (id) para ver su denominación, sección y tipo.",
      consulta_tareas_por_seccion_codigo:
        "Listar todas las tareas (tareas_per) que pertenecen a una sección específica usando el código de sección (TARP_SECC).",
      consulta_tareas_por_seccion_nombre:
        "Listar tareas de una sección específica usando el nombre de la sección (requiere unir con la tabla tareas_seccion).",
      consulta_tareas_por_tipo: "Filtrar tareas por su tipo general (TARP_TIPO, Ej: 'Siembra').",
    },
  },

  /* ======================================================================================================================================================================*/
 

  /* ================================================*/
  /* Producción - Partes – Partes de Siembra */
  /* ================================================*/
  p_siembras: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Parte de siembra. Registra operaciones de siembra documentando cuándo,partes de siembra, quién, qué semilla, dónde se sembró (almacén), lote y resultados globales (bandejas/palet, total bandejas). Fundamental para documentar el proceso, vincular insumos/personal/ubicación y controlar la producción desde el inicio.",
    tabla: `p-siembras`, // Nombre de tabla principal
    columnas: {
      id: "Número identificador único del parte de siembra (Clave Primaria)",
      PSI_FEC: "Fecha en que se realizó el parte de siembra.",
      PSI_HORA: "Hora en que se realizó el parte de siembra.",
      PSI_OPE: "Número de código del operador. Clave foránea a la tabla 'vendedores' para obtener la denominación (VD_DENO).",
      PSI_SEM: "Código de la semilla o artículo utilizado. Clave foránea a la tabla 'articulos' para obtener la denominación (AR_DENO).",
      PSI_CONP: "Consumo previo (propósito no especificado).",
      PSI_EST: "Estado del parte de siembra.",
      PSI_ALM: "Código del almacén principal donde se realizó el parte de siembra. Clave foránea a la tabla 'almacenes' para obtener la denominación (AM_DENO).",
      PSI_LOTE: "Número de lote de la semilla utilizada.",
      PSI_BAPP: "Bandejas por Palet en este parte.",
      PSI_TBAN: "Número Total de Bandejas en este parte.",
    },
    relaciones: {
      vendedores: {
        tabla_relacionada: "vendedores",
        tipo: "Muchos a uno",
        campo_enlace_local: "PSI_OPE",
        campo_enlace_externo: "id",
        descripcion: "Vincula el parte de siembra con el operador que lo realizó.",
      },
      articulos: {
        tabla_relacionada: "articulos",
        tipo: "Muchos a uno",
        campo_enlace_local: "PSI_SEM",
        campo_enlace_externo: "id",
        descripcion: "Vincula el parte de siembra con el artículo/semilla utilizado.",
      },
      almacenes_principal: {
        // Relación para el almacén principal del parte
        tabla_relacionada: "almacenes",
        tipo: "Muchos a uno",
        campo_enlace_local: "PSI_ALM",
        campo_enlace_externo: "id",
        descripcion: "Vincula el parte de siembra con el almacén principal donde se realizó la operación.",
      },
      p_siembras_psi_semb: {
        tabla_relacionada: `p-siembras_psi_semb`,
        tipo: "Uno a muchos (un parte puede tener múltiples líneas de sembrado de partidas)",
        campo_enlace_local: "id", // El id del parte en p-siembras
        campo_enlace_externo: "id", // El campo id en p-siembras_psi_semb que referencia al parte principal
        descripcion:
          "Almacena los detalles de cada partida sembrada dentro de un parte de siembra.",
        estructura_relacionada: {
          // Estructura de la tabla de detalle
          id: "ID del parte de siembra principal asociado",
          id2: "Línea o cantidad de sembrados dentro de este parte (Ej: 1, 2, 3)",
          C0: "Número de partida sembrada en esta línea. Clave foránea a la tabla 'partidas'.",
          C1: "Número de bandejas sembradas para esta partida en esta línea (Ej: '49').",
          C2: "Número de palet (Ej: '01').",
          C3: "Número de delegación o almacén específico donde se colocaron las bandejas. Clave foránea a la tabla 'almacenes'",
          // Nota: Este es un almacén/sub-ubicación dentro del almacén principal del parte
        },
        relaciones_internas_de_detalle: {
          // Relaciones que parten de la tabla de detalle
          partidas: {
            tabla_relacionada: "partidas",
            tipo: "Muchos a uno (varias líneas pueden referenciar a la misma partida)",
            campo_enlace_local: "C0", // El campo local que contiene el número de partida
            campo_enlace_externo: "id", // El campo referenciado en la tabla partidas
            descripcion:
              "Vincula la línea de detalle con la partida sembrada específica.",
            relaciones_externas_de_partida: {
              // Relaciones que parten de la tabla relacionada (partidas)
              clientes: {
                tabla_relacionada: "clientes",
                tipo: "Muchos a uno (una partida pertenece a un cliente)",
                campo_enlace_local: "PAR_CCL", // Campo en partidas que apunta a clientes
                campo_enlace_externo: "id", // Campo en clientes
                descripcion:
                  "La tabla 'partidas' se relaciona con 'clientes' para obtener la denominación (CL_DENO) del cliente asociado a la partida sembrada (ruta: p-siembras_psi_semb.C0 -> partidas.id -> partidas.PAR_CCL -> clientes.id).",
              },
              // La tabla 'partidas' también se relaciona con 'articulos' (PAR_SEM -> articulos.id)
            },
          },
          almacenes_ubicacion_especifica: {
            // Relación para la ubicación específica del sembrado (C3)
            tabla_relacionada: "almacenes",
            tipo: "Muchos a uno (varias líneas de detalle pueden referenciar al mismo almacén/delegación)",
            campo_enlace_local: "C3", // El campo local que contiene el código del almacén/delegación
            campo_enlace_externo: "id", // El campo referenciado en la tabla almacenes
            descripcion:
              "Vincula la línea de detalle con la delegación o almacén específico donde se colocaron las bandejas sembradas (sub-ubicación).",
          },
        },
      },
    },
    ejemplos: {
      consulta_parte_principal_por_id:
        "Obtener los detalles de cabecera de un parte de siembra (fecha, hora, operador, semilla, almacén principal, etc.) usando su 'id'.",
      consultar_info_cabecera_relacionada:
        "Para un parte principal, usar PSI_OPE, PSI_SEM y PSI_ALM para consultar 'vendedores', 'articulos' y 'almacenes' y obtener los nombres del operador, semilla y almacén principal.",
      consultar_detalles_partidas_sembradas:
        "Para un parte de siembra específico (usando su id), consultar la tabla relacionada 'p-siembras_psi_semb' para ver cada partida que fue sembrada, cuántas bandejas, en qué palet y dónde (sub-ubicación).",
      obtener_info_detalle_relacionada:
        "Desde una línea de detalle en 'p-siembras_psi_semb', usar C0 (partida) y C3 (sub-ubicación) para consultar 'partidas' y 'almacenes' y obtener detalles de la partida y el nombre de la ubicación específica.",
      trazar_cliente_desde_sembrado:
        "Desde una línea de detalle en 'p-siembras_psi_semb' (usando C0), consultar la tabla 'partidas' para obtener el PAR_CCL, y luego consultar la tabla 'clientes' para obtener la denominación (CL_DENO) del cliente para quien se sembró esa partida.",
      filtrar_partes_por_fecha_operador_o_semilla:
        "Listar partes de siembra por fecha (filtrando por PSI_FEC), operador (filtrando por PSI_OPE) o semilla utilizada (filtrando por PSI_SEM).",
      filtrar_lineas_por_partida_o_ubicacion_especifica:
        "Buscar líneas de detalle en 'p-siembras_psi_semb' para una partida específica (filtrando por C0) o una ubicación de sembrado particular (filtrando por C3).",
    },
  },



/* ================================================*/
/* Produccion-Partes-Partes Extendido */
/* ================================================*/
p_extension: {
    // Clave principal (basada en el nombre de la tabla)
    descripcion:
      "Registra información extendida relacionada con partes de producción, incluyendo número de partida, fecha, hora, usuario, tipo y los invernaderos de origen y destino.",
    tabla: `p-extension`, // Nombre de la tabla principal
    columnas: {
      id: "Número del extendido (Clave Primaria)",
      PEX_NPA: "Número de partida.",
      PEX_FEC: "Fecha.",
      PEX_HORA: "Hora.",
      PEX_USU: "Usuario. Clave foránea a la tabla 'vendedores' para obtener la denominación (VD_DENO).",
      PEX_TIPO: "Tipo (en forma de letra, Ej: 'P', 'C').",
      PEX_IOR: "Invernadero de origen. Clave foránea a la tabla 'invernaderos' para obtener la denominación (INV_DENO).",
      PEX_IDE: "Invernadero de destino. Clave foránea a la tabla 'invernaderos' para obtener la denominación (INV_DENO).",
    },
    relaciones: {
      vendedores: {
        tabla_relacionada: "vendedores",
        tipo: "Muchos a uno",
        campo_enlace_local: "PEX_USU",
        campo_enlace_externo: "id",
        descripcion: "Vincula el registro extendido con el usuario que lo generó.",
      },
      invernaderos_origen: {
        tabla_relacionada: "invernaderos",
        tipo: "Muchos a uno",
        campo_enlace_local: "PEX_IOR",
        campo_enlace_externo: "id",
        descripcion: "Vincula el registro extendido con el invernadero de origen.",
      },
      invernaderos_destino: {
        tabla_relacionada: "invernaderos",
        tipo: "Muchos a uno",
        campo_enlace_local: "PEX_IDE",
        campo_enlace_externo: "id",
        descripcion: "Vincula el registro extendido con el invernadero de destino.",
      },
      partidas: {
        tabla_relacionada: "partidas",
        tipo: "Muchos a uno",
        campo_enlace_local: "PEX_NPA",
        campo_enlace_externo: "id",
        descripcion: "Vincula el registro extendido con la partida asociada.",
      },
    },
    ejemplos: {
      consulta_extendido_por_id:
        "Obtener los detalles de un registro extendido específico usando su 'id'.",
      consultar_info_relacionada:
        "Para un registro extendido, usar PEX_USU, PEX_IOR y PEX_IDE para consultar 'vendedores' e 'invernaderos' y obtener los nombres del usuario y los invernaderos de origen y destino.",
      filtrar_por_partida:
        "Listar registros extendidos asociados a un número de partida específico (filtrando por PEX_NPA).",
      filtrar_por_fecha_hora:
        "Buscar registros extendidos en una fecha o rango de fechas y/o hora específica (filtrando por PEX_FEC y PEX_HORA).",
      filtrar_por_tipo:
        "Encontrar registros extendidos de un tipo específico (filtrando por PEX_TIPO).",
      filtrar_por_invernadero_origen:
        "Buscar registros extendidos cuyo origen sea un invernadero específico (filtrando por PEX_IOR).",
      filtrar_por_invernadero_destino:
        "Buscar registros extendidos cuyo destino sea un invernadero específico (filtrando por PEX_IDE).",
    },
  },



/* ================================================*/
/* Produccion-Partes-Partes de tratamiento */
/* ================================================*/
p_aplica_trat2: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Registra los partes de tratamiento fitosanitario, incluyendo información general, personal involucrado, aplicador y equipo utilizado, problema fitosanitario y el tratamiento aplicado. Contiene relaciones con las zonas tratadas, productos utilizados y familias a tratar.",
    tabla: `p-aplica-trat2`, // Nombre de la tabla principal
    columnas: {
      id: "Código del parte de tratamiento (Clave Primaria)",
      PAT_FEC: "Fecha en que se gestionó este parte de tratamiento.",
      PAT_HORA: "Hora en que se gestionó este parte de tratamiento.",
      PAT_USU: "Vendedor encargado/responsable. Clave foránea a la tabla 'vendedores' para obtener la denominación (VD_DENO).",
      PAT_EST: "Estado ('P': Prevista, 'R': Realizada).",
      PAT_FPRE: "Fecha prevista.",
      PAT_HPRE: "Hora prevista.",
      PAT_FREA: "Fecha realizado.",
      PAT_HREA: "Hora realizado.",
      PAT_PER: "Personal autorizado. Clave foránea a la tabla 'vendedores' para obtener la denominación (VD_DENO).",
      PAT_TEC: "Técnica de aplicación.",
      PAT_APLI: "Aplicador fitosanitario. Clave foránea a la tabla 'aplicadores_fit' para obtener la denominación (AFI_DENO).",
      PAT_EQUI: "Código del equipo fitosanitario. Clave foránea a la tabla 'equipo_fito' para obtener la denominación (EFI_DENO).",
      PAT_PROB: "Problema fitosanitario.",
      PAT_TRAT: "Código del tratamiento. Clave foránea a la tabla 'tratamientos' para obtener la denominación (TT_DENO).",
    },
    relaciones: {
      vendedor_responsable: {
        tabla_relacionada: "vendedores",
        tipo: "Muchos a uno",
        campo_enlace_local: "PAT_USU",
        campo_enlace_externo: "id",
        descripcion: "Vincula el parte de tratamiento con el vendedor responsable.",
      },
      personal_autorizado: {
        tabla_relacionada: "vendedores",
        tipo: "Muchos a uno",
        campo_enlace_local: "PAT_PER",
        campo_enlace_externo: "id",
        descripcion: "Vincula el parte de tratamiento con el personal autorizado.",
      },
      aplicador_fitosanitario: {
        tabla_relacionada: "aplicadores_fit",
        tipo: "Muchos a uno",
        campo_enlace_local: "PAT_APLI",
        campo_enlace_externo: "id",
        descripcion: "Vincula el parte de tratamiento con el aplicador fitosanitario utilizado.",
      },
      equipo_fitosanitario: {
        tabla_relacionada: "equipo_fito",
        tipo: "Muchos a uno",
        campo_enlace_local: "PAT_EQUI",
        campo_enlace_externo: "id",
        descripcion: "Vincula el parte de tratamiento con el equipo fitosanitario utilizado.",
      },
      tratamiento: {
        tabla_relacionada: "tratamientos",
        tipo: "Muchos a uno",
        campo_enlace_local: "PAT_TRAT",
        campo_enlace_externo: "id",
        descripcion: "Vincula el parte de tratamiento con el tratamiento fitosanitario aplicado.",
      },
      p_aplica_trat2_pat_afec: {
        tabla_relacionada: "p-aplica-trat2_pat_afec",
        tipo: "Uno a muchos (un parte de tratamiento puede afectar varias zonas)",
        campo_enlace_local: "id", // ID del parte de tratamiento
        campo_enlace_externo: "id", // ID del parte de tratamiento en la tabla de enlace
        descripcion: "Tabla de enlace que relaciona partes de tratamiento con las zonas tratadas (invernaderos).",
        estructura_relacionada: {
          id: "ID del parte de tratamiento.",
          id2: "Identificador secuencial dentro del parte.",
          C0: "Código del invernadero tratado. Clave foránea a la tabla 'invernaderos'.",
          C1: "Nombre o identificador de la zona tratada (Ej: 'C1').",
        },
        relaciones_internas_de_detalle: {
          invernaderos: {
            tabla_relacionada: "invernaderos",
            tipo: "Muchos a uno",
            campo_enlace_local: "C0",
            campo_enlace_externo: "id",
            descripcion: "Vincula el parte de tratamiento con el invernadero donde se aplicó.",
          },
        },
      },
      p_aplica_trat2_pat_tra: {
        tabla_relacionada: "p-aplica-trat2_pat_tra",
        tipo: "Uno a muchos (un parte de tratamiento puede usar varios productos)",
        campo_enlace_local: "id", // ID del parte de tratamiento
        campo_enlace_externo: "id", // ID del parte de tratamiento en la tabla de enlace
        descripcion: "Tabla de enlace que relaciona partes de tratamiento con los productos fitosanitarios utilizados.",
        estructura_relacionada: {
          id: "ID del parte de tratamiento.",
          id2: "Identificador secuencial dentro del parte.",
          C0: "ID del tipo de producto fitosanitario. Clave foránea a la tabla 'tipo_trat'.",
          C1: "Dosis del producto.",
          C2: "Información adicional del producto (Ej: 'BERENJENA...').",
          C3: "Campo auxiliar (Ej: '').",
          C4: "Campo auxiliar (Ej: '').",
          C5: "Campo auxiliar (Ej: '').",
          C6: "Valor numérico (Ej: '0.00').",
        },
        relaciones_internas_de_detalle: {
          tipo_trat: {
            tabla_relacionada: "tipo_trat",
            tipo: "Muchos a uno",
            campo_enlace_local: "C0",
            campo_enlace_externo: "id",
            descripcion: "Vincula el parte de tratamiento con el tipo de producto fitosanitario utilizado.",
          },
        },
      },
      p_aplica_trat2_pat_famgr: {
        tabla_relacionada: "p-aplica-trat2_pat_famgr",
        tipo: "Uno a muchos (un parte de tratamiento puede aplicarse a varias familias)",
        campo_enlace_local: "id", // ID del parte de tratamiento
        campo_enlace_externo: "id", // ID del parte de tratamiento en la tabla de enlace
        descripcion: "Tabla de enlace que relaciona partes de tratamiento con las familias a tratar.",
        estructura_relacionada: {
          id: "ID del parte de tratamiento.",
          id2: "Identificador secuencial dentro del parte.",
          C0: "Código de la familia a tratar. Clave foránea a la tabla 'familias'.",
          C1: "Valor asociado a la familia (Ej: '1').",
          C2: "Otro valor asociado a la familia (Ej: '24').",
        },
        relaciones_internas_de_detalle: {
          familias: {
            tabla_relacionada: "familias",
            tipo: "Muchos a uno",
            campo_enlace_local: "C0",
            campo_enlace_externo: "id",
            descripcion: "Vincula el parte de tratamiento con la familia a tratar.",
          },
        },
      },
    },
    ejemplos: {
      consulta_parte_tratamiento_por_id:
        "Obtener los detalles generales de un parte de tratamiento usando su 'id'.",
      consultar_info_relacionada:
        "Para un parte de tratamiento, obtener información del vendedor responsable, personal autorizado, aplicador, equipo y tratamiento aplicado.",
      consultar_zonas_tratadas:
        "Para un parte de tratamiento, listar las zonas (invernaderos) donde se aplicó el tratamiento.",
      consultar_productos_utilizados:
        "Para un parte de tratamiento, listar los productos fitosanitarios utilizados (con sus dosis).",
      consultar_familias_tratadas:
        "Para un parte de tratamiento, listar las familias a las que se aplicó el tratamiento.",
      filtrar_partes_por_fecha_estado_o_tratamiento:
        "Listar partes de tratamiento por fecha, estado (previsto/realizado) o el tratamiento aplicado.",
    },
  },


  
/* ================================================*/
/* Produccion - Partes - Partes de Injertos */
/* ================================================*/
p_injertos: {
  // Clave principal (nombre de tabla)
  descripcion:
    "Registra y gestiona los partes de trabajo de injertos de plantas. Documenta el proceso desde la realización del injerto hasta su paso por la cámara, incluyendo detalles de la producción, el personal, los materiales usados y el estado actual de las plantas.",
  tabla: `p-injertos`, // Nombre de la tabla principal
  columnas: {
    id: "Número de parte o identificador único del registro de injerto (Clave Primaria).",
    PIN_FEC: "Fecha en que se realizó el parte de injerto.",
    PIN_HOR: "Hora de realización del parte.",
    PIN_USU: "Código del usuario o vendedor que registró el parte. Clave foránea a la tabla 'vendedores' para obtener la denominación (VD_DENO).",
    PIN_PAR: "Código de la partida de plantas injertadas. Clave foránea a la tabla 'partidas' para obtener detalles de la partida.",
    PIN_NPLA: "Número de plantas actuales en el parte.",
    PIN_NBAN: "Número de bandejas actuales en el parte.",
    PIN_BAN: "Código de la bandeja utilizada. Clave foránea a la tabla 'bandejas' para obtener la denominación (BN_DENO).",
    PIN_SUST: "Código del sustrato utilizado. Clave foránea a la tabla 'sustratos' para obtener la denominación (SUS_DENO).",
    PIN_EST: "Estado actual del proceso de injerto. Los posibles valores son: 'I' (Injerto realizado), 'E' (Entrado en cámara), 'S' (Salida de cámara).",
    PIN_DEL: "Código de la delegación o almacén. Clave foránea a la tabla 'almacenes' para obtener la denominación (AM_DENO).",
  },
  relaciones: {
    vendedores: {
      tabla_relacionada: "vendedores",
      tipo: "Muchos a uno",
      campo_enlace_local: "PIN_USU",
      campo_enlace_externo: "id",
      descripcion: "Vincula el parte de injerto con el vendedor o usuario que lo registró.",
    },
    partidas: {
      tabla_relacionada: "partidas",
      tipo: "Muchos a uno",
      campo_enlace_local: "PIN_PAR",
      campo_enlace_externo: "id",
      descripcion: "Vincula el parte de injerto con la partida de producción a la que pertenece.",
    },
    bandejas: {
      tabla_relacionada: "bandejas",
      tipo: "Muchos a uno",
      campo_enlace_local: "PIN_BAN",
      campo_enlace_externo: "id",
      descripcion: "Vincula el parte con la bandeja específica que se utilizó en el proceso de injerto.",
    },
    sustratos: {
      tabla_relacionada: "sustratos",
      tipo: "Muchos a uno",
      campo_enlace_local: "PIN_SUST",
      campo_enlace_externo: "id",
      descripcion: "Vincula el parte con el sustrato que se utilizó.",
    },
    almacenes: {
      tabla_relacionada: "almacenes",
      tipo: "Muchos a uno",
      campo_enlace_local: "PIN_DEL",
      campo_enlace_externo: "id",
      descripcion: "Vincula el parte de injerto con la delegación o almacén donde se realizó.",
    },
    // Lógicamente, este parte podría tener una tabla de detalle, aunque no se especifica.
    // Por ejemplo, para registrar los tipos de plantas o semillas injertadas.
  },
  ejemplos: {
    consulta_parte_injerto:
      "Obtener el estado actual y detalles de un parte de injerto específico usando su 'id'.",
    seguimiento_partida:
      "Para una partida específica, listar todos los partes de injertos asociados para seguir su proceso desde el injerto hasta la salida de cámara.",
    analisis_productividad:
      "Analizar la cantidad de plantas y bandejas injertadas por usuario ('PIN_USU') o por delegación ('PIN_DEL').",
    analisis_materiales:
      "Evaluar el uso de bandejas ('PIN_BAN') y sustratos ('PIN_SUST') en los procesos de injerto.",
    filtrar_por_estado:
      "Listar todos los partes de injerto que están actualmente 'En cámara' (filtrando por PIN_EST = 'E').",
  },
},











/* ================================================*/
/* Produccion-Partes-Partes de Visita */
/* ================================================*/
reg_visitas: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Registra las visitas realizadas, documentando la fecha, hora, el usuario que la gestionó, y el cliente o proveedor asociado a la visita. Esta sección también detalla las partidas específicas que fueron objeto de la visita.",
    tabla: `reg-visitas`, // Nombre de la tabla principal
    columnas: {
      id: "Código ID único de la parte de visita (Clave Primaria)",
      RV_FEC: "Fecha de la visita.",
      RV_HORA: "Hora de la visita.",
      RV_USU: "Usuario que gestionó la visita. Clave foránea a la tabla 'vendedores' para obtener la denominación (VD_DENO).",
      RV_CCL: "ID del cliente asociado a la visita. Clave foránea a la tabla 'clientes' para obtener la denominación (CL_DENO).",
      RV_CDPR: "ID del proveedor asociado a la visita. Clave foránea a la tabla 'proveedores' para obtener la denominación (PR_DENO).",
    },
    relaciones: {
      vendedores: {
        tabla_relacionada: "vendedores",
        tipo: "Muchos a uno",
        campo_enlace_local: "RV_USU",
        campo_enlace_externo: "id",
        descripcion: "Vincula la visita con el usuario/vendedor que la gestionó.",
      },
      clientes: {
        tabla_relacionada: "clientes",
        tipo: "Muchos a uno",
        campo_enlace_local: "RV_CCL",
        campo_enlace_externo: "id",
        descripcion: "Vincula la visita con el cliente asociado.",
      },
      proveedores: {
        tabla_relacionada: "proveedores",
        tipo: "Muchos a uno",
        campo_enlace_local: "RV_CDPR",
        campo_enlace_externo: "id",
        descripcion: "Vincula la visita con el proveedor asociado.",
      },
      reg_visitas_rv_lna: { // Tabla de detalle para las partidas visitadas
        tabla_relacionada: "reg-visitas_rv_lna",
        tipo: "Uno a muchos (una visita puede incluir múltiples partidas)",
        campo_enlace_local: "id", // ID del parte de visita
        campo_enlace_externo: "id", // ID del parte de visita en la tabla de detalle
        descripcion: "Detalla las partidas de siembra asociadas a esta visita.",
        estructura_relacionada: {
          id: "ID del parte de visita.",
          id2: "Identificador secuencial de la línea de detalle.",
          C0: "ID de la partida visitada. Clave foránea a la tabla 'partidas'.",
          // Otros campos C1, C2, etc. no especificados
        },
        relaciones_internas_de_detalle: {
          partidas: {
            tabla_relacionada: "partidas",
            tipo: "Muchos a uno",
            campo_enlace_local: "C0",
            campo_enlace_externo: "id",
            descripcion: "Vincula el detalle de la visita con la partida de siembra.",
            // Relaciones desde 'partidas' que son relevantes en este contexto de visita
            relaciones_externas_de_partida: {
              clientes: {
                tabla_relacionada: "clientes",
                tipo: "Muchos a uno",
                campo_enlace_local: "PAR_CCL",
                campo_enlace_externo: "id",
                descripcion: "El cliente de la partida (se puede obtener a través de la partida).",
              },
              articulos: {
                tabla_relacionada: "articulos",
                tipo: "Muchos a uno",
                campo_enlace_local: "PAR_SEM",
                campo_enlace_externo: "id",
                descripcion: "La semilla utilizada en la partida (se puede obtener a través de la partida).",
              },
            },
          },
        },
      },
    },
    ejemplos: {
      consulta_visita_por_id:
        "Obtener la fecha, hora y el usuario de un parte de visita específico usando su 'id'.",
      consultar_info_relacionada:
        "Para un parte de visita, obtener la denominación del usuario, cliente o proveedor asociado.",
      consultar_partidas_visitadas:
        "Para un parte de visita específico, consultar la tabla 'reg-visitas_rv_lna' para ver todas las partidas que fueron objeto de esa visita.",
      obtener_detalles_partida_visitada:
        "Desde una línea de detalle en 'reg-visitas_rv_lna', usar el C0 para consultar la tabla 'partidas' y obtener la fecha, tipo de semilla, y la semilla utilizada en esa partida, incluyendo el cliente de la partida y la denominación de la semilla.",
      filtrar_visitas_por_cliente_o_fecha:
        "Listar partes de visita realizados a un cliente específico o en un rango de fechas.",
    },
  },





/* ================================================*/
/* Produccion - Partes - Partes Varios */
/* ================================================*/
p_tratamientos: {
  // Clave principal (nombre de tabla)
  descripcion:
    "Registra los partes de trabajo de varios procesos en la producción de plantas, como tratamientos, trasplantes y otros eventos. Documenta los cambios en la partida, incluyendo la cantidad de plantas y bandejas antes y después del proceso, así como los nuevos materiales utilizados.",
  tabla: `p-tratamientos`, // Nombre de la tabla principal
  columnas: {
    id: "Identificador único del registro o número de parte de tratamiento (Clave Primaria).",
    PTR_FEC: "Fecha del registro del parte.",
    PTR_HOR: "Hora del registro del parte.",
    PTR_USU: "Código del usuario o vendedor que registró el parte. Clave foránea a la tabla 'vendedores' para obtener la denominación (VD_DENO).",
    PTR_PAR: "Código de la partida asociada al parte. Clave foránea a la tabla 'partidas' para obtener detalles de la partida.",
    PTR_PROC: "Código del proceso realizado. Clave foránea a la tabla 'procesos' para obtener la denominación (PRO_DENO).",
    // Columnas para el estado actual de la partida
    PTR_NBA: "Número de bandejas actual.",
    PTR_APB: "Número de alveolos por bandeja actual.",
    PTR_ALV: "Número de alveolos actual.",
    PTR_PLA: "Número de plantas actual.",
    PTR_PPA: "Número de plantas por alveolo actual.",
    // Columnas para el nuevo estado después del proceso
    PTR_NNBA: "Nuevo número de bandejas total.",
    PTR_NAPB: "Nuevo número de alveolos por bandeja.",
    PTR_NALV: "Nuevo número de alveolos.",
    PTR_NPPA: "Nuevo número de plantas por alveolo.",
    PTR_NPLA: "Nuevo número de plantas.",
    // Columnas para nuevos materiales
    PTR_BAN: "Código de la nueva bandeja utilizada. Clave foránea a la tabla 'bandejas' para obtener la denominación (BN_DENO).",
    PTR_SUST: "Código del nuevo sustrato utilizado. Clave foránea a la tabla 'sustratos' para obtener la denominación (SUS_DENO).",
  },
  relaciones: {
    vendedores: {
      tabla_relacionada: "vendedores",
      tipo: "Muchos a uno",
      campo_enlace_local: "PTR_USU",
      campo_enlace_externo: "id",
      descripcion: "Vincula el parte de tratamiento con el vendedor o usuario que lo registró.",
    },
    partidas: {
      tabla_relacionada: "partidas",
      tipo: "Muchos a uno",
      campo_enlace_local: "PTR_PAR",
      campo_enlace_externo: "id",
      descripcion: "Vincula el parte con la partida de producción a la que pertenece.",
    },
    procesos: {
      tabla_relacionada: "procesos",
      tipo: "Muchos a uno",
      campo_enlace_local: "PTR_PROC",
      campo_enlace_externo: "id",
      descripcion: "Vincula el parte de tratamiento con el proceso específico que se realizó.",
    },
    bandejas: {
      tabla_relacionada: "bandejas",
      tipo: "Muchos a uno",
      campo_enlace_local: "PTR_BAN",
      campo_enlace_externo: "id",
      descripcion: "Vincula el parte con la nueva bandeja utilizada en el proceso.",
    },
    sustratos: {
      tabla_relacionada: "sustratos",
      tipo: "Muchos a uno",
      campo_enlace_local: "PTR_SUST",
      campo_enlace_externo: "id",
      descripcion: "Vincula el parte con el nuevo sustrato utilizado en el proceso.",
    },
  },
  ejemplos: {
    consulta_parte_tratamiento:
      "Obtener los detalles de un parte de tratamiento específico, incluyendo los cambios en la cantidad de plantas y bandejas.",
    seguimiento_partida:
      "Para una partida específica, listar todos los partes de tratamientos asociados para rastrear la evolución de la cantidad de plantas y los procesos realizados.",
    analisis_procesos:
      "Analizar la frecuencia de un proceso específico (ej. 'trasplante') y el impacto en las métricas de la partida (ej. 'PTR_NPLA', 'PTR_NNBA').",
  },
},



/* ================================================*/
/* Produccion-Partes-Partes Extension Mult.          */
/* ================================================*/



/* ================================================*/
/* Produccion-Partes-Partes Estructurales          */
/* ================================================*/


/* ================================================*/
/* Produccion-Partes-Partes Consumo         */
/* ================================================*/


/* ==============================================================================================================================================*/



/* ================================================*/
/* Produccion- Otras - Partes Muestreo */
/* ================================================*/






/* ================================================*/
/* Produccion- Otras - Cortes Cebolla */
/* ================================================*/




/* ================================================*/
/* Produccion- Otras - Planta Enferma */
/* ================================================*/


/* ==============================================================================================================================================*/


/* ================================================*/
/* Produccion- Utilidades - Partes Lavado */
/* ================================================*/


p_lavar: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Registra los partes de trabajo correspondientes al lavado de bandejas. Documenta la cantidad de bandejas lavadas, el tipo de bandeja, la fecha, la hora y el técnico responsable, lo cual es fundamental para el control de inventario y la trazabilidad del proceso.",
    tabla: `p-lavar`, // Nombre de la tabla principal
    columnas: {
      id: "Código único de registro del lavado de bandejas (Clave Primaria).",
      LAV_ENV: "Código del tipo de bandeja lavada. Clave foránea a la tabla 'bandejas' para obtener la denominación (BN_DENO).",
      LAV_BAND: "Número total de bandejas lavadas o a lavar.",
      LAV_FEC: "Fecha en que se realizó el lavado.",
      LAV_HORA: "Hora en que se registró el lavado.",
      LAV_USU: "Código del técnico responsable del lavado. Clave foránea a la tabla 'tecnicos' para obtener la denominación (TN_DENO).",
    },
    relaciones: {
      bandejas: {
        tabla_relacionada: "bandejas",
        tipo: "Muchos a uno",
        campo_enlace_local: "LAV_ENV",
        campo_enlace_externo: "id",
        descripcion: "Vincula el registro de lavado con el tipo de bandeja correspondiente.",
      },
      tecnicos: {
        tabla_relacionada: "tecnicos",
        tipo: "Muchos a uno",
        campo_enlace_local: "LAV_USU",
        campo_enlace_externo: "id",
        descripcion: "Vincula el registro de lavado con el técnico que realizó el trabajo.",
      },
    },
    ejemplos: {
      consulta_por_id:
        "Obtener los detalles de un registro de lavado específico usando su 'id'.",
      control_de_inventario:
        "Listar las bandejas lavadas por tipo de bandeja y fecha para actualizar el inventario de bandejas limpias.",
      analisis_de_productividad:
        "Calcular el número total de bandejas lavadas por cada técnico en un período de tiempo para evaluar la productividad.",
      filtrar_por_fecha_o_tecnico:
        "Buscar todos los registros de lavado realizados en una fecha específica o por un técnico en particular.",
    },
  },



/* ================================================*/
/* Produccion- Utilidades - Partes Sacudir */
/* ================================================*/

p_sacudir: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Registra los partes de trabajo de sacudido de bandejas, un proceso que suele realizarse para remover el exceso de sustrato o para acondicionar las bandejas. Documenta el tipo y la cantidad de bandejas sacudidas, junto con la fecha, hora y el técnico responsable de la tarea.",
    tabla: `p-sacudir`, // Nombre de la tabla principal
    columnas: {
      id: "Código único de registro del sacudido de bandejas (Clave Primaria).",
      SAC_ENV: "Código del tipo de bandeja sacudida. Clave foránea a la tabla 'bandejas' para obtener la denominación (BN_DENO).",
      SAC_BAND: "Número total de bandejas sacudidas.",
      SAC_FEC: "Fecha en que se realizó el sacudido.",
      SAC_HORA: "Hora en que se registró el sacudido.",
      SAC_USU: "Código del técnico responsable del trabajo. Clave foránea a la tabla 'tecnicos' para obtener la denominación (TN_DENO).",
    },
    relaciones: {
      bandejas: {
        tabla_relacionada: "bandejas",
        tipo: "Muchos a uno",
        campo_enlace_local: "SAC_ENV",
        campo_enlace_externo: "id",
        descripcion: "Vincula el registro de sacudido con el tipo de bandeja correspondiente.",
      },
      tecnicos: {
        tabla_relacionada: "tecnicos",
        tipo: "Muchos a uno",
        campo_enlace_local: "SAC_USU",
        campo_enlace_externo: "id",
        descripcion: "Vincula el registro de sacudido con el técnico que realizó la tarea.",
      },
    },
    ejemplos: {
      consulta_por_id:
        "Obtener los detalles de un registro de sacudido específico usando su 'id'.",
      analisis_productividad:
        "Calcular la cantidad total de bandejas sacudidas por un técnico en un período de tiempo para evaluar la productividad.",
      control_de_inventario:
        "Utilizar esta tabla para rastrear la cantidad de bandejas que han pasado por el proceso de sacudido.",
      filtrar_por_fecha_o_tecnico:
        "Buscar todos los registros de sacudido realizados en una fecha específica o por un técnico en particular.",
    },
  },



/* ================================================*/
/* Produccion- Utilidades - Parte Manipulado */
/* ================================================*/


p_manipulado: {
  // Clave principal (nombre de tabla)
  descripcion:
    "Registra los partes de trabajo de manipulado de plantas, documentando la fecha, hora, el técnico responsable, la tarea realizada y la cantidad manipulada por partida. Es crucial para la trazabilidad y el control de la producción.",
  tabla: `p-manipulado`, // Nombre de la tabla principal
  columnas: {
    id: "Código único de registro del parte de manipulado (Clave Primaria).",
    PMA_FEC: "Fecha del parte de manipulado.",
    PMA_HORA: "Hora de registro del parte.",
    PMA_CDTN: "Código del técnico responsable. Clave foránea a la tabla 'tecnicos' para obtener la denominación (TN_DENO).",
    PMA_CDSEC: "Código de la sección de la tarea. Clave foránea a la tabla 'tareas_seccion' para obtener la denominación (TARS_DENO).",
    PMA_CDTAR: "Código de la tarea realizada. Clave foránea a la tabla 'tareas_per' para obtener la denominación (TARP_DENO).",
    PMA_CDPAR: "Código de la partida de producción. Clave foránea a la tabla 'partidas' para obtener detalles de la partida y la variedad.",
    PMA_VALOR: "Cantidad manipulada (ej. número de plantas, bandejas, etc.).",
    PMA_CDUBI: "Código de la ubicación. Clave foránea a la tabla 'ubicaciones' para obtener la denominación (UBI_DENO).",
  },
  relaciones: {
    tecnicos: {
      tabla_relacionada: "tecnicos",
      tipo: "Muchos a uno",
      campo_enlace_local: "PMA_CDTN",
      campo_enlace_externo: "id",
      descripcion: "Vincula el parte de manipulado con el técnico que realizó la tarea.",
    },
    tareas_seccion: {
      tabla_relacionada: "tareas_seccion",
      tipo: "Muchos a uno",
      campo_enlace_local: "PMA_CDSEC",
      campo_enlace_externo: "id",
      descripcion: "Vincula el parte con la sección o área de la tarea.",
    },
    tareas_per: {
      tabla_relacionada: "tareas_per",
      tipo: "Muchos a uno",
      campo_enlace_local: "PMA_CDTAR",
      campo_enlace_externo: "id",
      descripcion: "Vincula el parte con el tipo de tarea específica de personal realizada.",
    },
    partidas: {
      tabla_relacionada: "partidas",
      tipo: "Muchos a uno",
      campo_enlace_local: "PMA_CDPAR",
      campo_enlace_externo: "id",
      descripcion: "Vincula el parte con la partida de producción manipulada para rastrear la variedad y otros detalles.",
    },
    ubicaciones: {
      tabla_relacionada: "ubicaciones",
      tipo: "Muchos a uno",
      campo_enlace_local: "PMA_CDUBI",
      campo_enlace_externo: "id",
      descripcion: "Vincula el parte con la ubicación física donde se realizó el manipulado.",
    },
  },
  ejemplos: {
    consulta_parte_manipulado:
      "Obtener todos los detalles de un parte de manipulado específico, incluyendo el técnico, la tarea y la cantidad.",
    seguimiento_partida:
      "Para una partida específica, rastrear las tareas de manipulado que se le han realizado a lo largo del tiempo.",
    analisis_productividad:
      "Evaluar la cantidad manipulada por técnico ('PMA_VALOR' agrupado por 'PMA_CDTN') o por tipo de tarea ('PMA_CDTAR').",
    control_de_procesos:
      "Analizar qué tareas se realizan en qué secciones y ubicaciones para optimizar el flujo de trabajo.",
  },
},

/* ==============================================================================================================================================*/


/* ================================================*/
/* Produccion- Controles - Costes */
/* ================================================*/







/* ================================================*/
/* Produccion- Controles - Resumen Costes */
/* ================================================*/






/* ================================================*/
/* Produccion- Controles - Historico Costes */
/* ================================================*/









/* ================================================*/
/* Produccion- Controles - Historico Costes */
/* ================================================*/



















/* ======================================================================================================================================================================*/



/* ================================================*/
/* Injertos Y Abonados - Utilidades – Medias bandejas */
/* ================================================*/
p_medias_band: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Registra información sobre medias bandejas, incluyendo el código de partida, alveolos, huecos, etiqueta, cantidad de plantas, fecha y hora de registro, y el operario asociado. El 'id' suele coincidir con el código de partida.",
    tabla: `p-medias-band`, // Nombre de la tabla principal
    columnas: {
      id: "Código de la media bandeja (Clave Primaria). Frecuentemente coincide con el código de partida.",
      PMB_PAR: "Código de la partida asociada (Ej: '15011300').",
      PMB_ALV: "Cantidad de alveolos (Ej: '104').",
      PMB_HUE: "Cantidad de huecos (Ej: '15').",
      PMB_ETIQ: "Etiqueta de la media bandeja (Ej: '3801130009256').",
      PMB_PLAN: "Cantidad de plantas (Ej: '0').",
      PMB_FEC: "Fecha de registro (Ej: '2021-06-02').",
      PMB_HORA: "Hora de registro (Ej: '11:48').",
      PMB_CDOP: "Código del operario (Ej: '0002'). No se especifica relación con otra tabla.",
    },
    relaciones: {
      // Se podría inferir una relación con 'partidas' a través de PMB_PAR, 
      // pero no se describe explícitamente en el texto proporcionado.
      // Si PMB_PAR es una clave foránea a 'partidas.id', la relación sería:
      /*
      partidas: {
        tabla_relacionada: "partidas",
        tipo: "Muchos a uno",
        campo_enlace_local: "PMB_PAR",
        campo_enlace_externo: "id",
        descripcion: "Vincula la media bandeja con la partida de siembra a la que pertenece."
      }
      */
    },
    ejemplos: {
      consulta_media_bandeja_por_id:
        "Obtener todos los detalles de una media bandeja específica usando su 'id' o 'PMB_PAR'.",
      filtrar_por_partida:
        "Listar todas las medias bandejas asociadas a un código de partida específico (filtrando por PMB_PAR).",
      filtrar_por_fecha_rango:
        "Buscar medias bandejas registradas en una fecha o rango de fechas (filtrando por PMB_FEC).",
      buscar_por_etiqueta:
        "Encontrar una media bandeja específica usando su etiqueta (filtrando por PMB_ETIQ).",
    },
  },



/* ================================================*/
/* Injertos Y Abonados - Utilidades – Escandallo Injertos */
/* ================================================*/
p_escan_inj: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Registra los detalles del escandallo de injertos, incluyendo el código de partida, información de alveolos y huecos, etiqueta, cantidad de plantas y bandejas, fecha y hora de registro, y el operario asociado. El 'id' suele ser un código de identificación único para cada registro de escandallo.",
    tabla: `p-escan-inj`, // Nombre de la tabla principal
    columnas: {
      id: "Código único del registro de escandallo (Clave Primaria).",
      PEI_PAR: "Código de la partida asociada (Ej: '17001696').",
      PEI_ALV: "Cantidad de alveolos (Ej: '104').",
      PEI_HUE: "Cantidad de huecos (Ej: '53').",
      PEI_ETIQ: "Etiqueta del injerto o bandeja (Ej: '0000169600288').",
      PEI_PLAN: "Cantidad de plantas (Ej: '0').",
      PEI_BAND: "Cantidad de bandejas (Ej: '2').",
      PEI_FEC: "Fecha de registro (Ej: '2017-06-22').",
      PEI_HORA: "Hora de registro (Ej: '17:19').",
      PEI_CDOP: "Código del operario (Ej: '0205').",
    },
    relaciones: {
      // Se podría inferir una relación con 'partidas' a través de PEI_PAR, 
      // pero no se describe explícitamente en el texto proporcionado.
      // Si PEI_PAR es una clave foránea a 'partidas.id', la relación sería:
      /*
      partidas: {
        tabla_relacionada: "partidas",
        tipo: "Muchos a uno",
        campo_enlace_local: "PEI_PAR",
        campo_enlace_externo: "id",
        descripcion: "Vincula el escandallo de injertos con la partida de siembra a la que pertenece."
      }
      */
    },
    ejemplos: {
      consulta_escandallo_por_id:
        "Obtener todos los detalles de un registro de escandallo específico usando su 'id'.",
      filtrar_por_partida:
        "Listar todos los registros de escandallo asociados a un código de partida específico (filtrando por PEI_PAR).",
      filtrar_por_fecha_rango:
        "Buscar registros de escandallo en una fecha o rango de fechas (filtrando por PEI_FEC).",
      buscar_por_etiqueta:
        "Encontrar un registro de escandallo específico usando su etiqueta (filtrando por PEI_ETIQ).",
      analisis_produccion_por_operario:
        "Agrupar y analizar los datos de escandallo por operario (PEI_CDOP) para evaluar la producción de injertos.",
    },
  },


/* ======================================================================================================================================================================*/

/* ================================================*/
/* Injertos Y Abonados - Injertos por fases – Técnicos fases */
/* ================================================*/
tecnicos_fases: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Registra la asignación de técnicos a diferentes fases de los injertos por partida y fecha. Detalla qué técnicos trabajaron en una fase específica de una partida y la cantidad de bandejas asociadas a su trabajo.",
    tabla: `tecnicos_fases`, // Nombre de la tabla principal
    columnas: {
      id: "Código único de registro para la asignación de técnicos a una fase (Clave Primaria).",
      TF_FEC: "Fecha en que se realizó la asignación o el trabajo en la fase (Ej: '2017-02-08').",
      TF_PAR: "Número de partida. Clave foránea a la tabla 'partidas' (Ej: '15024361').",
      TF_FASE: "Número o identificador de la fase (Ej: '2').",
      TF_LNA: "Valor opcional (actualmente NULL). Puede usarse para observaciones o control interno.",
    },
    relaciones: {
      partidas: {
        tabla_relacionada: "partidas",
        tipo: "Muchos a uno",
        campo_enlace_local: "TF_PAR",
        campo_enlace_externo: "id",
        descripcion: "Vincula el registro de técnicos por fase con la partida de siembra correspondiente.",
      },
      tecnicos_fases_tf_lna: {
        tabla_relacionada: "tecnicos_fases_tf_lna",
        tipo: "Uno a muchos (un registro de 'tecnicos_fases' puede tener múltiples técnicos/bandejas)",
        campo_enlace_local: "id", // ID del registro principal de tecnicos_fases
        campo_enlace_externo: "id", // ID que referencia al registro principal en la tabla de detalle
        descripcion: "Detalla los técnicos que trabajaron en esta fase específica y la cantidad de bandejas que gestionaron.",
        estructura_relacionada: {
          id: "ID del registro principal de técnicos por fase.",
          id2: "Identificador secuencial para cada técnico dentro del registro (Ej: '1', '2', etc.).",
          C0: "Código del técnico que trabajó en esta fase. Clave foránea a la tabla 'tecnicos'.",
          C1: "Número de bandejas gestionadas por el técnico en esta fase (Ej: '64.0').",
        },
        relaciones_internas_de_detalle: {
          tecnicos: {
            tabla_relacionada: "tecnicos",
            tipo: "Muchos a uno",
            campo_enlace_local: "C0",
            campo_enlace_externo: "id",
            descripcion: "Vincula el detalle del trabajo por fase con la información completa del técnico (ej. nombre: TN_DENO).",
          },
        },
      },
    },
    ejemplos: {
      consulta_tecnicos_fases_por_id:
        "Obtener la fecha, partida y fase de un registro específico de asignación de técnicos por fase usando su 'id'.",
      consultar_tecnicos_y_bandejas_por_fase:
        "Para un registro específico de 'tecnicos_fases', consultar la tabla 'tecnicos_fases_tf_lna' para ver qué técnicos trabajaron y cuántas bandejas manejaron en esa fase, incluyendo la denominación de cada técnico.",
      filtrar_por_partida_y_fase:
        "Listar los registros de asignación de técnicos para una partida y fase específicas (filtrando por TF_PAR y TF_FASE).",
      analisis_productividad_tecnico:
        "Calcular la cantidad total de bandejas que un técnico específico ha gestionado en una fase o periodo determinado, uniendo 'tecnicos_fases_tf_lna' con 'tecnicos' y filtrando por C0 y/o TF_FEC.",
    },
  },




/* ================================================*/
/* Injertos Y Abonados - Injertos por fases – Partes injertos sandía */
/* ================================================*/

p_inj_sandia: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Registra los partes de injerto de sandía, documentando la máquina 'enterradora' y el operario que realizaron el injerto, la partida de siembra asociada, el número de bandejas procesadas, la fecha y hora de la operación, y una etiqueta identificativa. También incluye un código de operario más corto.",
    tabla: `p-inj-sandia`, // Nombre de la tabla principal
    columnas: {
      id: "Código identificador interno del registro (Clave Primaria).",
      PIS_ENT: "Identificador de la máquina 'enterradora' (Ej: '03701130047404').",
      PIS_OPE: "Identificador del operario (Ej: '03802190028065').",
      PIS_PAR: "Código de la partida asociada. Clave foránea a la tabla 'partidas' (Ej: '21000092').",
      PIS_NBAN: "Número de bandejas (Ej: '1').",
      PIS_FEC: "Fecha de la operación (Ej: '06/04/2021').",
      PIS_HORA: "Hora de la operación (Ej: '17:14').",
      PIS_ETIQ: "Etiqueta identificativa del registro (Ej: '000009200364').",
      PIS_CDOP: "Código corto del operario (Ej: '0219').",
    },
    relaciones: {
      partidas: {
        tabla_relacionada: "partidas",
        tipo: "Muchos a uno",
        campo_enlace_local: "PIS_PAR",
        campo_enlace_externo: "id",
        descripcion: "Vincula el parte de injerto de sandía con la partida de siembra correspondiente.",
      },
      // Podría haber relaciones con tablas para 'enterradora' y 'operario'
      // si los campos PIS_ENT y PIS_OPE son claves foráneas a tablas específicas,
      // pero no se ha proporcionado esa información explícitamente.
    },
    ejemplos: {
      consulta_parte_injerto_por_id:
        "Obtener los detalles de un parte de injerto de sandía específico usando su 'id'.",
      filtrar_por_partida:
        "Listar todos los partes de injerto de sandía asociados a una partida específica (filtrando por PIS_PAR).",
      filtrar_por_fecha_rango:
        "Buscar partes de injerto de sandía registrados en una fecha o rango de fechas (filtrando por PIS_FEC).",
      analisis_productividad_operario:
        "Calcular el número de bandejas injertadas por un operario específico en un periodo determinado, usando PIS_CDOP y PIS_NBAN.",
    },
  },




/* ================================================*/
/* Injertos Y Abonados - Injertos por fases – Partes injertos tomate */
/* ================================================*/
p_inj_tomate: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Registra los partes de injerto de tomate, documentando al operario que realizó el injerto, la partida de siembra asociada, el número de bandejas procesadas, la fecha y hora de la operación, y una etiqueta identificativa. Incluye tanto un identificador largo como un código corto para el operario.",
    tabla: `p-inj-tomate`, // Nombre de la tabla principal
    columnas: {
      id: "Campo oculto, identificador interno del registro (Clave Primaria).",
      PIT_OPE: "Identificador de la etiqueta del operario (número largo, Ej: '03804500008606').",
      PIT_PAR: "Código de la partida asociada. Clave foránea a la tabla 'partidas' (Ej: '15024324').",
      PIT_NBAN: "Número de bandejas (Ej: '1').",
      PIT_FEC: "Fecha de la operación (Ej: '26/05/2017').",
      PIT_HORA: "Hora de la operación (Ej: '17:39').",
      PIT_ETIQ: "Etiqueta identificativa del registro (Ej: '0002432400182').",
      PIT_CDOP: "Código corto del operario (Ej: '8045').",
    },
    relaciones: {
      partidas: {
        tabla_relacionada: "partidas",
        tipo: "Muchos a uno",
        campo_enlace_local: "PIT_PAR",
        campo_enlace_externo: "id",
        descripcion: "Vincula el parte de injerto de tomate con la partida de siembra correspondiente.",
      },
      // Podría haber una relación con una tabla de 'operarios' o 'personal'
      // si los campos PIT_OPE o PIT_CDOP son claves foráneas a tablas específicas,
      // pero esa información no se ha proporcionado explícitamente.
    },
    ejemplos: {
      consulta_parte_injerto_por_id:
        "Obtener los detalles de un parte de injerto de tomate específico usando su 'id'.",
      filtrar_por_partida:
        "Listar todos los partes de injerto de tomate asociados a una partida específica (filtrando por PIT_PAR).",
      filtrar_por_fecha_rango:
        "Buscar partes de injerto de tomate registrados en una fecha o rango de fechas (filtrando por PIT_FEC).",
      analisis_productividad_operario:
        "Calcular el número de bandejas injertadas por un operario específico en un periodo determinado, usando PIT_CDOP y PIT_NBAN.",
    },
  },






/* ======================================================================================================================================================================*/
/* VENTAS                                                                                                                                                       */
/* ======================================================================================================================================================================*/

 /* ================================================*/
/* Ventas – Gestion – Encargos de siembra */
/* ================================================*/
encargos: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Registra los encargos de siembra de los clientes, incluyendo información del cliente, almacén, fecha, vendedor, forma de pago y estado. Contiene relaciones con observaciones, costes adicionales, reservas de plantas y las partidas de siembra asociadas.",
    tabla: `encargos`, // Nombre de la tabla principal
    columnas: {
      id: "Número de encargo (Clave Primaria)",
      ENG_CCL: "Código del cliente. Clave foránea a la tabla 'clientes' para obtener la denominación (CL_DENO).",
      ENG_ALM: "Código del almacén. Clave foránea a la tabla 'almacenes' para obtener la denominación (AM_DENO).",
      ENG_FEC: "Fecha del encargo de siembra.",
      ENG_VD: "Vendedor que gestionó el encargo. Clave foránea a la tabla 'vendedores' para obtener la denominación (VD_DENO).",
      ENG_FP: "Forma de pago. Clave foránea a la tabla 'fpago' para obtener la denominación (FP_DENO).",
      ENG_EST: "Estado del encargo ('C': Cerrado).",
      ENG_USUG: "Usuario que gestionó el encargo.",

    },
    relaciones: {
      clientes: {
        tabla_relacionada: "clientes",
        tipo: "Muchos a uno",
        campo_enlace_local: "ENG_CCL",
        campo_enlace_externo: "id",
        descripcion: "Vincula el encargo con el cliente.",
      },
      almacenes: {
        tabla_relacionada: "almacenes",
        tipo: "Muchos a uno",
        campo_enlace_local: "ENG_ALM",
        campo_enlace_externo: "id",
        descripcion: "Vincula el encargo con el almacén.",
      },
      vendedores: {
        tabla_relacionada: "vendedores",
        tipo: "Muchos a uno",
        campo_enlace_local: "ENG_VD",
        campo_enlace_externo: "id",
        descripcion: "Vincula el encargo con el vendedor.",
      },
      fpago: {
        tabla_relacionada: "fpago",
        tipo: "Muchos a uno",
        campo_enlace_local: "ENG_FP",
        campo_enlace_externo: "id",
        descripcion: "Vincula el encargo con la forma de pago.",
      },
      encargos_eng_obs: {
        tabla_relacionada: "encargos_eng_obs",
        tipo: "Uno a muchos (un encargo puede tener varias observaciones)",
        campo_enlace_local: "id", // ID del encargo
        campo_enlace_externo: "id", // ID del encargo en la tabla de observaciones
        descripcion: "Tabla de observaciones generales del encargo.",
        estructura_relacionada: {
          id: "ID del encargo.",
          id2: "Identificador secuencial de la observación.",
          C0: "Observación general.",
        },
      },
      encargos_eng_lna: {
        tabla_relacionada: "encargos_eng_lna",
        tipo: "Uno a muchos (un encargo puede tener varios costes adicionales)",
        campo_enlace_local: "id", // ID del encargo
        campo_enlace_externo: "id", // ID del encargo en la tabla de costes
        descripcion: "Tabla de costes adicionales del encargo.",
        estructura_relacionada: {
          id: "ID del encargo.",
          id2: "Identificador secuencial del coste adicional.",
          C0: "Artículo del coste adicional. Clave foránea a la tabla 'articulos'.",
          C1: "Tipo Sobre.",
          C2: "Número viajes.",
          C3: "Precio.",
        },
        relaciones_internas_de_detalle: {
          articulos: {
            tabla_relacionada: "articulos",
            tipo: "Muchos a uno",
            campo_enlace_local: "C0",
            campo_enlace_externo: "id",
            descripcion: "Vincula el coste adicional con el artículo.",
          },
        },
      },
      encargos_eng_rese: {
        tabla_relacionada: "encargos_eng_rese",
        tipo: "Uno a muchos (un encargo puede tener varias reservas de plantas)",
        campo_enlace_local: "id", // ID del encargo
        campo_enlace_externo: "id", // ID del encargo en la tabla de reservas
        descripcion: "Tabla de reservas de plantas del encargo.",
        estructura_relacionada: {
          id: "ID del encargo.",
          id2: "Identificador secuencial de la reserva.",
          C0: "Artículo/semilla reservada. Clave foránea a la tabla 'articulos'.",
          C1: "Fecha.",
          C2: "Campo sin información.",
          C3: "Cantidad de plantas.",
          C4: "Cantidad de bandejas.",
          C5: "Servidas.",
          C6: "Número de partida asignado a esta reserva.",
        },
        relaciones_internas_de_detalle: {
          articulos: {
            tabla_relacionada: "articulos",
            tipo: "Muchos a uno",
            campo_enlace_local: "C0",
            campo_enlace_externo: "id",
            descripcion: "Vincula la reserva con el artículo/semilla.",
          },
        },
      },
      partidas: {
        tabla_relacionada: "partidas",
        tipo: "Uno a muchos (un encargo puede generar varias partidas)",
        campo_enlace_local: "id", // ID del encargo
        campo_enlace_externo: "PAR_ENC", // Campo en partidas que referencia el ID del encargo
        descripcion: "Vincula el encargo con las partidas de siembra asociadas.",
        estructura_relacionada_partidas: { // Detalles de la tabla 'partidas' relevantes
          id: "ID de la partida.",
          PAR_FEC: "Fecha de partida.",
          PAR_TIPO: "Tipo de semilla (D/N).",
          PAR_SEM: "Semilla utilizada. Clave foránea a 'articulos'.",
          PAR_LOTE: "Lote.",
          PAR_PGER: "% de germinación.",
          PAR_TSI: "Tipo de siembra. Clave foránea a 't-siembras'.",
          PAR_CCL: "Id del cliente",
          PAR_ALVS: "Semillas a sembrar.",
          PAR_PLAS: "Plantas solicitadas.",
          PAR_PLAP: "Plantas aproximadas.",
          PAR_PLS: "Alveolos solicitados.",
          PAR_BASI: "Bandejas Siembra.",
          PAR_FECS: "Fecha Siembra.",
          PAR_DIASS: "Días de siembra.",
          PAR_FECE: "Fecha de entrega.",
          PAR_DIASG: "Días de germinación.",
          PAR_PPLA: "Planta.",
          PAR_PALV: "Alveolos.",
          PAR_TOT: "Total.",
          PAR_DENO: "Denominación/Observación de la partida.",
          PAR_FECES: "Fecha solicitada/entrega/siembra.",
          PAR_PMER: "Nombre.",
          
          PAR_NMSM: "Nombre de semilla",
        },
        relaciones_internas_de_partidas: {
          articulos: {
            tabla_relacionada: "articulos",
            tipo: "Muchos a uno",
            campo_enlace_local: "PAR_SEM",
            campo_enlace_externo: "id",
            descripcion: "Vincula la partida con la semilla utilizada.",
          },
          t_siembras: {
            tabla_relacionada: "t-siembras",
            tipo: "Muchos a uno",
            campo_enlace_local: "PAR_TSI",
            campo_enlace_externo: "id",
            descripcion: "Vincula la partida con el tipo de siembra.",
          },
          sustratos: {
            tabla_relacionada: "sustratos",
            tipo: "Muchos a uno",
            
            campo_enlace_externo: "id",
            descripcion: "Vincula la partida con el sustrato utilizado.",
          },
        },
      },
    },
    ejemplos: {
      consulta_encargo_por_id:
        "Obtener los detalles generales de un encargo de siembra usando su 'id'.",
      consultar_info_relacionada:
        "Para un encargo, obtener información del cliente, almacén, vendedor y forma de pago.",
      consultar_observaciones:
        "Para un encargo, listar las observaciones generales.",
      consultar_costes_adicionales:
        "Para un encargo, listar los costes adicionales y los artículos asociados.",
      consultar_reservas_plantas:
        "Para un encargo, listar las reservas de plantas y los artículos/semillas reservadas.",
      consultar_partidas_asociadas:
        "Para un encargo, listar las partidas de siembra asociadas y sus detalles.",
      filtrar_encargos_por_cliente_fecha_o_vendedor:
        "Listar encargos por cliente, fecha o vendedor.",
    },
  },












  remesas_mov: {
    descripcion:
      "Esta tabla registra todos los movimientos asociados a las remesas de semillas, articulos, semillas en camara dentro de la empresa. Refleja tanto los ingresos por depósito como los consumos realizados durante el proceso productivo. Cada movimiento incluye información del tipo de operación, fechas, sobres y unidades involucradas.",
    tabla: "remesas_mov",
    columnas: {
      id: "Identificador único del movimiento de remesa",
      REM_REA: "ID de la remesa asociada (remesas_art)",
      REM_RELA: "Relación opcional con otros movimientos o depósitos",
      REM_TIPO: "Tipo de movimiento (por ejemplo: 'Deposito', 'PDA')",
      REM_FEM: "Fecha efectiva del movimiento",
      REM_FEA: "Fecha administrativa del movimiento",
      REM_FEU: "Fecha de última edición del movimiento",
      REM_UDS: "Cantidad de sobres involucrados en el movimiento",
      REM_UXE: "Unidades asociadas al movimiento (por ejemplo, semillas)",
    },
    relaciones: [
      {
        tablaDestino: "remesas_art",
        campoOrigen: "REM_REA",
        campoDestino: "id",
        tipo: "muchos-a-uno",
        uso: "Permite identificar a qué remesa pertenece este movimiento",
      },
      {
        tablaDestino: "deposito",
        campoOrigen: "REM_RELA",
        campoDestino: "id",
        tipo: "opcional",
        uso: "En algunos casos, vincula el movimiento a un depósito original",
      }
    ],
  },
  











/* ================================================*/
/* Ventas – Gestion – Orden de Recogida */
/* ================================================*/


p_carga: {
  // Clave principal (nombre de tabla)
  descripcion:
    "Registra las órdenes de recogida (cargas) de clientes, incluyendo información del cliente, almacén, albarán, forma de pago, estado y datos de PDA. Se vincula con las partidas de siembra a recoger a través de la tabla 'p-carga_pca_par'.",
  tabla: `p-carga`, // Nombre de la tabla principal
  columnas: {
    id: "Número de orden de recogida (Clave Primaria).",
    PCA_FEC: "Fecha del día de la orden de recogida.",
    PCA_HORA: "Hora del registro de la orden.",
    PCA_USU: "Usuario que gestionó la orden.",
    PCA_CCL: "Código del cliente. Clave foránea a la tabla 'clientes' para obtener la denominación (CL_DENO).",
    PCA_ALB: "Número de albarán asociado.",
    PCA_TIPO: "Tipo de orden (código interno).",
    PCA_TALB: "Tipo de albarán (código interno).",
    PCA_ALM: "Código del almacén. Clave foránea a la tabla 'almacenes' para obtener la denominación (AM_DENO).",
    PCA_FP: "Forma de pago. Clave foránea a la tabla 'fpago' para obtener la denominación (FP_DENO).",
    PCA_EST: "Estado de la orden de recogida.",
    PCA_DFI: "Descripción de la finca vinculada a la recogida.",
    PCA_USUA: "Usuario encargado del alta de la orden.",
    PCA_UPDA: "Número de técnico PDA.",
    PCA_EPDA: "Indica si fue leído en PDA.",
    PCA_ENVPDA: "Indica si fue enviado desde PDA.",
    PCA_CLFAC: "Cliente de facturación. Clave foránea a 'clientes' para obtener la denominación (CL_DENO).",
    PCA_TNPDA: "Número de técnico PDA (sin relación a otra tabla).",
    PCA_UEP: "Usuario encargado de la gestión en PDA.",
    PCA_FEP: "Fecha de entrada en PDA.",
    PCA_HEP: "Hora de entrada en PDA.",
    PCA_FCP: "Fecha de cierre en PDA.",
    PCA_HCP: "Hora de cierre en PDA.",
    PCA_RUTA: "Ruta de recogida. Clave foránea a la tabla 'rutas' para obtener la denominación (RU_DENO).",
  },
  relaciones: {
    clientes: {
      tabla_relacionada: "clientes",
      tipo: "Muchos a uno",
      campo_enlace_local: "PCA_CCL",
      campo_enlace_externo: "id",
      descripcion: "Vincula la orden de recogida con el cliente principal.",
    },
    clientes_facturacion: {
      tabla_relacionada: "clientes",
      tipo: "Muchos a uno",
      campo_enlace_local: "PCA_CLFAC",
      campo_enlace_externo: "id",
      descripcion: "Vincula la orden con el cliente de facturación.",
    },
    almacenes: {
      tabla_relacionada: "almacenes",
      tipo: "Muchos a uno",
      campo_enlace_local: "PCA_ALM",
      campo_enlace_externo: "id",
      descripcion: "Vincula la orden con el almacén de salida.",
    },
    fpago: {
      tabla_relacionada: "fpago",
      tipo: "Muchos a uno",
      campo_enlace_local: "PCA_FP",
      campo_enlace_externo: "id",
      descripcion: "Vincula la orden con la forma de pago.",
    },
    rutas: {
      tabla_relacionada: "rutas",
      tipo: "Muchos a uno",
      campo_enlace_local: "PCA_RUTA",
      campo_enlace_externo: "id",
      descripcion: "Vincula la orden con la ruta de distribución/recogida.",
    },
    p_carga_pca_par: {
      tabla_relacionada: "p-carga_pca_par",
      tipo: "Uno a muchos (una orden puede tener varias partidas asociadas)",
      campo_enlace_local: "id", // ID de la orden de recogida
      campo_enlace_externo: "id", // ID de la orden en la tabla de partidas
      descripcion: "Partidas de siembra que forman parte de la orden de recogida.",
      estructura_relacionada: {
        id: "ID de la orden de recogida.",
        id2: "Identificador secuencial de la partida dentro de la orden.",
        C0: "Código de la partida. Clave foránea a la tabla 'partidas' para obtener información detallada.",
        C1: "Código de cliente. Clave foránea a la tabla 'clientes' (CL_DENO).",
        C2: "Artículo de la partida. Clave foránea a la tabla 'articulos' (AR_DENO).",
        C3: "Invernadero (ejemplo: A2, A3).",
        C4: "Sección dentro del invernadero.",
        C5: "Fila asignada.",
        C6: "Columna asignada.",
        C7: "Número de bandejas de la partida.",
        C8: "Número de plantas correspondientes.",
      },
      relaciones_internas_de_detalle: {
        partidas: {
          tabla_relacionada: "partidas",
          tipo: "Muchos a uno",
          campo_enlace_local: "C0",
          campo_enlace_externo: "id",
          descripcion: "Vincula la partida de la orden con los detalles completos de siembra.",
        },
        clientes: {
          tabla_relacionada: "clientes",
          tipo: "Muchos a uno",
          campo_enlace_local: "C1",
          campo_enlace_externo: "id",
          descripcion: "Vincula la partida con el cliente correspondiente.",
        },
        articulos: {
          tabla_relacionada: "articulos",
          tipo: "Muchos a uno",
          campo_enlace_local: "C2",
          campo_enlace_externo: "id",
          descripcion: "Vincula la partida con el artículo/semilla asociada.",
        },
      },
    },
  },
  ejemplos: {
    consulta_por_id:
      "Obtener los detalles generales de una orden de recogida usando su 'id'.",
    consultar_info_relacionada:
      "Para una orden, obtener información del cliente, almacén, ruta y forma de pago.",
    consultar_partidas_asociadas:
      "Para una orden, listar las partidas de siembra asociadas con detalle (artículo, cliente, ubicación en invernadero, bandejas, plantas).",
    filtrar_por_cliente_fecha_o_ruta:
      "Listar órdenes de recogida filtradas por cliente, fecha o ruta.",
    consultar_estado_pda:
      "Verificar si una orden fue leída, enviada o cerrada desde PDA.",
  },
},





/* ================================================*/
/* Ventas – Gestion – Albaranes de Venta */
/* ================================================*/


albaran_venta_ornamental: {
    // Clave principal (basada en el nombre de la sección)
    descripcion:
      "Registra y gestiona los albaranes de venta. Documenta la salida de productos hacia clientes, crucial para control de inventario, confirmación de entregas y base para facturación.",
    tabla: "alb-venta", // Nombre de tabla inferido (campos con prefijo AV_)
    columnas: {
      id: "Identificador único de cada albarán de venta ornamental (Clave Primaria)",
      AV_NPD: "Número del pedido de venta del cliente asociado, si lo hay.", // Sugiere relación con tabla de pedidos de venta
      AV_CCL: "Número del cliente que recibió la mercancía. Clave foránea a la tabla 'clientes' para obtener la denominación (CL_DENO).",
      AV_VD: "Vendedor que gestionó la venta. Clave foránea a la tabla 'vendedores' para obtener la denominación (VD_DENO).",
      AV_ALM: "Almacén de Semilleros Deitana desde donde se expidió la mercancía. Clave foránea a la tabla 'almacenes' para obtener la denominación (AM_DENO).",
      AV_FEC: "Fecha en que se emitió el albarán.",
      AV_TIP: "Tipo de albarán o venta.",
      AV_FRA: "Número de la factura asociada a este albarán.", // Sugiere relación con tabla de facturas de venta
      AV_FFR: "Fecha de la factura asociada.", // Sugiere relación con tabla de facturas de venta
      AV_BRU: "Monto bruto total del albarán.",
      AV_NETO: "Monto neto del albarán.",
      AV_IMPU: "Importe total de los impuestos aplicados.",
      AV_TTT: "Monto total final del albarán.",
      AV_ORIVTA: "Origen o canal específico de esta venta ornamental.",
      AV_FP: "Forma de pago acordada para esta venta. Clave foránea a la tabla 'fpago' para obtener la denominación (FP_DENO).",
    },
    relaciones: {
      clientes: {
        tabla_relacionada: "clientes",
        tipo: "Muchos a uno",
        campo_enlace_local: "AV_CCL",
        campo_enlace_externo: "id",
        descripcion: "Vincula el albarán con el cliente que recibió la mercancía.",
      },
      vendedores: {
        tabla_relacionada: "vendedores",
        tipo: "Muchos a uno",
        campo_enlace_local: "AV_VD",
        campo_enlace_externo: "id",
        descripcion: "Vincula el albarán con el vendedor que gestionó la venta.",
      },
      almacenes: {
        tabla_relacionada: "almacenes",
        tipo: "Muchos a uno",
        campo_enlace_local: "AV_ALM",
        campo_enlace_externo: "id",
        descripcion: "Vincula el albarán con el almacén desde donde se expidió la mercancía.",
      },
      fpago: {
        tabla_relacionada: "fpago",
        tipo: "Muchos a uno",
        campo_enlace_local: "AV_FP",
        campo_enlace_externo: "id",
        descripcion: "Vincula el albarán con la forma de pago acordada para la venta.",
      },
      // Relaciones potenciales inferidas:
      pedidos_venta: {
        tabla_relacionada: "[Tabla de Pedidos de Venta]", // Nombre de tabla no especificado
        tipo: "Muchos a uno (un albarán puede provenir de un pedido)", // Tipo inferido
        campo_enlace_local: "AV_NPD", // El campo que contiene el número/id del pedido
        campo_enlace_externo: "[Campo id/número en tabla de pedidos de venta]", // Nombre de campo no especificado
        descripcion_inferida:
          "Sugiere vínculo con una tabla de pedidos de venta, permitiendo trazar el albarán al pedido original si existe.",
      },
      facturas_venta: {
        tabla_relacionada: "[Tabla de Facturas de Venta]", // Nombre de tabla no especificado (ej: facturas-e)
        tipo: "Uno a uno o Uno a cero-o-uno (un albarán se asocia a una factura o ninguna)", // Tipo inferido
        campo_enlace_local: "AV_FRA", // El campo que contiene el número/id de la factura
        campo_enlace_externo: "[Campo id/número en tabla de facturas de venta]", // Nombre de campo no especificado
        descripcion_inferida:
          "Sugiere vínculo con una tabla de facturas de venta, permitiendo asociar el albarán a la factura emitida.",
      },
    },
    ejemplos: {
      consulta_albaran_por_id:
        "Obtener los detalles de un albarán de venta ornamental específico usando su 'id'.",
      consultar_info_relacionada:
        "Para un albarán, usar AV_CCL, AV_VD, AV_ALM y AV_FP para consultar 'clientes', 'vendedores', 'almacenes' y 'fpago' y obtener los nombres del cliente, vendedor, almacén y forma de pago.",
      filtrar_albaranes_por_cliente_o_fecha:
        "Listar albaranes de venta ornamental emitidos a un cliente específico (filtrando por AV_CCL) o en una fecha o rango de fechas (filtrando por AV_FEC).",
      filtrar_albaranes_por_vendedor_o_almacen:
        "Buscar albaranes gestionados por un vendedor (filtrando por AV_VD) o expedidos desde un almacén particular (filtrando por AV_ALM).",
      filtrar_albaranes_por_origen_venta:
        "Encontrar albaranes asociados a un origen o canal de venta específico (filtrando por AV_ORIVTA).",
    },
  },



/* ================================================*/
/* Ventas – Gestion – Devoluciones clientes */
/* ================================================*/
devol_clientes: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Registra las devoluciones de los clientes, incluyendo la fecha, el usuario que gestionó la devolución, la delegación donde se realizó, y el cliente que hizo la devolución. Contiene relaciones con los carros devueltos y las observaciones sobre la devolución.",
    tabla: `devol-clientes`, // Nombre de la tabla principal
    columnas: {
      id: "Número de devolución (Clave Primaria).",
      DV_FEC: "Fecha de la devolución.",
      DV_USU: "Usuario/vendedor que gestionó la devolución. Clave foránea a la tabla 'vendedores' para obtener la denominación (VD_DENO).",
      DV_DEL: "Delegación donde se realizó la devolución. Clave foránea a la tabla 'almacenes' para obtener la denominación (AM_DENO).",
      DV_CCL: "Cliente que realizó la devolución. Clave foránea a la tabla 'clientes' para obtener la denominación (CL_DENO).",
    },
    relaciones: {
      vendedores: {
        tabla_relacionada: "vendedores",
        tipo: "Muchos a uno",
        campo_enlace_local: "DV_USU",
        campo_enlace_externo: "id",
        descripcion: "Vincula la devolución con el vendedor que la gestionó.",
      },
      almacenes: {
        tabla_relacionada: "almacenes",
        tipo: "Muchos a uno",
        campo_enlace_local: "DV_DEL",
        campo_enlace_externo: "id",
        descripcion: "Vincula la devolución con la delegación donde se realizó.",
      },
      clientes: {
        tabla_relacionada: "clientes",
        tipo: "Muchos a uno",
        campo_enlace_local: "DV_CCL",
        campo_enlace_externo: "id",
        descripcion: "Vincula la devolución con el cliente que la realizó.",
      },
      devol_clientes_dv_ccar: {
        tabla_relacionada: "devol-clientes_dv_ccar",
        tipo: "Uno a muchos (una devolución puede involucrar múltiples carros)",
        campo_enlace_local: "id", // ID de la devolución
        campo_enlace_externo: "id", // ID de la devolución en la tabla de detalle
        descripcion: "Tabla de enlace que relaciona devoluciones con los carros devueltos.",
        estructura_relacionada: {
          id: "ID de la devolución.",
          id2: "Identificador secuencial del carro devuelto.",
          C0: "Código del carro devuelto. Clave foránea a la tabla 'carros'.",
        },
        relaciones_internas_de_detalle: {
          carros: {
            tabla_relacionada: "carros",
            tipo: "Muchos a uno",
            campo_enlace_local: "C0",
            campo_enlace_externo: "id",
            descripcion: "Vincula el carro devuelto con su información detallada.",
          },
        },
      },
      devol_clientes_dv_obs: {
        tabla_relacionada: "devol-clientes_dv_obs",
        tipo: "Uno a muchos (una devolución puede tener múltiples observaciones)",
        campo_enlace_local: "id", // ID de la devolución
        campo_enlace_externo: "id", // ID de la devolución en la tabla de observaciones
        descripcion: "Tabla de observaciones sobre la devolución.",
        estructura_relacionada: {
          id: "ID de la devolución.",
          id2: "Identificador secuencial de la observación.",
          C0: "Contenido de la observación.",
        },
      },
    },
    ejemplos: {
      consulta_devolucion_por_id:
        "Obtener los detalles generales de una devolución usando su 'id'.",
      consultar_info_relacionada:
        "Para una devolución, obtener información del vendedor, delegación y cliente asociados.",
      consultar_carros_devueltos:
        "Para una devolución, listar los carros que fueron devueltos y su información.",
      consultar_observaciones_devolucion:
        "Para una devolución, listar las observaciones registradas.",
      filtrar_devoluciones_por_fecha_o_cliente:
        "Listar devoluciones por fecha o por cliente.",
    },
  },


/* ================================================*/
/* Ventas – Gestion – Registro de Facturas Emitidas */
/* ================================================*/
facturas_e: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Registra y administra las facturas de venta emitidas por la empresa a sus clientes. Esta tabla es fundamental para la documentación de ventas, el control financiero y la gestión de cobros.",
    tabla: `facturas-e`, // Nombre de la tabla principal
    columnas: {
      id: "Número único de la factura (Clave Primaria).",
      FE_CCL: "Código del cliente al que se emitió la factura. Clave foránea a la tabla 'clientes' para obtener la denominación (CL_DENO).",
      FE_ALM: "Código del almacén relacionado con la venta. Clave foránea a la tabla 'almacenes' para obtener la denominación (AM_DENO).",
      FE_VD: "Vendedor que gestionó la venta. Clave foránea a la tabla 'vendedores' para obtener la denominación (VD_DENO).",
      FE_FEC: "Fecha de emisión de la factura.",
      FE_BRU: "Monto bruto total de la factura antes de impuestos o descuentos.",
      FE_NETO: "Monto neto de la factura.",
      FE_IMPU: "Monto total de los impuestos aplicados en la factura.",
      FE_TTT: "Monto total final de la factura.",
      FE_FP: "Forma de pago acordada para esta factura. Clave foránea a la tabla 'fpago' para obtener la denominación (FP_DENO).",
    },
    relaciones: {
      clientes: {
        tabla_relacionada: "clientes",
        tipo: "Muchos a uno",
        campo_enlace_local: "FE_CCL",
        campo_enlace_externo: "id",
        descripcion: "Vincula la factura con el cliente al que se le emitió.",
      },
      almacenes: {
        tabla_relacionada: "almacenes",
        tipo: "Muchos a uno",
        campo_enlace_local: "FE_ALM",
        campo_enlace_externo: "id",
        descripcion: "Vincula la factura con el almacén relevante de la venta.",
      },
      vendedores: {
        tabla_relacionada: "vendedores",
        tipo: "Muchos a uno",
        campo_enlace_local: "FE_VD",
        campo_enlace_externo: "id",
        descripcion: "Vincula la factura con el vendedor que gestionó la venta.",
      },
      fpago: {
        tabla_relacionada: "fpago",
        tipo: "Muchos a uno",
        campo_enlace_local: "FE_FP",
        campo_enlace_externo: "id",
        descripcion: "Vincula la factura con la forma de pago asociada.",
      },
      // Se podría incluir una relación con Albaranes de Venta si se confirma su vinculación.
      /*
      albaranes_venta: {
        tabla_relacionada: "albaranes_venta_ornamental", // O la tabla de albaranes general
        tipo: "Uno a muchos", // O muchos a muchos, dependiendo de la relación real
        campo_enlace_local: "id", // O el campo que vincule la factura al albarán
        campo_enlace_externo: "FE_ALB", // O el campo en la tabla de albaranes que referencia la factura
        descripcion: "Posible relación con los albaranes de venta que originaron la factura.",
      },
      */
    },
    ejemplos: {
      consulta_factura_por_id:
        "Obtener todos los detalles de una factura emitida específica usando su 'id'.",
      consultar_info_relacionada:
        "Para una factura, obtener la denominación del cliente, el nombre del almacén, la denominación del vendedor y la descripción de la forma de pago.",
      filtrar_facturas_por_cliente:
        "Listar todas las facturas emitidas a un cliente específico (filtrando por FE_CCL).",
      filtrar_facturas_por_fecha_rango:
        "Buscar facturas emitidas en un rango de fechas determinado (filtrando por FE_FEC).",
      analisis_ventas_por_vendedor:
        "Calcular el total de ventas (FE_BRU, FE_NETO) por cada vendedor en un período, agrupando por FE_VD y sumando los montos.",
    },
  },


/* ================================================================================================================================================*/

/* ================================================*/
/* Ventas - Otros - Partidas */
/* ================================================*/
partidas: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Registra las partidas de siembra, vinculadas a los encargos de los clientes. Contiene información sobre la fecha, tipo de semilla (propia o no), la semilla utilizada, lote, germinación, tipo de siembra, sustrato, cantidades (semillas, plantas, alveolos, bandejas), fechas (siembra, entrega, solicitada) y denominación/observaciones.",
    tabla: `partidas`, // Nombre de la tabla principal
    columnas: {
      id: "ID de la partida (Clave Primaria)",
      PAR_FEC: "Fecha de la partida.",
      PAR_ENC: "Número del encargo asociado. Clave foránea a la tabla 'encargos'.",
      PAR_TIPO: "Tipo de partida: 'N' - Normal, sembrada sin injerto, 'C' - Componente de injerto (pie o cabeza), 'I' - Injerto completo (pie y cabeza ya unidos),  'D' - Descocada, planta regenerada por exceso de altura, 'O' - Comprada a otro semillero en caso de emergencia, 'X' - Componente externo (pie o cabeza comprado a otro semillero para injertar).",
      PAR_SEM: "Semilla utilizada. Clave foránea a la tabla 'articulos' para obtener la denominación (AR_DENO).",
      PAR_CCL: "Id del cliente, tiene relacion con la tabla 'clientes'. para obtener la denominación (CL_DENO).",
      PAR_CAS: "Id de casa comercial, tiene relacion con la tabla 'casas_com'. para obtener la denominación (CC_DENO).",
      PAR_LOTE: "Lote de la semilla.",
      PAR_PGER: "Porcentaje de germinación.",
      PAR_TSI: "Tipo de siembra. Clave foránea a la tabla 't-siembras' para obtener la denominación (TSI_DENO) y detalles.",
      PAR_SSI: "Tipo de bandeja a utilizar, tiene relacion con la tabla 'bandejas'. para obtener la denominación (BN_DENO).",
      PAR_ALVP1: "Cantidad de Alveolos de la bandeja",
      PAR_PPA1: "Plantas por Alveolo",
      PAR_PPB1: "Plantas por Bandeja",
      PAR_SUS: "Sustrato a utilizar, tiene relacion con la tabla 'sustratos'. para obtener la denominación (SUS_DENO).",
      PAR_ALVS: "Cantidad de semillas a sembrar.",
      PAR_PLAS: "Cantidad de plantas solicitadas.",
      PAR_PLAP: "Cantidad de plantas aproximadas.",
      PAR_PLS: "Cantidad de alveolos solicitados.",
      PAR_BASI: "Cantidad de bandejas de siembra.",
      PAR_FECS: "Fecha de siembra.",
      PAR_DIASS: "Días de siembra.",
      PAR_FECE: "Fecha de entrega.",
      PAR_DIASG: "Días de germinación.",
      PAR_ENCL: "Trae semilla propia o no ('D': Depósito cliente, 'N': No depósito).",
      PAR_PSEM: "Precio de la semilla.",
      PAR_PBAN: "Precio de la bandeja.",
      PAR_PSUS: "Precio del sustrato.",
      PAR_PCRI: "Precio de la crianza",
      PAR_PPLA: "Precio por planta",
      PAR_PALV: "Precio por alveolo",
      PAR_PPBA: "Precio por bandeja",
      PAR_TOT: "Total",
      PAR_TBAC: "Situacion actual bandeja",
      PAR_STAC: "Situacion actual sustrato",
      PAR_EST: "Estado de la partida T significa terminado, C servido a cliente, R Apartado Cliente, si esto esta vacio, es por que esta en curso ",
      PAR_DENO: "Denominación u observación de la partida (Ej: 'PARTIDA Nº ...').",
      PAR_FECES: "Fechas (Solicitada 'E'/Entrega 'E'/Siembra 'S').",

      PAR_NMCL: "Nombre de el cliente",
      PAR_NMSM: "Nombre de la semilla",
    },
    relaciones: {
      encargos: {
        tabla_relacionada: "encargos",
        tipo: "Muchos a uno",
        campo_enlace_local: "PAR_ENC",
        campo_enlace_externo: "id",
        descripcion: "Vincula la partida con el encargo del cliente.",
      },
      articulos: {
        tabla_relacionada: "articulos",
        tipo: "Muchos a uno",
        campo_enlace_local: "PAR_SEM",
        campo_enlace_externo: "id",
        descripcion: "Vincula la partida con la semilla utilizada.",
      },
      t_siembras: {
        tabla_relacionada: "t-siembras",
        tipo: "Muchos a uno",
        campo_enlace_local: "PAR_TSI",
        campo_enlace_externo: "id",
        descripcion: "Vincula la partida con el tipo de siembra.",
      },
      sustratos: {
        tabla_relacionada: "sustratos",
        tipo: "Muchos a uno",
        
        campo_enlace_externo: "id",
        descripcion: "Vincula la partida con el sustrato utilizado.",
      },
      clientes: {
        tabla_relacionada: "clientes",
        tipo: "Muchos a uno",
        campo_enlace_local: "PAR_CCL", // Inferido del contexto de "encargos" -> "clientes"
        campo_enlace_externo: "id",
        descripcion: "Vincula la partida con el cliente (a través del encargo).",
      },
    },
    ejemplos: {
      consulta_partida_por_id:
        "Obtener los detalles de una partida específica usando su 'id'.",
      consultar_info_relacionada:
        "Para una partida, obtener información del encargo asociado, la semilla, el tipo de siembra y el sustrato.",
      filtrar_partidas_por_encargo:
        "Listar todas las partidas asociadas a un número de encargo específico (filtrando por PAR_ENC).",
      filtrar_partidas_por_fecha:
        "Listar partidas por fecha de partida o fecha de entrega.",
      filtrar_partidas_por_semilla:
        "Listar partidas donde se utilizó una semilla específica (filtrando por PAR_SEM).",
    },
  },

  partidas_par_esta: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Almacena el estado actual y detallado de cada partida de producción. Cada partida tiene exactamente 13 registros (`id2` del 1 al 13) que representan métricas clave como la cantidad de bandejas, alveolos y plantas en diferentes estados del ciclo de vida de la producción y venta.",
    tabla: `partidas_par_esta`, // Nombre de la tabla principal
    columnas: {
      id: "Código de la partida de producción. Clave foránea a la tabla `partidas`.",
      id2: "Indicador numérico (del 1 al 13) que define el tipo de estado o métrica de la fila.",
      C0: "Número de bandejas para el estado o métrica especificada en `id2`.",
      C1: "Número de alveolos para el estado o métrica especificada en `id2`.",
      C2: "Número de plantas para el estado o métrica especificada en `id2`.",
    },
    relaciones: {
      partidas: {
        tabla_relacionada: "partidas",
        tipo: "Muchos a uno", // Múltiples registros de estado para una sola partida
        campo_enlace_local: "id",
        campo_enlace_externo: "id", // Suponiendo 'id' es la clave primaria de 'partidas'
        descripcion: "Vincula las métricas de estado con la partida de producción a la que pertenecen.",
      },
    },
    descripcion_filas: {
      1: "Requerido Producción: Cantidad de producción planeada.",
      2: "Disponible para cliente: Cantidad de plantas listas para ser retiradas por el cliente.",
      3: "Retiro del cliente: Cantidad que el cliente ha retirado.",
      4: "Pendiente retirar cliente: Cantidad que el cliente aún no ha retirado.",
      5: "Tiradas: Plantas desechadas o perdidas.",
      6: "Disponible para venta: Plantas libres para la venta a cualquier cliente (plantas 'libres').",
      7: "Sembrado/Injertado: Cantidad total de plantas sembradas o injertadas inicialmente.",
      8: "Vendido total: Total de plantas que han sido vendidas.",
      9: "Actuales: Cantidad de plantas actualmente en stock físico.",
      10: "Descuadre actual: Diferencia o inconsistencia entre el stock físico y los registros (`id2` 9 y `id2` 7).",
      11: "Venta + Descuadre: Suma de la cantidad vendida y el descuadre.",
      12: "En recuperación: Plantas que están en proceso de recuperación.",
      13: "Reservas: Plantas que están reservadas para un cliente o propósito específico.",
    },
    ejemplos: {
      consulta_estado_completo:
        "Obtener las 13 filas de estado para una partida específica (ej. `25006219`) y analizar cada métrica (bandejas, alveolos, plantas).",
      analisis_disponibilidad_cliente:
        "Para una partida, comparar `id2` 2 (disponible para cliente) con `id2` 4 (pendiente retirar) y `id2` 3 (retirado) para entender el progreso de la entrega.",
      analisis_stock_y_pérdidas:
        "Comparar el `id2` 9 (actuales) con el `id2` 7 (sembrado/injertado) para evaluar las pérdidas, que se reflejarían en el `id2` 5 (tiradas) y `id2` 10 (descuadre).",
    },
  },


/* ================================================*/
partidas_par_ubic: {
  // Clave principal (nombre de tabla)
  descripcion:
    "Registra la ubicación física de las partidas de siembra, permitiendo un seguimiento detallado. Contiene información sobre el invernadero, sector, fila y número de bandeja para cada partida.",
  tabla: `partidas_par_ubic`, // Nombre de la tabla principal
  columnas: {
    id: "ID de la partida, clave foránea a la tabla 'partidas'.",
    id2: "Identificador secundario que aumenta si una partida se divide en varias ubicaciones.",
    C0: "Invernadero. Ejemplo: 'A1'.",
    C1: "Sector dentro del invernadero.",
    C2: "Fila",
    C4: "Bandejas que quedan",

  },
  relaciones: {
    partidas: {
      tabla_relacionada: "partidas",
      tipo: "Uno a muchos",
      campo_enlace_local: "id",
      campo_enlace_externo: "id",
      descripcion: "Vincula la ubicación con la partida de siembra a la que pertenece.",
    },
  },
  ejemplos: {
    consulta_ubicacion_por_partida:
      "Obtener la ubicación de una partida específica usando su 'id'.",
    filtrar_por_invernadero:
      "Listar todas las partidas ubicadas en un invernadero específico (filtrando por C0).",
    buscar_ubicacion_especifica:
      "Encontrar la partida que se encuentra en una ubicación exacta (ej. Invernadero 'A1', Sector 'B', Fila '3', Bandeja '10').",
    actualizar_ubicacion_partida:
      "Mover una partida a una nueva ubicación, actualizando los campos C0, C1, C2 y C3.",
  },
},


/* ================================================*/
/* Ventas - Otros - Proforma */
/* ================================================*/



/* ================================================*/
/* Ventas – Otros – Reservas */
/* ================================================*/
partidas_reserv: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Gestiona las reservas de diversos tipos de pedidos, como siembras normales, injertos o componentes. Es clave para el seguimiento de las reservas para un cliente, detallando la semilla, la germinación esperada y las particularidades del proceso de siembra.",
    tabla: `partidas_reserv`, // Nombre de la tabla principal
    columnas: {
      id: "Número de reserva (Clave Primaria).",
      PARR_FEC: "Fecha de la reserva.",
      PARR_ENC: "Número de encargo asociado a la reserva.",
      PARR_TIPO: "Tipo de encargo (ej: 'Normal', 'Injerto', 'Componente').",
      PARR_SEM: "Semilla a utilizar. Clave foránea a la tabla 'articulos' para obtener la denominación (AR_DENO).",
      PARR_CCL: "Código del cliente de la partida. Clave foránea a la tabla 'clientes' para obtener la denominación (CL_DENO).",
      PARR_LOTE: "Número de lote de la semilla.",
      PARR_PGER: "Porcentaje de germinación.",
      PARR_TSI: "Tipo de siembra. Clave foránea a la tabla 't-siembras' para obtener la denominación (TSI_DENO) y más información (TSI_NALV, TSI_PALV).",
      PARR_SUST: "Sustrato utilizado. Clave foránea a la tabla 'sustratos' para obtener la denominación (SUS_DENO).",
      PARR_ALVS: "Cantidad de semillas a sembrar.",
      PARR_PLAS: "Cantidad de plantas solicitadas.",
      PARR_PLAP: "Cantidad de plantas aproximadas.",
      PARR_PLS: "Cantidad de alveolos solicitados.",
      PARR_BASI: "Cantidad de bandejas de siembra.",
      PARR_FECS: "Fecha de siembra.",
      PARR_DIASS: "Días de siembra.",
      PARR_FECE: "Fecha de entrega.",
      PARR_DIASG: "Días de germinación.",
      PARR_PPLA: "Cantidad o identificador de planta.",
      PARR_PALV: "Cantidad o identificador de alveolos.",
      PARR_TOT: "Total (monto o cantidad).",
      PARR_DENO: "Denominación u observación de esta reserva (ej: 'PARTIDA Nº 15028052 DE COLIFLOR AGRIPA (ROMANESCO)').",
      PARR_FECES: "Fecha solicitada ('E' para Entrega, 'S' para Siembra).",
      PARR_PMER: "Nombre asociado (propósito a confirmar).",
      PARR_NMCL: "Nombre de la semilla.",
    },
    relaciones: {
      articulos: {
        tabla_relacionada: "articulos",
        tipo: "Muchos a uno",
        campo_enlace_local: "PARR_SEM",
        campo_enlace_externo: "id",
        descripcion: "Vincula la reserva con la semilla o artículo a utilizar.",
      },
      clientes: {
        tabla_relacionada: "clientes",
        tipo: "Muchos a uno",
        campo_enlace_local: "PARR_CCL",
        campo_enlace_externo: "id",
        descripcion: "Vincula la reserva con el cliente asociado.",
      },
      t_siembras: {
        tabla_relacionada: "t-siembras",
        tipo: "Muchos a uno",
        campo_enlace_local: "PARR_TSI",
        campo_enlace_externo: "id",
        descripcion: "Vincula la reserva con el tipo de siembra.",
      },
      sustratos: {
        tabla_relacionada: "sustratos",
        tipo: "Muchos a uno",
        campo_enlace_local: "PARR_SUST",
        campo_enlace_externo: "id",
        descripcion: "Vincula la reserva con el sustrato utilizado.",
      },
      // También podría haber una relación con la tabla 'encargos' a través de PARR_ENC,
      // si 'PARR_ENC' es una clave foránea que referencia 'encargos.id'.
      /*
      encargos: {
        tabla_relacionada: "encargos",
        tipo: "Muchos a uno",
        campo_enlace_local: "PARR_ENC",
        campo_enlace_externo: "id",
        descripcion: "Vincula la reserva con el encargo de siembra correspondiente.",
      },
      */
    },
    ejemplos: {
      consulta_reserva_por_id:
        "Obtener todos los detalles de una reserva específica usando su 'id'.",
      consultar_info_relacionada:
        "Para una reserva, obtener la denominación de la semilla, el nombre del cliente, el tipo de siembra y el sustrato utilizado.",
      filtrar_reservas_por_cliente_o_fecha:
        "Listar las reservas realizadas por un cliente específico o en un rango de fechas.",
      analisis_reservas_por_tipo_encargo:
        "Contar el número de reservas por cada 'PARR_TIPO' (Normal, Injerto, Componente).",
      seguimiento_reservas_por_lote_o_semilla:
        "Rastrear las reservas asociadas a un lote o una semilla en particular.",
    },
  },




/* ================================================*/
/* Ventas – Gestión Comercial – Futuros Clientes */
/* ================================================*/
fclientes: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Gestiona la información de clientes potenciales o 'futuros clientes' para el equipo de ventas. Incluye datos de contacto, fiscales, comerciales y detalles sobre su actividad, así como un historial de observaciones para el seguimiento de la prospección.",
    tabla: `fclientes`, // Nombre de la tabla principal
    columnas: {
      id: "Identificador único del futuro cliente (Clave Primaria).",
      FC_DENO: "Denominación fiscal o nombre completo de la empresa.",
      FC_NOM: "Nombre comercial o identificador secundario.",
      FC_DOM: "Domicilio o dirección física.",
      FC_POB: "Población o localidad.",
      FC_PROV: "Provincia.",
      FC_CDP: "Código postal.",
      FC_TEL: "Teléfono de contacto principal.",
      FC_FAX: "Número de fax principal.",
      FC_CIF: "Código de Identificación Fiscal o NIF.",
      FC_EMA: "Correo electrónico de contacto principal.",
      FC_WEB: "Página web del cliente.",
      FC_PAIS: "País.",
      FC_ACTI: "Actividad del cliente (ej. tipo de cultivo, industria).",
      FC_CON: "Persona de contacto principal.",
      FC_CAR: "Cargo o función de la persona de contacto (ej. 'Jefe Técnico').",
      FC_TIP: "Tipo de cliente (posiblemente código interno como 'A', 'B', 'C').",
      FC_VD: "Código de vendedor asignado al cliente.",
      FC_TFH: "Teléfono fijo habitual (puede coincidir con FC_TEL).",
      FC_THR: "Teléfono con horario restringido u horario preferente de contacto.",
      FC_TRES: "Teléfono de reservas o urgencias.",
      FC_VFH: "Fax habitual o principal.",
      FC_VHR: "Fax horario restringido o secundario.",
      FC_VRES: "Fax de reservas.",
      FC_FFH: "Fecha de alta o de la ficha habitual.",
      FC_FTF: "Fecha de modificación técnica de ficha.",
      FC_FRES: "Fecha de última reserva o último contacto.",
      FC_EFH: "Email habitual.",
      FC_ETE: "Email técnico o específico.",
      FC_ERES: "Email para reservas o urgencias.",
      FC_OBS: "Observaciones adicionales (puede ser una descripción corta o un resumen).",
      FC_SAC: "Código o nombre del técnico de Servicio de Atención al Cliente (SAC) asignado.",
      FC_SSA: "Segundo SAC o asistente.",
      FC_INT: "Intensidad de atención o nivel de cliente (posible código interno).",
      FC_CTD: "Código de cuenta o tipo de documento fiscal.",
      FC_FPAG: "Forma de pago (ej. 'contado', 'transferencia', 'pagaré').",
      FC_CCL: "Código contable del cliente.",
      FC_CAM: "Código de campaña o región comercial asignada.",
    },
    relaciones: {
      fclientes_fc_obs: {
        tabla_relacionada: "fclientes_fc_obs",
        tipo: "Uno a muchos (un futuro cliente puede tener múltiples observaciones)",
        campo_enlace_local: "id", // ID del futuro cliente en la tabla principal
        campo_enlace_externo: "id", // ID del futuro cliente en la tabla de observaciones
        descripcion: "Registra observaciones detalladas para el seguimiento y gestión de cada futuro cliente.",
        estructura_relacionada: {
          id: "ID del futuro cliente.",
          id2: "Identificador secuencial de la observación (para ordenar múltiples observaciones).",
          C0: "Contenido de la observación (ej. 'LECHUGA, BROCOLI, COLIFLOR...').",
        },
      },
      // Potencialmente, FC_VD podría ser una clave foránea a una tabla 'vendedores'
      // si se gestionan los vendedores en otra parte del sistema.
      /*
      vendedores: {
        tabla_relacionada: "vendedores",
        tipo: "Muchos a uno",
        campo_enlace_local: "FC_VD",
        campo_enlace_externo: "id",
        descripcion: "Vincula el futuro cliente con el vendedor asignado."
      }
      */
    },
    ejemplos: {
      consulta_futuro_cliente_por_id:
        "Obtener todos los detalles de un futuro cliente específico usando su 'id'.",
      consultar_observaciones_cliente:
        "Para un futuro cliente, listar todas las observaciones registradas en 'fclientes_fc_obs'.",
      buscar_clientes_por_poblacion_o_actividad:
        "Filtrar futuros clientes por 'FC_POB' (población) o 'FC_ACTI' (actividad) para campañas de marketing dirigidas.",
      seguimiento_contacto_y_fechas:
        "Monitorear la 'FC_FRES' (fecha de última reserva) para identificar clientes con los que no se ha contactado recientemente.",
      asignacion_y_seguimiento_vendedor:
        "Listar los futuros clientes asignados a un vendedor específico ('FC_VD') o a un técnico SAC ('FC_SAC').",
    },
  },















  /* ======================================================================================================================================================================*/
  /* COBROS                                                                                                                                                            */
  /* ======================================================================================================================================================================*/

  /* ================================================*/
  /* Cobros – General – Cartera de Cobros */
  /* ================================================*/
  cobros: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Administra la 'cartera de cobros', registrando documentos o partidas pendientes de cobro a clientes. Permite seguimiento de importes adeudados, fechas de vencimiento y vinculación con vendedor, cliente y banco.",
    tabla: "cobros", // Nombre de tabla original
    columnas: {
      id: "Identificador único de cada partida de cobro (Clave Primaria)",
      CB_VD: "Vendedor que originó la operación. Clave foránea a la tabla 'vendedores' para obtener la denominación (VD_DENO).",
      CB_CCL: "Cliente deudor. Clave foránea a la tabla 'clientes' para obtener la denominación (CL_DENO).",
      CB_FEC: "Fecha en la que se generó o registró la cartera de cobro.",
      CB_VTO: "Fecha de vencimiento del cobro.",
      CB_TIPO: "Tipo de la cartera de cobro (Ej: 'P', 'R').",
      CB_IMPO: "Importe monetario del cobro pendiente.",
      CB_BAN: "Entidad bancaria asociada al cobro. Clave foránea a la tabla 'bancos' para obtener la denominación (BA_DENO).",
    },
    relaciones: {
      vendedores: {
        tabla_relacionada: "vendedores",
        tipo: "Muchos a uno",
        campo_enlace_local: "CB_VD",
        campo_enlace_externo: "id",
        descripcion: "Vincula la partida de cobro con el vendedor que gestionó la operación.",
      },
      clientes: {
        tabla_relacionada: "clientes",
        tipo: "Muchos a uno",
        campo_enlace_local: "CB_CCL",
        campo_enlace_externo: "id",
        descripcion: "Vincula la partida de cobro con el cliente deudor.",
      },
      bancos: {
        tabla_relacionada: "bancos",
        tipo: "Muchos a uno",
        campo_enlace_local: "CB_BAN",
        campo_enlace_externo: "id",
        descripcion: "Vincula la partida de cobro con la entidad bancaria asociada.",
      },
    },
    ejemplos: {
      consulta_cobro_por_id: "Obtener los detalles de una partida de cobro específica usando su 'id'.",
      consultar_cobros_por_cliente:
        "Listar todas las partidas de cobro pendientes para un cliente específico (filtrando por CB_CCL).",
      filtrar_cobros_por_fecha_vencimiento:
        "Buscar cobros cuya fecha de vencimiento (CB_VTO) esté en un rango específico.",
      obtener_info_relacionada:
        "Para una partida de cobro, usar CB_VD, CB_CCL y CB_BAN para consultar 'vendedores', 'clientes' y 'bancos' y obtener los nombres del vendedor, cliente y banco.",
    },
  },

  /* ================================================*/
  /* Cobros – General – Remesas Cobros */
  /* ================================================*/
  remesas: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Gestiona 'remesas de cobro', agrupando partidas pendientes (de Cartera de cobros) para su presentación conjunta a un banco. Esencial para automatizar y controlar el proceso de cobro bancario y conciliación.",
    tabla: "remesas", // Nombre de tabla original
    columna: {
      id: "Número único que identifica cada remesa (Clave Primaria)",
      RM_BCO: "Número del banco asociado a la remesa. Clave foránea a la tabla 'bancos' para obtener la denominación (BA_DENO).",
      RM_FEC: "Fecha en la que se generó la remesa.",
      RM_TIPO: "Tipo de documento o proceso de la remesa (Ej: 'Tipo Dto').",
      RM_TTT: "Importe total de la remesa (suma de todos los cobros que la componen).",
    },
    relaciones: {
      bancos: {
        tabla_relacionada: "bancos",
        tipo: "Muchos a uno",
        campo_enlace_local: "RM_BCO",
        campo_enlace_externo: "id",
        descripcion: "Vincula la remesa con la entidad bancaria a la que se presenta.",
      },
      cobros_incluidos: {
        tabla_relacionada: "[Tabla no especificada]", // Nombre de tabla desconocido según la descripción
        tipo: "Uno a muchos (una remesa puede incluir muchos cobros)",
        campo_enlace_local: "id", // El id de la remesa
        campo_enlace_externo: "[Campo en tabla rel. que apunta a remesas.id]", // Nombre de campo desconocido
        descripcion:
          "Relación con una tabla auxiliar (nombre no especificado) que registra qué partidas individuales de la cartera de cobros (tabla 'cobros') están incluidas en esta remesa y han sido procesadas/canceladas por ella.",
        relacion_interna: {
          // La tabla auxiliar se relaciona a su vez con la tabla 'cobros'
          tabla_relacionada: "cobros",
          tipo: "Muchos a uno (varias líneas en la tabla auxiliar apuntan al mismo cobro si un cobro pudiera estar en múltiples remesas, aunque lo típico sería Uno a Uno en la tabla auxiliar con referencia a cobros)", // Ajustar si se aclara la estructura
          campo_enlace_local: "[Campo en tabla rel. que apunta a cobros.id]", // Nombre de campo desconocido
          campo_enlace_externo: "id", // El id del cobro
          descripcion:
            "Vincula la línea de la tabla auxiliar con la partida de cobro original de la tabla 'cobros'.",
        },
      },
    },
    ejemplos: {
      consulta_remesa_por_id: "Obtener los detalles de una remesa específica usando su 'id'.",
      consultar_banco_remesa:
        "Para una remesa, usar RM_BCO para consultar la tabla 'bancos' y obtener el nombre del banco asociado (BA_DENO).",
      filtrar_remesas_por_fecha_o_tipo:
        "Listar remesas generadas en una fecha o rango de fechas (filtrando por RM_FEC) o por un tipo específico (filtrando por RM_TIPO).",
      consultar_cobros_en_remesa:
        "Ver qué partidas de cobro individuales están incluidas en una remesa específica (requiere consultar la tabla auxiliar no especificada que relaciona remesas con cobros).",
    },
  },


  /* ================================================*/
/* Cobros - General - Control de impagos */
/* ================================================*/
impagos: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Gestiona el control de facturas impagadas, permitiendo el seguimiento de los pagos parciales y la identificación de los agentes de cobro. Se enlaza con la tabla de facturas emitidas para obtener el monto total original de la factura.",
    tabla: `impagos`, // Nombre de la tabla principal
    columnas: {
      id: "Número de factura impagada (Clave Primaria). Este ID se utiliza como clave foránea en la tabla 'impagos_imp_lna' y también para enlazar con 'facturas-e'.",
    },
    relaciones: {
      impagos_imp_lna: {
        tabla_relacionada: "impagos_imp_lna",
        tipo: "Uno a muchos (una factura impagada puede tener múltiples registros de control de pago)",
        campo_enlace_local: "id", // ID de la factura en 'impagos'
        campo_enlace_externo: "id", // ID de la factura en 'impagos_imp_lna'
        descripcion: "Detalle de los registros de control de impagos, incluyendo agentes y montos cobrados.",
        estructura_relacionada: {
          id: "Número de factura (igual que 'impagos.id').",
          C0: "Código del Agente responsable del cobro.",
          C1: "Fecha del registro de cobro.",
          C3: "Monto cobrado en este registro.",
        },
        // Relaciones internas de detalle con la tabla 'agentes' si existe.
        /*
        agentes: {
          tabla_relacionada: "agentes",
          tipo: "Muchos a uno",
          campo_enlace_local: "C0",
          campo_enlace_externo: "id",
          descripcion: "Vincula el registro de impago con el agente de cobro responsable."
        }
        */
      },
      facturas_e: {
        tabla_relacionada: "facturas-e",
        tipo: "Muchos a uno", // Una factura-e puede estar en 'impagos', y 'impagos' referencia a esa factura-e
        campo_enlace_local: "id", // ID de la factura en 'impagos'
        campo_enlace_externo: "id", // ID de la factura en 'facturas-e'
        descripcion: "Vincula el registro de impago con la factura original para obtener detalles como el monto total (FE_TTT).",
      },
    },
    ejemplos: {
      consulta_impago_por_factura:
        "Obtener el control de impagos para una factura específica usando su 'id' de factura.",
      consultar_cobros_parciales:
        "Para una factura impagada, listar todos los registros de 'impagos_imp_lna' para ver los montos y fechas de los cobros parciales.",
      calcular_saldo_pendiente:
        "Calcular el saldo pendiente de una factura impagada restando la suma de 'impagos_imp_lna.C3' del 'facturas-e.FE_TTT' de la factura correspondiente.",
      filtrar_impagos_por_agente:
        "Listar las facturas impagadas gestionadas por un agente específico (filtrando por 'impagos_imp_lna.C0').",
      analisis_de_morosidad:
        "Analizar el historial de cobros de facturas impagadas a lo largo del tiempo o por tipo de cliente (requiere unirse también a la tabla 'clientes' a través de 'facturas-e').",
    },
  },


 
  /* ================================================*/
  /* Cobros – Caja – Movimientos Caja Bancos */
  /* ================================================*/
  movimientos_caja_bancos: {
    // Clave principal (basada en el nombre de la sección)
    descripcion:
      "Registra y gestiona los traspasos de fondos entre las diferentes cajas (efectivo) y cuentas bancarias de la empresa. Documenta flujos monetarios internos para control de tesorería y conciliación.",
    tabla: "mv_caja", // Nombre de tabla inferido o no especificado explícitamente (campos con prefijo MV_)
    columnas: {
      id: "Código o identificador único de cada movimiento (Clave Primaria)",
      MV_FEC: "Fecha en la que se registró el movimiento",
      MV_CTO: "Concepto o breve descripción del movimiento",
      MV_IMPO: "Cantidad monetaria del importe del movimiento",
      MV_USU: "Usuario que gestionó el movimiento. Clave foránea a la tabla 'vendedores' para obtener la denominación (VD_DENO).",
      MV_BAO: "Nombre del banco o caja de Origen del movimiento. Clave foránea a la tabla 'bancos' para obtener la denominación (BA_DENO) de la entidad de origen.",
      MV_TIPO: "Tipo de movimiento (Ej: '1').",
      MV_CTB: "Indica si el movimiento es 'Contabilizable' (Ej: 'S').", // Interpretación basada en el ejemplo 'S'
    },
    relaciones: {
      vendedores: {
        tabla_relacionada: "vendedores",
        tipo: "Muchos a uno",
        campo_enlace_local: "MV_USU",
        campo_enlace_externo: "id",
        descripcion: "Vincula el movimiento con el usuario responsable que lo registró.",
      },
      bancos_origen: {
        // Relación para la entidad de origen
        tabla_relacionada: "bancos",
        tipo: "Muchos a uno",
        campo_enlace_local: "MV_BAO",
        campo_enlace_externo: "id",
        descripcion: "Vincula el movimiento con el banco o caja de origen.",
      },
      // Se infiere que también existe una relación similar para el banco o caja de destino del movimiento (campo no detallado).
    },
    ejemplos: {
      consulta_movimiento_por_id: "Obtener los detalles de un movimiento de caja/bancos específico usando su 'id'.",
      filtrar_por_fecha:
        "Listar movimientos registrados en una fecha o rango de fechas específico (filtrando por MV_FEC).",
      filtrar_por_usuario:
        "Buscar movimientos gestionados por un usuario específico (filtrando por MV_USU).",
      filtrar_por_origen_o_tipo:
        "Encontrar movimientos que provienen de un banco/caja de origen específico (filtrando por MV_BAO) o que son de un tipo particular (filtrando por MV_TIPO).",
      obtener_info_relacionada:
        "Para un movimiento, usar MV_USU y MV_BAO para consultar 'vendedores' y 'bancos' y obtener los nombres del usuario y la entidad de origen.",
    },
  },




  /* ======================================================================================================================================================================*/
  /* COMPRAS                                                                                                                                                             */
  /* ======================================================================================================================================================================*/

  /* ================================================*/
  /* Compras – Gestión Compras – Albaranes Compra */
  /* ================================================*/
  alb_compra: {
    // Clave principal (basada en el nombre de tabla)
    descripcion:
      "Registra y administra los albaranes de compra, documentando la recepción de mercancías o servicios de proveedores. Crucial para control de inventario, verificación de pedidos, validación de facturas y seguimiento de condiciones comerciales.",
    tabla: "alb-compra", // Nombre de tabla original
    columnas: {
      id: "Código único que identifica cada albarán de compra (Clave Primaria)",
      AC_NPD: "Número del pedido de compra asociado.", // Sugiere relación con tabla de pedidos de compra
      AC_CPR: "Número del proveedor. Clave foránea a la tabla 'proveedores' para obtener la denominación (PR_DENO).",
      AC_ALM: "Almacén de recepción en Semilleros Deitana. Clave foránea a la tabla 'almacenes' para obtener la denominación (AM_DENO).",
      AC_FEC: "Fecha en que se registró el albarán de compra.",
      AC_SUA: "Número del albarán proporcionado por el proveedor.",
      AC_FP: "Forma de pago acordada. Clave foránea a la tabla 'fpago' para obtener la denominación (FP_DENO).",
      AC_FRA: "Número de la factura del proveedor asociada.", // Sugiere relación con tabla de facturas proveedor
      AC_FFR: "Fecha de la factura del proveedor asociada.", // Sugiere relación con tabla de facturas proveedor
      AC_BRU: "Monto bruto total del albarán.",
      AC_NETO: "Monto neto del albarán.",
      AC_IMPU: "Costo total de los impuestos aplicados.",
      AC_TTT: "Monto total final del albarán.",
    },
    relaciones: {
      proveedores: {
        tabla_relacionada: "proveedores",
        tipo: "Muchos a uno",
        campo_enlace_local: "AC_CPR",
        campo_enlace_externo: "id",
        descripcion: "Vincula el albarán con el proveedor que emitió la entrega.",
      },
      almacenes: {
        tabla_relacionada: "almacenes",
        tipo: "Muchos a uno",
        campo_enlace_local: "AC_ALM",
        campo_enlace_externo: "id",
        descripcion: "Vincula el albarán con el almacén de Semilleros Deitana donde se recibieron los artículos.",
      },
      fpago: {
        tabla_relacionada: "fpago",
        tipo: "Muchos a uno",
        campo_enlace_local: "AC_FP",
        campo_enlace_externo: "id",
        descripcion: "Vincula el albarán con la forma de pago acordada para la transacción.",
      },
    },
    ejemplos: {
      consulta_albaran_por_id: "Obtener los detalles de un albarán de compra específico usando su 'id'.",
      consultar_info_relacionada:
        "Para un albarán, usar AC_CPR, AC_ALM y AC_FP para consultar 'proveedores', 'almacenes' y 'fpago' y obtener los nombres del proveedor, almacén y forma de pago.",
      filtrar_albaranes_por_proveedor_o_fecha:
        "Listar albaranes recibidos de un proveedor específico (filtrando por AC_CPR) o en un rango de fechas (filtrando por AC_FEC).",
      vincular_a_pedido_o_factura:
        "Usar AC_NPD o AC_FRA/AC_FFR para encontrar el pedido de compra o la factura asociada (requiere consultar las tablas correspondientes).",
    },
  },

  /* ================================================*/
/* Compras – Gestión Compras – Pedidos a Proveedor */
/* ================================================*/
pedidos_pr: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Registra y sigue los pedidos de compra realizados a proveedores. Es el punto de partida formal para solicitar la adquisición de bienes o servicios. Es crucial para la planificación de compras, el control de inventario, la gestión de proveedores y sirve como base para las recepciones de mercancía y las facturas de compra.",
    tabla: "pedidos_pr", // Nombre de tabla original
    columnas: {
      id: "Número único que identifica cada pedido a proveedor (Clave Primaria). Este ID se utiliza como clave foránea en la tabla 'pedidos_pr_pp_lna'.",
      PP_CPR: "Código del proveedor. Clave foránea a la tabla 'proveedores' para obtener la denominación (PR_DENO).",
      PP_ALM: "Almacén de recepción designado. Clave foránea a la tabla 'almacenes' para obtener la denominación (AM_DENO).",
      PP_FEC: "Fecha en que se emitió el pedido.",
      PP_FSV: "Fecha esperada de entrega por el proveedor ('fecha servir').",
      PP_FP: "Forma de pago acordada. Clave foránea a la tabla 'fpago' para obtener la denominación (FP_DENO).",
      PP_BRU: "Monto bruto total del pedido.",
      PP_NETO: "Monto neto del pedido.",
      PP_IMPU: "Costo total de los impuestos aplicados.",
      PP_TTT: "Monto total final del pedido.",
      PP_PDP: "Persona dentro de la empresa que realizó o solicitó el pedido ('Pedido por') usuarios/empleados.",
    },
    relaciones: {
      proveedores: {
        tabla_relacionada: "proveedores",
        tipo: "Muchos a uno",
        campo_enlace_local: "PP_CPR",
        campo_enlace_externo: "id",
        descripcion: "Vincula el pedido con el proveedor al que se le realizó la solicitud.",
      },
      almacenes: {
        tabla_relacionada: "almacenes",
        tipo: "Muchos a uno",
        campo_enlace_local: "PP_ALM",
        campo_enlace_externo: "id",
        descripcion: "Vincula el pedido con el almacén donde se espera recibir la mercancía.",
      },
      fpago: {
        tabla_relacionada: "fpago",
        tipo: "Muchos a uno",
        campo_enlace_local: "PP_FP",
        campo_enlace_externo: "id",
        descripcion: "Vincula el pedido con la forma de pago acordada.",
      },
      pedidos_pr_pp_lna: {
        tabla_relacionada: "pedidos_pr_pp_lna",
        tipo: "Uno a muchos (un pedido a proveedor puede incluir múltiples artículos/líneas de pedido)",
        campo_enlace_local: "id", // ID del pedido en la tabla principal
        campo_enlace_externo: "id", // ID del pedido en la tabla de detalle
        descripcion: "Detalla los artículos específicos pedidos a cada proveedor en una línea de pedido.",
        estructura_relacionada: {
          id: "Código del pedido (igual que 'pedidos_pr.id').",
          id2: "Identificador secuencial de la línea de pedido (para diferentes artículos dentro del mismo pedido, ej: '1', '2', '3').",
          C0: "Código del artículo que se pidió al proveedor. Clave foránea a la tabla 'articulos' para obtener la denominación (AR_DENO).",
          C1: "Código del envase de venta. Clave foránea a la tabla 'envases_vta' para obtener la denominación (EV_DENO).",
          C2: "Número de sobres.",
          C3: "Unidades por sobre.",
          C4: "Precio de compra (P/Compra).",
          C5: "Porcentaje de descuento (Descuento %).",
        },
        relaciones_internas_de_detalle: {
          articulos: {
            tabla_relacionada: "articulos",
            tipo: "Muchos a uno",
            campo_enlace_local: "C0",
            campo_enlace_externo: "id",
            descripcion: "Vincula la línea del pedido con el artículo correspondiente para obtener su denominación.",
          },
          envases_vta: {
            tabla_relacionada: "envases_vta",
            tipo: "Muchos a uno",
            campo_enlace_local: "C1",
            campo_enlace_externo: "id",
            descripcion: "Vincula la línea del pedido con el tipo de envase de venta para obtener su denominación.",
          },
        },
      },
      
    },
    ejemplos: {
      consulta_pedido_por_id: "Obtener los detalles de un pedido a proveedor específico usando su 'id'.",
      consultar_info_relacionada:
        "Para un pedido, usar PP_CPR, PP_ALM y PP_FP para consultar 'proveedores', 'almacenes' y 'fpago' y obtener los nombres del proveedor, almacén y forma de pago.",
      filtrar_pedidos_por_proveedor_o_fecha:
        "Listar pedidos realizados a un proveedor específico (filtrando por PP_CPR) o en un rango de fechas (filtrando por PP_FEC).",
      filtrar_pedidos_por_fecha_entrega_esperada:
        "Buscar pedidos con una fecha de entrega esperada (PP_FSV) en un rango específico.",
      filtrar_pedidos_por_solicitante:
        "Encontrar pedidos realizados por una persona específica dentro de la empresa (filtrando por PP_PDP).",
      consultar_articulos_en_pedido:
        "Para un pedido (ej. ID '005001'), listar todos los artículos pedidos desde 'pedidos_pr_pp_lna', incluyendo su denominación (uniéndose a 'articulos'), tipo de envase, unidades, precio de compra y descuento.",
      calcular_costo_total_por_articulo_en_pedido:
        "Para un pedido específico, calcular el costo total de cada artículo multiplicando 'C3' (Unidades/Sob) * 'C4' (P/Compra) y aplicando 'C5' (Descuento %).",
    },
  },

  /* ================================================*/
  /* Compras – Facturación Compras – Registro de Facturas Recibidas */
  /* ================================================*/
  facturas_r: {
    // Clave principal (basada en el nombre de tabla)
    descripcion:
      "Registra y gestiona las facturas recibidas de proveedores. Punto de entrada formal de documentos de cobro de proveedores. Crucial para control financiero, cuentas por pagar, validación y base para pagos.",
    tabla: "facturas-r", // Nombre de tabla original
    columnas: {
      id: "Número de identificación único de la factura en el sistema (Clave Primaria)",
      FR_CPR: "Código del proveedor emisor. Clave foránea a la tabla 'proveedores' para obtener la denominación (PR_DENO).",
      FR_ALM: "Almacén posiblemente relacionado con la recepción. Clave foránea a la tabla 'almacenes' para obtener la denominación (AM_DENO).",
      FR_SUFA: "Número de factura asignado por el proveedor.",
      FR_FEC: "Fecha en que se registró la factura en el sistema.",
      FR_BRU: "Monto bruto total de la factura.",
      FR_NETO: "Monto neto de la factura.",
      FR_IMPU: "Costo total de los impuestos aplicados.",
      FR_TTT: "Monto total final de la factura.",
      FR_FP: "Forma de pago asociada. Clave foránea a la tabla 'fpago' para obtener la denominación (FP_DENO).",
      FR_USU: "Usuario que realizó el registro de la factura. Clave foránea a la tabla 'vendedores' para obtener la denominación (VD_DENO).",
    },
    relaciones: {
      proveedores: {
        tabla_relacionada: "proveedores",
        tipo: "Muchos a uno",
        campo_enlace_local: "FR_CPR",
        campo_enlace_externo: "id",
        descripcion: "Vincula la factura con el proveedor que la emitió.",
      },
      almacenes: {
        tabla_relacionada: "almacenes",
        tipo: "Muchos a uno",
        campo_enlace_local: "FR_ALM",
        campo_enlace_externo: "id",
        descripcion: "Vincula la factura con el almacén posiblemente relacionado con la recepción.",
      },
      fpago: {
        tabla_relacionada: "fpago",
        tipo: "Muchos a uno",
        campo_enlace_local: "FR_FP",
        campo_enlace_externo: "id",
        descripcion: "Vincula la factura con la forma de pago asociada.",
      },
      vendedores: {
        tabla_relacionada: "vendedores",
        tipo: "Muchos a uno",
        campo_enlace_local: "FR_USU",
        campo_enlace_externo: "id",
        descripcion: "Vincula la factura con el usuario interno que realizó el registro.",
      },
      // Relación potencial inferida:
      albaranes_compra: {
        tabla_relacionada: "alb-compra", // Nombre de tabla inferido
        tipo: "Posiblemente Muchos a Muchos o Uno a Muchos", // Tipo inferido, una factura puede cubrir varios albaranes o viceversa
        campo_enlace_local: "id", // Id de la factura
        campo_enlace_externo: "[Campo(s) en tabla de enlace o en alb-compra que apuntan a factura.id]", // Mecanismo de enlace no especificado
        descripcion_inferida:
          "Sugiere vínculo con la tabla de albaranes de compra ('alb-compra'), permitiendo relacionar la factura recibida con las entregas correspondientes.",
      },
    },
    ejemplos: {
      consulta_factura_por_id: "Obtener los detalles de una factura recibida específica usando su 'id'.",
      consultar_info_relacionada:
        "Para una factura, usar FR_CPR, FR_ALM, FR_FP y FR_USU para consultar 'proveedores', 'almacenes', 'fpago' y 'vendedores' y obtener los nombres del proveedor, almacén, forma de pago y usuario registrador.",
      filtrar_facturas_por_proveedor_o_fecha:
        "Listar facturas recibidas de un proveedor específico (filtrando por FR_CPR) o registradas en un rango de fechas (filtrando por FR_FEC).",
      filtrar_facturas_por_usuario_o_forma_pago:
        "Buscar facturas registradas por un usuario específico (filtrando por FR_USU) o con una forma de pago particular (filtrando por FR_FP).",
      vincular_a_albaran:
        "Encontrar los albaranes de compra asociados a esta factura (requiere consultar la tabla de albaranes o una tabla de enlace, si existe).",
    },
  },

  /* ================================================*/
  /* Compras – Facturación Compras – Facturas de Gastos */
  /* ================================================*/
  gastos: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Registra facturas correspondientes a gastos generales de la empresa, distintos de compras de inventario (incluye pagos de préstamos). Documenta costos operativos y administrativos para control, contabilidad y análisis.",
    tabla: "gastos", // Nombre de tabla original
    columnas: {
      id: "Código de registro único que identifica cada gasto (Clave Primaria)",
      GA_PRV: "Denominación de la entidad o persona a la que corresponde el gasto (campo de texto descriptivo, no clave foránea a tabla de proveedores según descripción).", // Nota basada en el texto fuente
      GA_SUFA: "Número de factura asociado a este gasto.",
      GA_FEC: "Fecha en que se registró el gasto.",
      GA_CTO: "Concepto o descripción detallada del gasto.",
      GA_TTF: "Monto total del gasto.",
    },
    relaciones: {
      observaciones:
        "La descripción proporcionada no detalla explícitamente relaciones formales (claves foráneas) con otras tablas como proveedores (más allá de la denominación en GA_PRV), vendedores o formas de pago (fpago)."
      // Aunque lógicamente podrían existir relaciones (ej: con tabla de centros de coste, proyectos, etc.), no están descritas aquí.
    },
    ejemplos: {
      consulta_gasto_por_id: "Obtener los detalles de un registro de gasto específico usando su 'id'.",
      filtrar_gastos_por_fecha:
        "Listar gastos registrados en una fecha o rango de fechas específico (filtrando por GA_FEC).",
      buscar_gasto_por_entidad_o_concepto:
        "Buscar gastos que contengan cierta denominación en GA_PRV o cierto texto en el concepto GA_CTO.",
      filtrar_gastos_por_numero_factura:
        "Encontrar gastos asociados a un número de factura específico (filtrando por GA_SUFA).",
    },
  },

  /* ================================================*/
  /* Compras – General Pagos – Cartera de pagos */
  /* ================================================*/
  pagos: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Administra la 'cartera de pagos', registrando obligaciones pendientes a proveedores y otros acreedores. Permite seguimiento de cantidades adeudadas, fechas de vencimiento, y vinculación con acreedor, banco de origen y responsable interno.",
    tabla: "pagos", // Nombre de tabla original
    columnas: {
      id: "Identificador único de cada partida de pago (Clave Primaria)",
      PG_CPR: "Código del proveedor acreedor. Clave foránea a la tabla 'proveedores' para obtener la denominación (PR_DENO).",
      PG_FEC: "Fecha en la que se emitió o registró la partida de pago.",
      PG_VTO: "Fecha de vencimiento en la que se debe realizar el pago.",
      PG_DTO: "Número del documento asociado al pago (ej: número de factura o albarán).", // Sugiere relación con tablas de facturas/albaranes
      PG_TIPO: "Tipo de la partida de pago.",
      PG_BAN: "Código de la cuenta bancaria de Semilleros Deitana desde la cual se realizará el pago. Clave foránea a la tabla 'bancos' para obtener la denominación (BA_DENO).",
      PG_IMPO: "Importe monetario a pagar.",
      PG_VD: "Vendedor o usuario interno que gestionó este pago. Clave foránea a la tabla 'vendedores' para obtener la denominación (VD_DENO).",
    },
    relaciones: {
      proveedores: {
        tabla_relacionada: "proveedores",
        tipo: "Muchos a uno",
        campo_enlace_local: "PG_CPR",
        campo_enlace_externo: "id",
        descripcion: "Vincula la partida de pago con el proveedor acreedor.",
      },
      bancos: {
        tabla_relacionada: "bancos",
        tipo: "Muchos a uno",
        campo_enlace_local: "PG_BAN",
        campo_enlace_externo: "id",
        descripcion: "Vincula la partida de pago con la cuenta bancaria de la empresa desde la cual se realizará el pago.",
      },
      vendedores: {
        tabla_relacionada: "vendedores",
        tipo: "Muchos a uno",
        campo_enlace_local: "PG_VD",
        campo_enlace_externo: "id",
        descripcion: "Vincula la partida de pago con el usuario/vendedor interno que gestionó el registro.",
      },
      // Relación potencial inferida:
      documentos_origen: {
        tabla_relacionada: "[Tablas de Facturas Recibidas / Albarenes Compra]", // Nombres de tablas no especificados explícitamente
        tipo: "Posiblemente Muchos a Uno o Muchos a Muchos", // Tipo inferido, un pago puede cubrir uno o varios documentos
        campo_enlace_local: "PG_DTO", // El campo que contiene el número del documento
        campo_enlace_externo: "[Campo número de documento en tablas origen]", // Nombre de campo no especificado (ej: FR_SUFA, AC_SUA)
        descripcion_inferida:
          "Sugiere vínculo con las facturas recibidas o albaranes de compra que originaron la obligación de pago, usando el número de documento (PG_DTO).",
      },
    },
    ejemplos: {
      consulta_pago_por_id: "Obtener los detalles de una partida de pago específica usando su 'id'.",
      consultar_pagos_por_proveedor:
        "Listar todas las partidas de pago pendientes para un proveedor específico (filtrando por PG_CPR).",
      filtrar_pagos_por_fecha_vencimiento:
        "Buscar pagos cuya fecha de vencimiento (PG_VTO) esté en un rango específico.",
      obtener_info_relacionada:
        "Para una partida de pago, usar PG_CPR, PG_BAN y PG_VD para consultar 'proveedores', 'bancos' y 'vendedores' y obtener los nombres del proveedor, banco de origen y responsable interno.",
      buscar_pago_por_documento:
        "Encontrar partidas de pago asociadas a un número de documento específico (filtrando por PG_DTO).",
    },
  },



  /* ================================================*/
  /* Compras – General Pagos – Remesas de Pago */
  /* ================================================*/
  transferencias: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Gestiona 'remesas de pago', agrupando partidas pendientes (de Cartera de pagos) para su procesamiento conjunto, típicamente vía banco. Facilita y automatiza el proceso de pago a proveedores de forma masiva.",
    tabla: "transferencias", // Nombre de tabla original
    columnas: {
      id: "Número único que identifica cada remesa de pago (Clave Primaria)",
      XT_BCO: "Código del banco de Semilleros Deitana desde el cual se realizará la remesa. Clave foránea a la tabla 'bancos' para obtener la denominación (BA_DENO).",
      XT_FEC: "Fecha en que se generó la remesa.",
      XT_TIPO: "Tipo de remesa o proceso asociado.",
      XT_TTT: "Importe total de la remesa (suma de todos los pagos individuales).",
    },
    relaciones: {
      bancos: {
        tabla_relacionada: "bancos",
        tipo: "Muchos a uno",
        campo_enlace_local: "XT_BCO",
        campo_enlace_externo: "id",
        descripcion: "Vincula la remesa con la cuenta bancaria de la empresa desde la cual se emitirán los pagos.",
      },
      pagos_incluidos: {
        tabla_relacionada: "pagos", // La tabla 'Cartera de pagos'
        tipo: "Implícita - Uno a muchos (una remesa agrupa muchos pagos)",
        campo_enlace_local: "id", // El id de la remesa
        campo_enlace_externo: "[Campo(s) en 'pagos' o tabla intermedia]", // Mecanismo de enlace no especificado (probablemente via una tabla intermedia o un campo en 'pagos' que referencia a 'transferencias')
        descripcion_inferida:
          "Relación conceptual (y probablemente implementada) que vincula esta remesa con las partidas individuales de la 'Cartera de pagos' ('pagos') que están incluidas en ella para ser procesadas.",
      },
    },
    ejemplos: {
      consulta_remesa_por_id: "Obtener los detalles de una remesa de pago específica usando su 'id'.",
      consultar_banco_remesa:
        "Para una remesa, usar XT_BCO para consultar la tabla 'bancos' y obtener el nombre del banco de origen (BA_DENO).",
      filtrar_remesas_por_fecha_o_tipo:
        "Listar remesas generadas en una fecha o rango de fechas (filtrando por XT_FEC) o por un tipo específico (filtrando por XT_TIPO).",
      consultar_pagos_en_remesa:
        "Ver qué partidas de pago individuales (de la tabla 'pagos') están incluidas en una remesa específica (requiere consultar la tabla 'pagos' o una tabla intermedia que las vincule con 'transferencias').",
    },
  },






  /* ======================================================================================================================================================================*/
  /* ORNAMENTAL                                                                                                                                                            */
  /* ======================================================================================================================================================================*/




  /* ================================================*/
  /* Ornamental – Compras – Albarán Compra Ornamental */
  /* (Nota: La descripción proporcionada es idéntica a "Compras – Gestión Compras – Albaranes Compra") */
  /* ================================================*/
  alb_compra: {
    // Clave principal (basada en el nombre de tabla)
    descripcion:
      "Registra y administra los albaranes de compra, documentando la recepción de mercancías o servicios de proveedores. Crucial para control de inventario, verificación de pedidos, validación de facturas y seguimiento de condiciones comerciales.",
    tabla: "alb-compra", // Nombre de tabla original
    columnas: {
      id: "Código único que identifica cada albarán de compra (Clave Primaria)",
      AC_NPD: "Número del pedido de compra asociado.", // Sugiere relación con tabla de pedidos de compra
      AC_CPR: "Número del proveedor. Clave foránea a la tabla 'proveedores' para obtener la denominación (PR_DENO).",
      AC_ALM: "Almacén de recepción en Semilleros Deitana. Clave foránea a la tabla 'almacenes' para obtener la denominación (AM_DENO).",
      AC_FEC: "Fecha en que se registró el albarán de compra.",
      AC_SUA: "Número del albarán proporcionado por el proveedor.",
      AC_FP: "Forma de pago acordada. Clave foránea a la tabla 'fpago' para obtener la denominación (FP_DENO).",
      AC_FRA: "Número de la factura del proveedor asociada.", // Sugiere relación con tabla de facturas proveedor
      AC_FFR: "Fecha de la factura del proveedor asociada.", // Sugiere relación con tabla de facturas proveedor
      AC_BRU: "Monto bruto total del albarán.",
      AC_NETO: "Monto neto del albarán.",
      AC_IMPU: "Costo total de los impuestos aplicados.",
      AC_TTT: "Monto total final del albarán.",
    },
    relaciones: {
      proveedores: {
        tabla_relacionada: "proveedores",
        tipo: "Muchos a uno",
        campo_enlace_local: "AC_CPR",
        campo_enlace_externo: "id",
        descripcion: "Vincula el albarán con el proveedor que emitió la entrega.",
      },
      almacenes: {
        tabla_relacionada: "almacenes",
        tipo: "Muchos a uno",
        campo_enlace_local: "AC_ALM",
        campo_enlace_externo: "id",
        descripcion: "Vincula el albarán con el almacén de Semilleros Deitana donde se recibieron los artículos.",
      },
      fpago: {
        tabla_relacionada: "fpago",
        tipo: "Muchos a uno",
        campo_enlace_local: "AC_FP",
        campo_enlace_externo: "id",
        descripcion: "Vincula el albarán con la forma de pago acordada para la transacción.",
      },
      // Relaciones potenciales inferidas:
      pedidos_compra: {
        tabla_relacionada: "[Tabla de Pedidos de Compra]", // Nombre de tabla no especificado
        tipo: "Muchos a uno (un albarán puede provenir de un pedido)", // Tipo inferido
        campo_enlace_local: "AC_NPD", // El campo que contiene el número/id del pedido
        campo_enlace_externo: "[Campo id/número en tabla de pedidos]", // Nombre de campo no especificado
        descripcion_inferida:
          "Sugiere vínculo con una tabla de pedidos de compra, permitiendo trazar el albarán al pedido original.",
      },
      facturas_proveedor: {
        tabla_relacionada: "[Tabla de Facturas de Proveedor]", // Nombre de tabla no especificado
        tipo: "Uno a uno o Uno a cero-o-uno (un albarán se asocia a una factura o ninguna)", // Tipo inferido
        campo_enlace_local: "AC_FRA", // El campo que contiene el número/id de la factura
        campo_enlace_externo: "[Campo id/número en tabla de facturas]", // Nombre de campo no especificado
        descripcion_inferida:
          "Sugiere vínculo con una tabla de facturas de proveedor, permitiendo asociar el albarán a la factura emitida.",
      },
    },
    ejemplos: {
      consulta_albaran_por_id: "Obtener los detalles de un albarán de compra específico usando su 'id'.",
      consultar_info_relacionada:
        "Para un albarán, usar AC_CPR, AC_ALM y AC_FP para consultar 'proveedores', 'almacenes' y 'fpago' y obtener los nombres del proveedor, almacén y forma de pago.",
      filtrar_albaranes_por_proveedor_o_fecha:
        "Listar albaranes recibidos de un proveedor específico (filtrando por AC_CPR) o en un rango de fechas (filtrando por AC_FEC).",
      filtrar_albaranes_por_usuario_o_forma_pago:
        "Buscar albaranes registrados por un usuario específico (filtrando por FR_USU, si existiera este campo aquí) o con una forma de pago particular (filtrando por AC_FP).", // Nota: FR_USU es de facturas-r, no de alb-compra. Corregido en ejemplo.
      // Ejemplo corregido: filtrar_albaranes_por_almacen_o_forma_pago: "Buscar albaranes recibidos en un almacén (filtrando por AC_ALM) o con una forma de pago particular (filtrando por AC_FP)."
    },
  },


  

  /* ================================================*/
  /* Ornamental – Ventas – Albarán venta Ornamental */
  /* ================================================*/
  albaran_venta_ornamental: {
    // Clave principal (basada en el nombre de la sección)
    descripcion:
      "Registra y gestiona los albaranes de venta específicos para productos ornamentales. Documenta la salida de productos hacia clientes, crucial para control de inventario, confirmación de entregas y base para facturación.",
    tabla: "alb-venta", // Nombre de tabla inferido (campos con prefijo AV_)
    columnas: {
      id: "Identificador único de cada albarán de venta ornamental (Clave Primaria)",
      AV_NPD: "Número del pedido de venta del cliente asociado, si lo hay.", // Sugiere relación con tabla de pedidos de venta
      AV_CCL: "Número del cliente que recibió la mercancía. Clave foránea a la tabla 'clientes' para obtener la denominación (CL_DENO).",
      AV_VD: "Vendedor que gestionó la venta. Clave foránea a la tabla 'vendedores' para obtener la denominación (VD_DENO).",
      AV_ALM: "Almacén de Semilleros Deitana desde donde se expidió la mercancía. Clave foránea a la tabla 'almacenes' para obtener la denominación (AM_DENO).",
      AV_FEC: "Fecha en que se emitió el albarán.",
      AV_TIP: "Tipo de albarán o venta.",
      AV_FRA: "Número de la factura asociada a este albarán.", // Sugiere relación con tabla de facturas de venta
      AV_FFR: "Fecha de la factura asociada.", // Sugiere relación con tabla de facturas de venta
      AV_BRU: "Monto bruto total del albarán.",
      AV_NETO: "Monto neto del albarán.",
      AV_IMPU: "Importe total de los impuestos aplicados.",
      AV_TTT: "Monto total final del albarán.",
      AV_ORIVTA: "Origen o canal específico de esta venta ornamental.",
      AV_FP: "Forma de pago acordada para esta venta. Clave foránea a la tabla 'fpago' para obtener la denominación (FP_DENO).",
    },
    relaciones: {
      clientes: {
        tabla_relacionada: "clientes",
        tipo: "Muchos a uno",
        campo_enlace_local: "AV_CCL",
        campo_enlace_externo: "id",
        descripcion: "Vincula el albarán con el cliente que recibió la mercancía.",
      },
      vendedores: {
        tabla_relacionada: "vendedores",
        tipo: "Muchos a uno",
        campo_enlace_local: "AV_VD",
        campo_enlace_externo: "id",
        descripcion: "Vincula el albarán con el vendedor que gestionó la venta.",
      },
      almacenes: {
        tabla_relacionada: "almacenes",
        tipo: "Muchos a uno",
        campo_enlace_local: "AV_ALM",
        campo_enlace_externo: "id",
        descripcion: "Vincula el albarán con el almacén desde donde se expidió la mercancía.",
      },
      fpago: {
        tabla_relacionada: "fpago",
        tipo: "Muchos a uno",
        campo_enlace_local: "AV_FP",
        campo_enlace_externo: "id",
        descripcion: "Vincula el albarán con la forma de pago acordada para la venta.",
      },
      // Relaciones potenciales inferidas:
      pedidos_venta: {
        tabla_relacionada: "[Tabla de Pedidos de Venta]", // Nombre de tabla no especificado
        tipo: "Muchos a uno (un albarán puede provenir de un pedido)", // Tipo inferido
        campo_enlace_local: "AV_NPD", // El campo que contiene el número/id del pedido
        campo_enlace_externo: "[Campo id/número en tabla de pedidos de venta]", // Nombre de campo no especificado
        descripcion_inferida:
          "Sugiere vínculo con una tabla de pedidos de venta, permitiendo trazar el albarán al pedido original si existe.",
      },
      facturas_venta: {
        tabla_relacionada: "[Tabla de Facturas de Venta]", // Nombre de tabla no especificado (ej: facturas-e)
        tipo: "Uno a uno o Uno a cero-o-uno (un albarán se asocia a una factura o ninguna)", // Tipo inferido
        campo_enlace_local: "AV_FRA", // El campo que contiene el número/id de la factura
        campo_enlace_externo: "[Campo id/número en tabla de facturas de venta]", // Nombre de campo no especificado
        descripcion_inferida:
          "Sugiere vínculo con una tabla de facturas de venta, permitiendo asociar el albarán a la factura emitida.",
      },
    },
    ejemplos: {
      consulta_albaran_por_id:
        "Obtener los detalles de un albarán de venta ornamental específico usando su 'id'.",
      consultar_info_relacionada:
        "Para un albarán, usar AV_CCL, AV_VD, AV_ALM y AV_FP para consultar 'clientes', 'vendedores', 'almacenes' y 'fpago' y obtener los nombres del cliente, vendedor, almacén y forma de pago.",
      filtrar_albaranes_por_cliente_o_fecha:
        "Listar albaranes de venta ornamental emitidos a un cliente específico (filtrando por AV_CCL) o en una fecha o rango de fechas (filtrando por AV_FEC).",
      filtrar_albaranes_por_vendedor_o_almacen:
        "Buscar albaranes gestionados por un vendedor (filtrando por AV_VD) o expedidos desde un almacén particular (filtrando por AV_ALM).",
      filtrar_albaranes_por_origen_venta:
        "Encontrar albaranes asociados a un origen o canal de venta específico (filtrando por AV_ORIVTA).",
    },
  },

  /* ================================================*/
  /* Ornamental – Ventas – Registro Facturas Emitidas */
  /* ================================================*/
  facturas_e: {
    // Clave principal (basada en el nombre de tabla)
    descripcion:
      "Registra las facturas de venta emitidas por la empresa. Incluye información sobre el cliente, almacén, vendedor, fecha, montos y forma de pago.", // Descripción sintetizada de los campos
    tabla: "facturas-e", // Nombre de tabla original
    columnas: {
      id: "Número de factura (Clave Primaria)",
      FE_CCL: "Código de cliente. Clave foránea a la tabla 'clientes' para obtener la denominación (CL_DENO).",
      FE_ALM: "Información del almacén. Clave foránea a la tabla 'almacenes' para obtener la denominación (AM_DENO).",
      FE_VD: "Vendedor. Clave foránea a la tabla 'vendedores' para obtener la denominación (VD_DENO).",
      FE_FEC: "Fecha.",
      FE_BRU: "Monto bruto.",
      FE_PTE: "PENDIENTE DE PAGO",
      FE_NETO: "Monto neto.",
      FE_IMPU: "Monto de impuesto.",
      FE_TTT: "Total.",
      FE_FP: "Forma de pago. Clave foránea a la tabla 'fpago' para obtener la denominación (FP_DENO).",
    },
    relaciones: {
      clientes: {
        tabla_relacionada: "clientes",
        tipo: "Muchos a uno",
        campo_enlace_local: "FE_CCL",
        campo_enlace_externo: "id",
        descripcion: "Relación con la tabla 'clientes' para obtener detalles del cliente emisor.",
      },
      almacenes: {
        tabla_relacionada: "almacenes",
        tipo: "Muchos a uno",
        campo_enlace_local: "FE_ALM",
        campo_enlace_externo: "id",
        descripcion: "Relación con la tabla 'almacenes' para obtener detalles del almacén asociado.",
      },
      vendedores: {
        tabla_relacionada: "vendedores",
        tipo: "Muchos a uno",
        campo_enlace_local: "FE_VD",
        campo_enlace_externo: "id",
        descripcion: "Relación con la tabla 'vendedores' para obtener detalles del vendedor asociado.",
      },
      fpago: {
        tabla_relacionada: "fpago",
        tipo: "Muchos a uno",
        campo_enlace_local: "FE_FP",
        campo_enlace_externo: "id",
        descripcion: "Relación con la tabla 'fpago' para obtener detalles de la forma de pago.",
      },
      // Esta descripción no menciona explícitamente otras relaciones, como con albaranes de venta.
    },
    ejemplos: {
      consulta_factura_por_id: "Obtener todos los datos de una factura emitida usando su 'id'.",
      consultar_info_relacionada:
        "Para una factura, usar FE_CCL, FE_ALM, FE_VD y FE_FP para consultar 'clientes', 'almacenes', 'vendedores' y 'fpago' y obtener los nombres del proveedor, almacén, forma de pago y usuario registrador.",
      filtrar_facturas_por_cliente_o_fecha:
        "Listar facturas emitidas a un cliente específico (filtrando por FE_CCL) o en una fecha determinada (filtrando por FE_FEC).",
      consultar_montos:
        "Obtener los valores bruto (FE_BRU), neto (FE_NETO), impuesto (FE_IMPU) y total (FE_TTT) de una factura.",
    },
  },

  /* ================================================*/
  /* Ornamental – Producción – Partes */
  /* ================================================*/
  partes_orn: {
    // Clave principal (basada en el nombre de tabla)
    descripcion:
      "Registra operaciones/partes de producción en partidas de plantas ornamentales (cambios de envase, traslados, etc.). Formaliza y traza actividades, documentando cantidades, envases y ubicaciones antes/después. Crucial para control, trazabilidad y gestión del inventario por ubicación/envase.",
    tabla: "partes_orn", // Nombre de tabla original
    columnas: {
      id: "Código o identificador único del registro de parte de producción (Clave Primaria)",
      PTO_FEC: "Fecha en que se realizó la operación.",
      PTO_FAR: "Número de partida de producción asociada. Clave foránea a la tabla 'partidas'.", // Se relaciona con 'partidas' que a su vez se relaciona con 'articulos'
      PTO_PRO: "Proceso productivo realizado (Ej: 'CAMBIO DE SOPORTE'). Clave foránea a la tabla 'procesos' para obtener la denominación (PRO_DENO).",
      PTO_OUDS: "Cantidad de 'Anteriores unidades' afectadas.",
      PTO_OCAR: "Denominación del tipo de envase o maceta anterior. Clave foránea a la tabla 'envases_vta' para obtener la denominación (EV_DENO).",
      PTO_INV: "Valor del 'anterior invernadero' (campo de texto, sin relación definida a tabla 'invernaderos').", // Nota basada en la descripción
      PTO_OSEC: "Valor de la 'anterior secc' (sección) (campo de texto, sin relación definida a tabla de secciones).", // Nota basada en la descripción
      PTO_NUDS: "Cantidad de 'unidades afectadas' o nuevas unidades.",
      PTO_NCAR: "Denominación del tipo de envase o maceta nuevo. Clave foránea a la tabla 'envases_vta' para obtener la denominación (EV_DENO).",
      PTO_NINV: "Valor del 'nuevo invernadero' (campo de texto, sin relación definida a tabla 'invernaderos').", // Nota basada en la descripción
      // La segunda mención de PTO_OSEC en la descripción probablemente se refiere a la 'nueva secc'.
      // Se asume un campo implícito o el mismo campo se reutiliza, pero sin detalles claros.
      // Si hubiera un campo distinto para la nueva sección, seguiría la misma lógica:
      // PTO_NSEC_inferido: "Valor de la 'nueva secc' (sección) (campo de texto, sin relación definida)."
    },
    relaciones: {
      partidas: {
        tabla_relacionada: "partidas",
        tipo: "Muchos a uno",
        campo_enlace_local: "PTO_FAR",
        campo_enlace_externo: "id",
        descripcion: "Vincula el parte de producción con la partida a la que se refiere la operación.",
        relaciones_externas_de_partida: {
          // Relaciones que parten de la tabla relacionada (partidas)
          articulos: {
            tabla_relacionada: "articulos",
            tipo: "Muchos a uno (una partida tiene un artículo)", // Implícito
            campo_enlace_local: "PAR_SEM", // Campo en partidas que apunta a articulos
            campo_enlace_externo: "id", // Campo en articulos
            descripcion_inferida:
              "La tabla 'partidas' se relaciona con 'articulos' para obtener la denominación (AR_DENO) de la semilla/artículo de la partida.", // Inferido de la descripción de PTO_FAR
          },
        },
      },
      procesos: {
        tabla_relacionada: "procesos",
        tipo: "Muchos a uno",
        campo_enlace_local: "PTO_PRO",
        campo_enlace_externo: "id",
        descripcion: "Vincula el parte de producción con el proceso productivo realizado.",
      },
      envases_vta_anterior: {
        // Relación para el envase anterior
        tabla_relacionada: "envases_vta",
        tipo: "Muchos a uno",
        campo_enlace_local: "PTO_OCAR",
        campo_enlace_externo: "id",
        descripcion:
          "Vincula el parte de producción con la denominación del tipo de envase anterior a la operación.",
      },
      envases_vta_nuevo: {
        // Relación para el envase nuevo
        tabla_relacionada: "envases_vta",
        tipo: "Muchos a uno",
        campo_enlace_local: "PTO_NCAR",
        campo_enlace_externo: "id",
        descripcion:
          "Vincula el parte de producción con la denominación del tipo de envase nuevo después de la operación.",
      },
      // Observaciones sobre campos sin relación definida según la descripción:
      ubicaciones_texto: {
        campos_texto: ["PTO_INV", "PTO_NINV", "PTO_OSEC"], // Campos que almacenan valores de ubicación como texto
        relacion_formal_no_definida: true,
        tablas_relacionadas_esperadas: ["invernaderos", "secciones"],
        descripcion:
          "Los campos de invernadero (anterior/nuevo) y sección (anterior/nuevo) almacenan valores de ubicación como texto. Según la descripción, NO tienen relación formal (clave foránea) definida con las tablas maestras 'invernaderos' o 'secciones'.",
      },
    },
    ejemplos: {
      consulta_parte_por_id: "Obtener los detalles de un parte de producción ornamental específico usando su 'id'.",
      consultar_info_relacionada:
        "Para un parte, usar PTO_FAR, PTO_PRO, PTO_OCAR y PTO_NCAR para consultar 'partidas' (y 'articulos'), 'procesos' y 'envases_vta' (para ambos envases) y obtener sus nombres/denominaciones.",
      filtrar_por_partida_o_proceso:
        "Listar partes de producción asociados a una partida específica (filtrando por PTO_FAR) o que corresponden a un proceso particular (filtrando por PTO_PRO).",
      filtrar_por_fecha_o_envase:
        "Buscar partes realizados en una fecha (filtrando por PTO_FEC) o que implicaron un cambio a/desde un tipo de envase específico (filtrando por PTO_OCAR o PTO_NCAR).",
      filtrar_por_ubicacion_texto:
        "Buscar partes relacionados con un invernadero o sección específica (requiere filtrar por texto en los campos PTO_INV, PTO_NINV, PTO_OSEC).",
    },
  },



  /* ======================================================================================================================================================================*/
  /* ALMACEN                                                                                                                                                            */
  /* ======================================================================================================================================================================*/





  
/* ================================================*/
/* Almacen - General - Tratamientos fitosanitarios */
/* ================================================*/
tratamientos: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Catálogo de tratamientos fitosanitarios, incluyendo su denominación y método de aplicación. Contiene relaciones con las plagas que ataca, los productos fitosanitarios utilizados y las familias afectadas.",
    tabla: `tratamientos`, // Nombre de la tabla principal
    columnas: {
      id: "Código del tratamiento (Ej: '00000008') (Clave Primaria)",
      TT_DENO: "Denominación del tratamiento (Ej: 'BRASSICACEAE Y ASTERACEAE 1')",
      TT_MET: "Método de aplicación (Ej: 'Pulverización')",
    },
    relaciones: {
      tratamientos_tt_plag: {
        tabla_relacionada: "tratamientos_tt_plag",
        tipo: "Uno a muchos (un tratamiento ataca varias plagas)",
        campo_enlace_local: "id", // ID del tratamiento
        campo_enlace_externo: "id", // ID del tratamiento en la tabla de enlace
        descripcion: "Tabla de enlace que relaciona tratamientos con las plagas que ataca.",
        estructura_relacionada: {
          id: "ID del tratamiento fitosanitario.",
          id2: "Identificador secuencial dentro del tratamiento.",
          C0: "ID de la plaga. Clave foránea a la tabla 'plagas'.",
        },
        relaciones_internas_de_detalle: {
          plagas: {
            tabla_relacionada: "plagas",
            tipo: "Muchos a uno",
            campo_enlace_local: "C0",
            campo_enlace_externo: "id",
            descripcion: "Vincula el tratamiento con la plaga que ataca.",
          },
        },
      },
      tratamientos_tt_pro: {
        tabla_relacionada: "tratamientos_tt_pro",
        tipo: "Uno a muchos (un tratamiento utiliza varios productos)",
        campo_enlace_local: "id", // ID del tratamiento
        campo_enlace_externo: "id", // ID del tratamiento en la tabla de enlace
        descripcion: "Tabla de enlace que relaciona tratamientos con los productos fitosanitarios utilizados.",
        estructura_relacionada: {
          id: "ID del tratamiento fitosanitario.",
          id2: "Identificador secuencial dentro del tratamiento.",
          C0: "ID del tipo de producto fitosanitario. Clave foránea a la tabla 'tipo_trat'.",
          C1: "Dosis del producto (Ej: '30cc/hl').",
          C2: "Valor asociado al producto (Ej: '1000000000.00').",
        },
        relaciones_internas_de_detalle: {
          tipo_trat: {
            tabla_relacionada: "tipo_trat",
            tipo: "Muchos a uno",
            campo_enlace_local: "C0",
            campo_enlace_externo: "id",
            descripcion: "Vincula el tratamiento con el tipo de producto fitosanitario utilizado.",
          },
        },
      },
      tratamientos_tt_fam: {
        tabla_relacionada: "tratamientos_tt_fam",
        tipo: "Uno a muchos (un tratamiento afecta a varias familias)",
        campo_enlace_local: "id", // ID del tratamiento
        campo_enlace_externo: "id", // ID del tratamiento en la tabla de enlace
        descripcion: "Tabla de enlace que relaciona tratamientos con las familias afectadas.",
        estructura_relacionada: {
          id: "ID del tratamiento fitosanitario.",
          id2: "Identificador secuencial dentro del tratamiento.",
          C0: "ID de la familia afectada. Clave foránea a la tabla 'familias'.",
          C1: "Valor asociado a la familia (Ej: '25').",
          C2: "Otro valor asociado a la familia (Ej: '0').",
        },
        relaciones_internas_de_detalle: {
          familias: {
            tabla_relacionada: "familias",
            tipo: "Muchos a uno",
            campo_enlace_local: "C0",
            campo_enlace_externo: "id",
            descripcion: "Vincula el tratamiento con la familia afectada.",
          },
        },
      },
    },
    ejemplos: {
      consulta_tratamiento_por_id:
        "Obtener la denominación y método de aplicación de un tratamiento fitosanitario específico usando su 'id'.",
      listar_todos_tratamientos:
        "Listar todos los tratamientos fitosanitarios registrados.",
      consultar_plagas_atacadas:
        "Para un tratamiento, consultar la tabla 'tratamientos_tt_plag' para ver las plagas que ataca y luego obtener sus denominaciones desde la tabla 'plagas'.",
      consultar_productos_utilizados:
        "Para un tratamiento, consultar la tabla 'tratamientos_tt_pro' para ver los productos utilizados (y sus dosis) y obtener sus nombres desde 'tipo_trat'.",
      consultar_familias_afectadas:
        "Para un tratamiento, consultar la tabla 'tratamientos_tt_fam' para ver las familias afectadas y obtener sus denominaciones desde la tabla 'familias'.",
    },
  },

  /* ================================================*/
  /* Almacen - General - Telefonos */
  /* ================================================*/
  telefonos: {
    // Clave principal (basada en el nombre de la sección o prefijo de campo)
    descripcion:
      "Catálogo centralizado para el registro y administración de los números de teléfono utilizados por la empresa. Documenta números, extensiones, estado, operadora y otros detalles para gestión interna de comunicaciones.",
    tabla: "telefonos", // Nombre de tabla inferido (campos con prefijo TLF_)
    columnas: {
      id: "Número de teléfono principal (Clave Primaria)", // Nota: el ID es el número de teléfono
      TLF_DENO: "Denominación o descripción asociada al teléfono.",
      TLF_EXT: "Número de extensión telefónica, si aplica.",
      TLF_BAJA: "Indica si el teléfono está dado de baja (1: sí, 0: no).",
      TLF_OPER: "Operadora o compañía de telecomunicaciones que provee el servicio (Ej: VODAFONE).",
      TLF_TITE: "Indicador relacionado con el 'título empresa' (1: sí, 0: no). Uso específico no detallado.",
    },
    relaciones: {
      observaciones:
        "La descripción proporcionada no detalla explícitamente relaciones formales (claves foráneas) con otras tablas del sistema. Esta tabla parece funcionar como un catálogo independiente de números de teléfono.",
    },
    ejemplos: {
      consulta_telefono_por_numero:
        "Obtener los detalles de un número de teléfono específico usando su 'id' (el propio número).",
      listar_telefonos: "Obtener el listado de todos los números de teléfono registrados.",
      filtrar_por_estado:
        "Listar teléfonos que están activos (TLF_BAJA = 0) o dados de baja (TLF_BAJA = 1).",
      filtrar_por_operadora:
        "Buscar teléfonos provistos por una operadora específica (filtrando por TLF_OPER).",
    },
  },





  /* ================================================*/
  /* Almacen - Almacen - Recuento inventario */
  /* ================================================*/
 /* recuento_inventario: {
    // Clave principal (basada en el nombre de la sección)
    descripcion:
      "Registra los eventos de recuento físico de inventario. Documenta cuándo y dónde se realizó un recuento, quién fue el vendedor/usuario responsable, y las unidades contadas o la diferencia encontrada.", // Descripción sintetizada actualizada
    tabla: "inventario", // Nombre de tabla original (Nota: Aunque la tabla se llama 'inventario', la descripción se refiere al evento de 'recuento')
    columnas: {
      id: "Número de inventario o identificador único del registro de recuento (Clave Primaria)",
      IN_FEC: "Fecha del recuento.",
      IN_VEN: "Vendedor o usuario responsable del recuento. Clave foránea a la tabla 'vendedores' para obtener la denominación (VD_DENO).",
      IN_ALM: "Almacén donde se realizó el recuento. Clave foránea a la tabla 'almacenes' para obtener la denominación (AM_DENO).",
      IN_UDS: "Representa Uds/Diferencia (Unidades contadas o la diferencia encontrada).", // Nuevo campo añadido
    },
    relaciones: {
      vendedores: {
        tabla_relacionada: "vendedores",
        tipo: "Muchos a uno",
        campo_enlace_local: "IN_VEN",
        campo_enlace_externo: "id",
        descripcion: "Vincula el recuento de inventario con el vendedor o usuario responsable.",
      },
      almacenes: {
        tabla_relacionada: "almacenes",
        tipo: "Muchos a uno",
        campo_enlace_local: "IN_ALM",
        campo_enlace_externo: "id",
        descripcion: "Vincula el recuento de inventario con el almacén donde se realizó.",
      },
      observaciones:
        "La descripción proporcionada se centra en los datos de 'cabecera' del recuento (quién, cuándo, dónde) y el total de unidades/diferencia (IN_UDS), pero no detalla cómo se registran los elementos específicos contados por artículo y su cantidad individual, lo cual normalmente requeriría una tabla de detalle relacionada.",
    },
    ejemplos: {
      consulta_recuento_por_id:
        "Obtener los detalles de cabecera de un recuento de inventario específico usando su 'id'.",
      consultar_info_relacionada:
        "Para un recuento, usar IN_VEN y IN_ALM para consultar 'vendedores' y 'almacenes' y obtener los nombres del vendedor y almacén.",
      filtrar_recuentos_por_fecha:
        "Listar recuentos de inventario realizados en una fecha o rango de fechas específico (filtrando por IN_FEC).",
      filtrar_recuentos_por_vendedor_o_almacen:
        "Buscar recuentos realizados por un vendedor (filtrando por IN_VEN) o en un almacén particular (filtrando por IN_ALM).",
      consultar_unidades_diferencia:
        "Obtener el valor de unidades contadas o la diferencia (IN_UDS) para un recuento.",
      filtrar_por_unidades_diferencia:
        "Buscar recuentos con un valor específico o rango de valores en IN_UDS.",
    },
  },
*/






  /* ================================================*/
/* Almacén - Almacén - Recuentos plantas */
/* ================================================*/
inventario_pl: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Gestiona los recuentos e inventarios de plantas. Registra la fecha del recuento, el vendedor y el almacén responsables, y una descripción del inventario. Los detalles de las plantas contadas se almacenan en una tabla relacionada.",
    tabla: `inventario_pl`, // Nombre de la tabla principal
    columnas: {
      id: "Código identificador único del registro de inventario/recuento de plantas (Clave Primaria).",
      INP_FEC: "Fecha en la que se realizó el recuento de inventario.",
      INP_VEN: "Vendedor responsable del recuento. Clave foránea a la tabla 'vendedores' para obtener la denominación (VD_DENO).",
      INP_ALM: "Almacén donde se realizó el recuento. Clave foránea a la tabla 'almacenes' para obtener la denominación (AM_DENO).",
      INP_DES: "Descripción importante del recuento (ej: 'Inventario Marzo 2025').",
    },
    relaciones: {
      vendedores: {
        tabla_relacionada: "vendedores",
        tipo: "Muchos a uno",
        campo_enlace_local: "INP_VEN",
        campo_enlace_externo: "id",
        descripcion: "Vincula el recuento de plantas con el vendedor que lo gestionó.",
      },
      almacenes: {
        tabla_relacionada: "almacenes",
        tipo: "Muchos a uno",
        campo_enlace_local: "INP_ALM",
        campo_enlace_externo: "id",
        descripcion: "Vincula el recuento de plantas con el almacén donde se realizó.",
      },
      inventario_pl_inp_lna: {
        tabla_relacionada: "inventario_pl_inp_lna",
        tipo: "Uno a muchos (un registro de inventario puede tener múltiples líneas de plantas contadas)",
        campo_enlace_local: "id", // ID del registro de inventario en la tabla principal
        campo_enlace_externo: "id", // ID del registro de inventario en la tabla de detalle
        descripcion: "Detalla las plantas contadas en cada recuento de inventario, incluyendo la partida, el artículo, las bandejas y los costes asociados.",
        estructura_relacionada: {
          id: "Código del registro de inventario (igual que 'inventario_pl.id').",
          id2: "Identificador secuencial de la línea de detalle (indica la cantidad expansiva de registros de plantas o inventario).",
          C0: "Número de partida. Clave foránea a la tabla 'partidas'.",
          C1: "Denominación del artículo o nombre de la semilla.", // Aunque es una denominación, podría inferirse una relación con 'articulos' si 'C0' es la partida que contiene el artículo.
          C2: "Indicador de si el cliente entrega semilla ('D' para depósito, 'N' para no entrega).",
          C3: "Número de bandejas.",
          C4: "Coste de la semilla.",
          C5: "Coste por planta (Pcoste Pl).",
          C6: "Coste general (Pcoste).",
          C7: "Importe total.",
        },
        relaciones_internas_de_detalle: {
          partidas: {
            tabla_relacionada: "partidas",
            tipo: "Muchos a uno",
            campo_enlace_local: "C0",
            campo_enlace_externo: "id", // Suponiendo 'id' es la clave primaria de 'partidas'
            descripcion: "Vincula la línea del recuento con la partida de siembra asociada.",
          },
          // Si C1 (denominación del artículo) siempre se refiere a un ID en la tabla 'articulos',
          // se podría agregar una relación aquí, aunque la descripción lo presenta como una denominación.
          /*
          articulos: {
            tabla_relacionada: "articulos",
            tipo: "Muchos a uno",
            campo_enlace_local: "C1", // Esto requeriría que C1 sea un ID de artículo, no una denominación
            campo_enlace_externo: "AR_DENO", // O un campo ID de artículo si C1 es un ID
            descripcion: "Posible vínculo con el artículo si C1 es un identificador y no solo una denominación.",
          }
          */
        },
      },
    },
    ejemplos: {
      consulta_inventario_por_id:
        "Obtener la fecha, vendedor, almacén y descripción de un recuento de inventario específico usando su 'id'.",
      consultar_plantas_contadas:
        "Para un recuento de inventario (ej. ID '000083'), listar todas las líneas de 'inventario_pl_inp_lna', mostrando el número de partida, denominación del artículo, número de bandejas y costes asociados.",
      filtrar_inventarios_por_almacen_o_fecha:
        "Buscar recuentos de plantas realizados en un almacén específico o dentro de un rango de fechas.",
      analisis_de_costes_por_partida:
        "Calcular el coste total de las plantas por partida sumando los 'C7' (importe) de las líneas de 'inventario_pl_inp_lna' agrupadas por 'C0' (número de partida).",
      seguimiento_semilla_deposito:
        "Identificar partidas donde el cliente entregó semilla (C2 = 'D').",
    },
  },

 /* ================================================*/
/* Almacen - Almacen - Consumo */
/* ================================================*/
consumo: {
    // Clave principal (basada en el nombre de la sección)
    descripcion:
      "Registra eventos de 'consumo', es decir, salidas de inventario por motivos distintos a ventas (uso interno, mermas, etc.). Documenta la salida de inventario por almacén y fecha, con una descripción del responsable y el valor total, además de los detalles de los artículos consumidos.",
    tabla: "consumo", // Nombre de tabla inferido (campos con prefijo TC_)
    columnas: {
      id: "Código identificador único del registro de consumo (Clave Primaria). Este ID se utiliza como clave foránea en la tabla 'consumo_tc_lna'.",
      TC_FEC: "Fecha en la que se registró el consumo.",
      TC_AMO: "Código del almacén donde se realizó el consumo. Clave foránea a la tabla 'almacenes' para obtener la denominación (AM_DENO).",
      TC_PDP: "Descripción de quién realizó el consumo (campo de texto descriptivo, no clave foránea a tabla de personal/usuarios según descripción).",
      TC_TTT: "Monto total asociado al consumo.",
    },
    relaciones: {
      almacenes: {
        tabla_relacionada: "almacenes",
        tipo: "Muchos a uno",
        campo_enlace_local: "TC_AMO",
        campo_enlace_externo: "id",
        descripcion: "Vincula el registro de consumo con el almacén donde ocurrió la salida de inventario.",
      },
      consumo_tc_lna: {
        tabla_relacionada: "consumo_tc_lna",
        tipo: "Uno a muchos (un registro de consumo puede detallar múltiples artículos consumidos)",
        campo_enlace_local: "id", // ID del registro de consumo en la tabla principal
        campo_enlace_externo: "id", // ID del registro de consumo en la tabla de detalle
        descripcion: "Detalla los artículos específicos que fueron consumidos en cada registro de consumo, incluyendo remesa, envase, unidades y coste.",
        estructura_relacionada: {
          id: "ID del registro de consumo (igual que 'consumo.id').",
          id2: "Identificador secuencial de la línea de detalle (para múltiples consumos dentro del mismo registro, ej: '1', '2', '3').",
          C0: "Número de remesa asociado al artículo consumido.",
          C1: "Código del artículo consumido. Clave foránea a la tabla 'articulos' para obtener la denominación (AR_DENO).",
          C2: "Código del envase del artículo.",
          C3: "Unidades consumidas del artículo.",
          C4: "Costo unitario o coste de la partida del artículo (Pcoste).",
        },
        relaciones_internas_de_detalle: {
          articulos: {
            tabla_relacionada: "articulos",
            tipo: "Muchos a uno",
            campo_enlace_local: "C1",
            campo_enlace_externo: "id",
            descripcion: "Vincula el artículo de la línea de consumo con su información detallada (ej. denominación AR_DENO).",
          },
        },
      },
    },
    ejemplos: {
      consulta_consumo_por_id: "Obtener los detalles de un registro de consumo específico usando su 'id'.",
      consultar_almacen_consumo:
        "Para un registro de consumo, usar TC_AMO para consultar la tabla 'almacenes' y obtener el nombre del almacén (AM_DENO).",
      filtrar_consumos_por_fecha_o_almacen:
        "Listar consumos registrados en una fecha o rango de fechas específico (filtrando por TC_FEC) o en un almacén particular (filtrando por TC_AMO).",
      buscar_consumos_por_responsable:
        "Buscar registros de consumo que contengan cierta descripción en el campo TC_PDP ('quién realizó el consumo').",
      consultar_valor_total: "Obtener el valor total (TC_TTT) asociado a un registro de consumo.",
      consultar_articulos_consumidos:
        "Para un registro de consumo, listar todos los artículos detallados en 'consumo_tc_lna', incluyendo su número de remesa, código de envase, unidades y coste, y obtener la denominación del artículo a través de la tabla 'articulos'.",
      analisis_de_consumo_por_articulo:
        "Calcular la cantidad total de un artículo específico que ha sido consumido en un periodo, sumando las 'C3' de la tabla 'consumo_tc_lna' y uniéndolo a 'articulos' para la denominación.",
    },
  },

  /* ================================================*/
  /* Almacén - Varios - Remesas */
  /* ================================================*/
  remesas_art: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Registra movimientos específicos de semillas almacenadas en cámara, especialmente aquellas destinadas a semilleros propios como los de tomate o brócoli. Permite llevar el control de lotes disponibles, unidades por envase, fechas de remesa y cliente destinatario, incluyendo observaciones adicionales. Es clave para gestionar semanalmente la disponibilidad de semillas sobrantes, evaluar su ciclo biológico (corto o largo), evitar pérdidas por pérdida de vigor, y planificar su uso antes de su caducidad. También permite documentar las salidas internas hacia semilleros, facilitando trazabilidad completa por lote, variedad y cliente.",
    tabla: "remesas_art", // Nombre de tabla principal
    columnas: {
      id: "Código identificador único del registro de remesa (Clave Primaria)",
      REA_AR: "Código del artículo que se remite. Clave foránea a la tabla 'articulos' para obtener la denominación (AR_DENO).",
      REA_SOB: "Codigo de envases, tiene relacion con la tabla 'envases_vta', con el mismo id obtenemos la denominacion EV_DENO",
      REA_ORI: "Tipo de origen: Si indica 'Deposito' significa que tiene relacion con la tabla 'deposito' esta tabla 'deposito' tiene relacion con la tabla 'encargos' a traves del campo 'DE_ENG', si indica 'Compra' significa que tiene relacion con la tabla 'alb-compra' a traves del campo id para obtener la informacion correspondiente de cada remesa",
      REA_RELA: "Codigo relacionado",
      REA_UDS: "Numero de sobres",
      REA_LOTE: "Número de lote",
      REA_CCL: "Código del cliente asociado a la remesa. Clave foránea a la tabla 'clientes' para obtener la denominación (CL_DENO).",
      REA_CFRA: "",
      REA_EST: "Las remesas tienen dos estados, 1 o nada, el estado 1 indica que la remesa esta terminada, y si nada significa que la remesa sin terminar, no contiene nada",
      REA_UXE: "Unidades por Envase en la remesa.",
      REA_PVP: "PvP",
      REA_FEC: "Fecha de la remesa",
      REA_GTV: "GTV:",
      // Observaciones se almacenan en una tabla separada (remesas_art_rea_obs)
    },
    relaciones: {
      articulos: {
        tabla_relacionada: "articulos",
        tipo: "Muchos a uno",
        campo_enlace_local: "REA_AR",
        campo_enlace_externo: "id",
        descripcion: "Vincula la remesa con el artículo específico que se remite.",
      },
      articulos: {
        tabla_relacionada: "articulos",
        tipo: "Muchos a uno",
        campo_enlace_local: "REA_AR",
        campo_enlace_externo: "id",
        descripcion: "Vincula la remesa con el artículo específico que se remite.",
      },
      alb_compra: {
        tabla_relacionada: "alb-compra",
        tipo: "Muchos a uno",
        campo_enlace_local: "REA_RELA",
        campo_enlace_externo: "id",
        descripcion: "Vincula la remesa con el cliente o destinatario asociado.",
        estructura_relacionada: {
          // Estructura de la tabla relacionada
          id: "Código único que identifica cada albarán de compra (Clave Primaria)",
      AC_NPD: "Número del pedido de compra asociado.", // Sugiere relación con tabla de pedidos de compra
      AC_CPR: "Número del proveedor. Clave foránea a la tabla 'proveedores' para obtener la denominación (PR_DENO).",
      AC_ALM: "Almacén de recepción en Semilleros Deitana. Clave foránea a la tabla 'almacenes' para obtener la denominación (AM_DENO).",
      AC_FEC: "Fecha en que se registró el albarán de compra.",
      AC_SUA: "Número del albarán proporcionado por el proveedor.",
      AC_FP: "Forma de pago acordada. Clave foránea a la tabla 'fpago' para obtener la denominación (FP_DENO).",
      AC_FRA: "Número de la factura del proveedor asociada.", // Sugiere relación con tabla de facturas proveedor
      AC_FFR: "Fecha de la factura del proveedor asociada.", // Sugiere relación con tabla de facturas proveedor
      AC_BRU: "Monto bruto total del albarán.",
      AC_NETO: "Monto neto del albarán.",
      AC_IMPU: "Costo total de los impuestos aplicados.",
      AC_TTT: "Monto total final del albarán.",
        },
      },
      deposito: {
        tabla_relacionada: "deposito",
        tipo: "Muchos a uno",
        campo_enlace_local: "REA_RELA",
        campo_enlace_externo: "id",
        descripcion: "Vincula la remesa con el cliente o destinatario asociado.",
        estructura_relacionada: {
          // Estructura de la tabla relacionada
          id: "Código único que identifica a cada deposito",
      DE_FEC: "Representa la fecha de deposito", // Sugiere relación con tabla de pedidos de compra
      DE_AM: "Codigo del almacén, tiene relacion con la tabla 'almacenes' a traves del campo id",
      DE_CLI: "Codigo del cliente, tiene relacion con la tabla 'clientes' a traves del campo id",
      DE_USU: "Codigo del usuario, tiene relacion con la tabla 'usuarios' a traves del campo id",
      DE_ENG: "Codigo del encargo, tiene relacion con la tabla 'encargos' a traves del campo id",

      
        },

      },
      remesas_sob_rso_etiq: {
        tabla_relacionada: "remesas_sob_rso_etiq",
        tipo: "Muchos a uno",
        campo_enlace_local: "id",
        campo_enlace_externo: "id",
        descripcion: "Almacena informacion de sobres medios",
        estructura_relacionada: {
          // Estructura de la tabla relacionada
          id: "ID de la remesa asociada",
          id2: "Identificador secundario/orden de la línea",
          C0: "Etiq. Sobre",
          C1: "Fecha",
          C2: "Cantidad",
        },
      },
      remesas_art_rea_obs: {
        tabla_relacionada: "remesas_art_rea_obs",
        tipo: "Uno a muchos (una remesa puede tener múltiples observaciones)",
        campo_enlace_local: "id", // El id del registro en remesas_art
        campo_enlace_externo: "id", // El campo id en remesas_art_rea_obs que referencia al registro principal
        descripcion:
          "Almacena observaciones o comentarios detallados sobre la remesa. Las observaciones completas se reconstruyen concatenando el campo 'C0' de las filas vinculadas por 'id', ordenadas por 'id2'.",
        estructura_relacionada: {
          // Estructura de la tabla relacionada
          id: "ID de la remesa asociada",
          id2: "Identificador secundario/orden de la línea",
          C0: "Texto de la observación",
        },
      },
    },
    ejemplos: {
      consulta_remesa_por_id: "Obtener los detalles básicos de un registro de remesa usando su 'id'.",
      consultar_info_relacionada:
        "Para una remesa, usar REA_AR y REA_CCL para consultar 'articulos' y 'clientes' y obtener los nombres del artículo y cliente.",
      filtrar_remesas_por_articulo_o_cliente:
        "Listar remesas para un artículo específico (filtrando por REA_AR) o un cliente particular (filtrando por REA_CCL).",
      filtrar_remesas_por_lote:
        "Buscar remesas asociadas a un número de lote específico (filtrando por REA_LOTE).",
      consultar_observaciones:
        "Buscar y reconstruir las observaciones detalladas para una remesa específica en la tabla 'remesas_art_rea_obs'.",
    },
  },



/* ================================================*/
/* Almacén - Varios - Tarifas de precios */
/* ================================================*/
tarifas_plantas: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Gestiona las diferentes tarifas de precios para plantas, especificando el período de validez, el almacén asociado y el título de la tarifa. Un registro principal puede tener múltiples líneas de detalle que definen los precios por artículo y tipo de tarifa.",
    tabla: `tarifas_plantas`, // Nombre de la tabla principal
    columnas: {
      id: "Código identificador único de la tarifa (Clave Primaria).",
      TAP_DENO: "Denominación o título de la tarifa (ej: 'TARIFA ACTUALIZA 2024 – ULTIMA').",
      TAP_DFEC: "Fecha de inicio de validez de la tarifa de precio (ej: '2024-05-04').",
      TAP_HFEC: "Fecha de fin de validez de la tarifa de precio (ej: '2025-12-31').",
      TAP_ALM: "Código del almacén asociado a la tarifa. Clave foránea a la tabla 'almacenes' para obtener la denominación (AM_DENO).",
    },
    relaciones: {
      almacenes: {
        tabla_relacionada: "almacenes",
        tipo: "Muchos a uno",
        campo_enlace_local: "TAP_ALM",
        campo_enlace_externo: "id",
        descripcion: "Vincula la tarifa de plantas con el almacén al que aplica.",
      },
      tarifas_plantas_tap_lna: {
        tabla_relacionada: "tarifas_plantas_tap_lna",
        tipo: "Uno a muchos (una tarifa puede contener múltiples líneas de precios para diferentes productos/tipos)",
        campo_enlace_local: "id", // ID de la tarifa en la tabla principal
        campo_enlace_externo: "id", // ID de la tarifa en la tabla de detalle
        descripcion: "Detalla los precios de los productos específicos dentro de una tarifa, incluyendo el tipo de tarifa, costes y precios de venta.",
        estructura_relacionada: {
          id: "Código de la tarifa (igual que 'tarifas_plantas.id').",
          id2: "Identificador secuencial de la línea de detalle (indica la cantidad de productos con precios actualizados).",
          C0: "Código del artículo. Clave foránea a la tabla 'articulos' para obtener la denominación (AR_DENO).",
          C1: "Tipo de tarifa (ej: 'A', 'B'), que afecta el precio. Puede haber múltiples tipos para un mismo producto.",
          C2: "Tipo de siembra (ej: '5001').",
          C3: "Campo de propósito desconocido ('No se sabe').",
          C4: "Porcentaje (%).",
          C5: "Coste de producción.",
          C6: "Campo de propósito desconocido ('No se sabe').",
          C7: "Coste de la semilla.",
          C8: "Coste del patrón.",
          C9: "Incremento.",
          C10: "Precio de Venta al Público (PvP) Fijo por Bandeja.",
          C11: "Precio de Venta al Público (PvP) por Planta.",
          C12: "Precio de Venta al Público (PvP) por Bandeja.",
        },
        relaciones_internas_de_detalle: {
          articulos: {
            tabla_relacionada: "articulos",
            tipo: "Muchos a uno",
            campo_enlace_local: "C0",
            campo_enlace_externo: "id",
            descripcion: "Vincula la línea de precio con el artículo correspondiente para obtener su denominación.",
          },
          // Posible relación con 't-siembras' si C2 es una clave foránea.
          /*
          t_siembras: {
            tabla_relacionada: "t-siembras",
            tipo: "Muchos a uno",
            campo_enlace_local: "C2",
            campo_enlace_externo: "id",
            descripcion: "Vincula la línea de precio con el tipo de siembra."
          }
          */
        },
      },
    },
    ejemplos: {
      consulta_tarifa_por_id:
        "Obtener la denominación y el período de validez de una tarifa de precios específica usando su 'id'.",
      consultar_precios_de_tarifa:
        "Para una tarifa específica (ej. ID '21001414'), listar todos los artículos incluidos en esa tarifa desde 'tarifas_plantas_tap_lna', mostrando su denominación, tipo de tarifa, y los diferentes precios (PvP Fijo Bandeja, PvP Planta, PvP Bandeja).",
      buscar_precio_articulo_por_fecha:
        "Encontrar el precio de un artículo específico ('C0') para una fecha determinada, buscando en 'tarifas_plantas' la tarifa activa y luego en 'tarifas_plantas_tap_lna' el precio correspondiente.",
      analisis_de_costes_y_precios:
        "Comparar los costes de producción (C5), semilla (C7) y patrón (C8) con los precios de venta (C10, C11, C12) para evaluar la rentabilidad por artículo.",
    },
  },






  /* ================================================*/
  /* Almacén - Varios - Carros */
  /* ================================================*/
  carros: {
    // Clave principal (basada en el nombre de la sección/entidad)
    descripcion:
      "Registra y gestiona 'Carros' (trolleys/racks móviles) utilizados para mover o enviar bandejas/plantas. Rastrea su identificación, estado, cliente asociado y fecha de retirada. Útil para gestión de activos de transporte.",
    tabla: "carros", // Nombre de tabla inferido (campos con prefijo CA_)
    columnas: {
      id: "Código identificador único del registro del carro (Clave Primaria)",
      CA_IDEN: "Identificación o nombre asignado al carro (Ej: 'CARRO-01').",
      CA_EST: "Estado actual del carro (Ej: 'R' - disponible, etc.).",
      CA_CLI: "Código del cliente asociado al carro. Clave foránea a la tabla 'clientes' para obtener la denominación (CL_DENO).",
      CA_FEC: "Fecha de retirada (propósito específico puede variar).",
    },
    relaciones: {
      clientes: {
        tabla_relacionada: "clientes",
        tipo: "Muchos a uno",
        campo_enlace_local: "CA_CLI",
        campo_enlace_externo: "id",
        descripcion: "Vincula el carro con el cliente asociado para seguimiento.",
      },
      // No se detallan otras relaciones explícitamente en esta descripción.
    },
    ejemplos: {
      consulta_carro_por_id: "Obtener los detalles de un carro específico usando su 'id'.",
      filtrar_carros_por_estado:
        "Listar carros que se encuentran en un estado particular (filtrando por CA_EST).",
      consultar_cliente_carro:
        "Para un carro, usar CA_CLI para consultar la tabla 'clientes' y obtener el nombre del cliente asociado (CL_DENO).",
      filtrar_carros_por_cliente:
        "Buscar carros asociados a un cliente específico (filtrando por CA_CLI).",
      consultar_fecha_retirada: "Obtener la fecha de retirada (CA_FEC) para un carro.",
    },
  },

  /* ================================================*/
  /* Almacén - Varios - Depositos */
  /* ================================================*/
  depositos: {
    // Clave principal (basada en el nombre de la sección)
    descripcion:
      "Registra información sobre 'Depósitos' (monetarios o de mercancía) asociados a encargos de siembra. Documenta el depósito, su fecha, almacén y el encargo de siembra relacionado. Crucial para seguimiento de depósitos vinculados a órdenes de siembra.",
    tabla: "depositos", // Nombre de tabla inferido (campos con prefijo DE_)
    columnas: {
      id: "Código identificador único del registro de depósito (Clave Primaria)",
      DE_FEC: "Fecha en que se realizó el Depósito.",
      DE_AM: "Código del almacén asociado al depósito. Clave foránea a la tabla 'almacenes' para obtener la denominación (AM_DENO).",
      DE_ENG: "Número del Encargo de siembra relacionado. Sugiere una relación con la tabla 'encargos'.", // Nota basada en la descripción
    },
    relaciones: {
      almacenes: {
        tabla_relacionada: "almacenes",
        tipo: "Muchos a uno",
        campo_enlace_local: "DE_AM",
        campo_enlace_externo: "id",
        descripcion: "Vincula el depósito con el almacén asociado.",
      },
      // Relación potencial inferida:
      encargos: {
        tabla_relacionada: "encargos", // Nombre de tabla inferido (basado en la sección "Encargos de siembra")
        tipo: "Muchos a uno (varios depósitos pueden estar relacionados con el mismo encargo)", // Tipo inferido
        campo_enlace_local: "DE_ENG", // El campo que contiene el número/id del encargo
        campo_enlace_externo: "id", // Asumimos 'id' es el campo identificador en la tabla 'encargos'
        descripcion_inferida:
          "Sugiere vínculo con la tabla 'encargos', permitiendo asociar el depósito al encargo de siembra correspondiente.",
      },
    },
    ejemplos: {
      consulta_deposito_por_id: "Obtener los detalles de un registro de depósito específico usando su 'id'.",
      filtrar_depositos_por_fecha:
        "Listar depósitos realizados en una fecha o rango de fechas específico (filtrando por DE_FEC).",
      consultar_almacen_deposito:
        "Para un depósito, usar DE_AM para consultar la tabla 'almacenes' y obtener el nombre del almacén asociado (AM_DENO).",
      filtrar_depositos_por_almacen:
        "Buscar depósitos realizados en un almacén particular (filtrando por DE_AM).",
      filtrar_depositos_por_encargo:
        "Encontrar depósitos relacionados con un número de encargo específico (filtrando por DE_ENG).",
      obtener_info_encargo:
        "Para un depósito, usar DE_ENG para consultar la tabla 'encargos' y obtener detalles del encargo de siembra relacionado (requiere que la relación esté implementada).",
    },
  },

  /* ================================================*/
  /* Almacén – Maquinaria - Maquinaria */
  /* ================================================*/
  maquinaria: {
    // Clave principal (basada en el nombre de la sección)
    descripcion:
      "Registra y administra las máquinas y equipos utilizados por la empresa como un inventario detallado. Permite mantener un registro completo de características, adquisición, seguro, operador actual y tipo de maquinaria. Crucial para gestión de activos, mantenimiento, control y asignación.",
    tabla: "maquinaria", // Nombre de tabla inferido (campos con prefijo MA_)
    columnas: {
      id: "Código identificador único de cada máquina o equipo (Clave Primaria)",
      MA_MOD: "Modelo de la maquinaria (Ej: 'Balanza-2 CABEZAL INV.B COBOS').",
      MA_TIPO: "Tipo de maquinaria (campo genérico, distinto de MA_TP).",
      MA_NU: "Información relacionada con el uso de la maquinaria.",
      MA_AFAB: "Año de Fabricación.",
      MA_FCOM: "Año de compra.",
      MA_BAS: "Número de Bastidor.",
      MA_VSE: "Fecha de vencimiento del seguro.",
      MA_COM: "Nombre de la compañía de seguro (campo de texto).",
      MA_TRAB: "Código del trabajador técnico conductor actual. Clave foránea a la tabla 'tecnicos' para obtener la denominación (TN_DENO).",
      MA_TP: "Código del tipo general de maquinaria. Clave foránea a la tabla 'tipo-maq' para obtener la denominación (TM_DENO).",
    },
    relaciones: {
      tecnicos: {
        tabla_relacionada: "tecnicos",
        tipo: "Muchos a uno",
        campo_enlace_local: "MA_TRAB",
        campo_enlace_externo: "id",
        descripcion: "Vincula la maquinaria con el trabajador técnico que la opera/conduce actualmente.",
      },
      tipo_maquinaria: {
        // Usamos un nombre más descriptivo para la relación con tipo-maq
        tabla_relacionada: "tipo-maq",
        tipo: "Muchos a uno",
        campo_enlace_local: "MA_TP",
        campo_enlace_externo: "id",
        descripcion: "Vincula la maquinaria con su tipo general, definido en la tabla 'tipo-maq'.",
      },
      // La descripción no detalla explícitamente otras relaciones formales.
    },
    ejemplos: {
      consulta_maquinaria_por_id: "Obtener todos los detalles de una máquina específica usando su 'id'.",
      consultar_info_relacionada:
        "Para una máquina, usar MA_TRAB y MA_TP para consultar 'tecnicos' y 'tipo-maq' y obtener el nombre del conductor actual (TN_DENO) y la denominación del tipo de maquinaria (TM_DENO).",
      filtrar_por_tipo_general:
        "Listar maquinaria de un tipo general específico usando el campo MA_TP (vinculando con 'tipo-maq' si es necesario filtrar por nombre de tipo).",
      filtrar_por_conductor_actual:
        "Buscar maquinaria asignada a un trabajador específico (filtrando por MA_TRAB).",
      consultar_fechas_clave:
        "Obtener el año de fabricación (MA_AFAB), año de compra (MA_FCOM) o fecha de vencimiento del seguro (MA_VSE) de una máquina.",
      buscar_por_modelo_o_bastidor:
        "Encontrar maquinaria usando su modelo (MA_MOD) o número de bastidor (MA_BAS).",
    },
  },


  
  /* ================================================*/
  /* Almacén – Maquinaria - Tipo Maquinaria */
  /* ================================================*/
  tipo_maq: {
    // Clave principal (basada en el nombre de tabla)
    descripcion:
      "Define y gestiona las categorías o tipos de maquinaria utilizados por la empresa. Funciona como un catálogo maestro para estandarizar la clasificación de equipos y sirve como referencia para otros módulos.",
    tabla: "tipo-maq", // Nombre de tabla original
    columnas: {
      id: "Código identificador único asignado a cada tipo de maquinaria (Clave Primaria)",
      TM_DENO: "Denominación o nombre descriptivo del tipo de máquina (Ej: 'CAMION').",
    },
    relaciones: {
      maquinaria: {
        tabla_relacionada: "maquinaria", // Nombre inferido de la tabla que contiene los registros individuales de máquinas
        tipo: "Uno a muchos (un tipo puede aplicarse a muchas máquinas)",
        campo_enlace_local: "id", // El id en tipo-maq
        campo_enlace_externo: "MA_TP", // El campo en la tabla 'maquinaria' que referencia a tipo-maq.id
        descripcion:
          "Es referenciada por la tabla 'maquinaria' (mediante el campo MA_TP) para clasificar cada máquina individual por su tipo.",
      },
    },
    ejemplos: {
      consulta_tipo_por_id: "Obtener los detalles de un tipo de maquinaria específico usando su 'id'.",
      consulta_tipo_por_denominacion:
        "Buscar un tipo de maquinaria por su denominación (TM_DENO).",
      consultar_maquinas_por_tipo:
        "Listar todas las máquinas individuales que pertenecen a un tipo específico (requiere consultar la tabla 'maquinaria' filtrando por MA_TP).",
    },
  },

  /* ================================================*/
  /* Almacén – Maquinaria - Reparaciones */
  /* ================================================*/
  reparacion: {
    // Clave principal (basada en el nombre de tabla)
    descripcion:
      "Registra el historial de reparaciones de maquinaria y equipos. Documenta qué máquina se arregló, cuándo, quién (técnico/proveedor), dónde (almacén) y cuánto costó. Fundamental para seguimiento de mantenimiento, costos y rendimiento de equipos.", // Descripción sintetizada
    tabla: "reparacion", // Nombre de tabla original
    columnas: {
      id: "Código único que identifica cada registro de reparación (Clave Primaria)",
      REP_MAQ: "Código de la máquina que se reparó. Clave foránea a la tabla 'maquinaria' para obtener detalles como el modelo (MA_MOD).",
      REP_FEC: "Fecha en que se realizó la reparación.",
      REP_MEC: "Código del mecánico o técnico que realizó el arreglo. Clave foránea a la tabla 'tecnicos' para obtener el nombre (TN_DENO).",
      REP_SUC: "Código del almacén o sucursal donde se hizo o gestionó el arreglo. Clave foránea a la tabla 'almacenes' para obtener el nombre (AM_DENO).",
      REP_PRV: "Código del proveedor que hizo el arreglo o vendió las partes. Clave foránea a la tabla 'proveedores' para obtener el nombre (PR_DENO).",
      REP_NETO: "Costo neto de la reparación.",
      REP_IMPU: "Impuestos del costo de la reparación.",
      REP_TTT: "Costo total de la reparación.",
      REP_BRU: "Costo bruto de la reparación.",
    },
    relaciones: {
      maquinaria: {
        tabla_relacionada: "maquinaria",
        tipo: "Muchos a uno",
        campo_enlace_local: "REP_MAQ",
        campo_enlace_externo: "id",
        descripcion: "Vincula el registro de reparación con la máquina específica que fue reparada.",
      },
      tecnicos: {
        tabla_relacionada: "tecnicos",
        tipo: "Muchos a uno",
        campo_enlace_local: "REP_MEC",
        campo_enlace_externo: "id",
        descripcion: "Vincula el registro de reparación con el técnico o mecánico que realizó el arreglo.",
      },
      almacenes: {
        tabla_relacionada: "almacenes",
        tipo: "Muchos a uno",
        campo_enlace_local: "REP_SUC",
        campo_enlace_externo: "id",
        descripcion: "Vincula el registro de reparación con el almacén o sucursal donde se gestionó la reparación.",
      },
      proveedores: {
        tabla_relacionada: "proveedores",
        tipo: "Muchos a uno",
        campo_enlace_local: "REP_PRV",
        campo_enlace_externo: "id",
        descripcion: "Vincula el registro de reparación con el proveedor que realizó el arreglo o proveyó las partes.",
      },
    },
    ejemplos: {
      consulta_reparacion_por_id: "Obtener todos los detalles de un registro de reparación específico usando su 'id'.",
      consultar_info_relacionada:
        "Para una reparación, usar REP_MAQ, REP_MEC, REP_SUC y REP_PRV para consultar 'maquinaria', 'tecnicos', 'almacenes' y 'proveedores' y obtener detalles (modelo de máquina, nombre de técnico, nombre de almacén, nombre de proveedor).",
      filtrar_reparaciones_por_maquina_o_fecha:
        "Listar todas las reparaciones realizadas para una máquina específica (filtrando por REP_MAQ) o en un rango de fechas (filtrando por REP_FEC).",
      filtrar_reparaciones_por_tecnico_o_proveedor:
        "Buscar reparaciones realizadas por un técnico específico (filtrando por REP_MEC) o por un proveedor particular (filtrando por REP_PRV).",
      analizar_costos_reparacion:
        "Obtener y comparar los costos (REP_BRU, REP_NETO, REP_IMPU, REP_TTT) para una o varias reparaciones.",
    },
  },

  /* ================================================*/
  /* Almacén – Maquinaria - Partes Gasoil */
  /* ================================================*/
  partes_gas: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Registra y gestiona los 'Partes de Gasoil', documentando la carga o el consumo de combustible asociado a máquinas y vehículos. Permite control detallado de quién carga, en qué máquina, fecha, almacén y tipo de combustible para control de costes y gestión de maquinaria.",
    tabla: "partes_gas", // Nombre de tabla principal
    columnas: {
      id: "Código identificador único del registro de parte de gasoil (Clave Primaria)",
      PGL_FEC: "Fecha en que se realizó la carga o el registro.",
      PGL_ALM: "Código del almacén asociado al registro. Clave foránea a la tabla 'almacenes' para obtener la denominación (AM_DENO).",
      PGL_MAQ: "Código de la máquina a la que se le carga el gasoil. Clave foránea a la tabla 'maquinaria' para obtener el modelo (MA_MOD).",
      PGL_CANT: "Cantidad de gasoil cargada (en litros o unidad correspondiente).",
      PGL_COSTE: "Coste total de la carga de gasoil.",
      PGL_TIPO: "Tipo de gasoil o combustible cargado.",
    },
    relaciones: {
      almacenes: {
        tabla_relacionada: "almacenes",
        tipo: "Muchos a uno",
        campo_enlace_local: "PGL_ALM",
        campo_enlace_externo: "id",
        descripcion: "Vincula el parte de gasoil con el almacén donde se realizó la carga.",
      },
      maquinaria: {
        tabla_relacionada: "maquinaria",
        tipo: "Muchos a uno",
        campo_enlace_local: "PGL_MAQ",
        campo_enlace_externo: "id",
        descripcion: "Vincula el parte de gasoil con la máquina a la que se le carga el gasoil.",
      },
      partes_gas_pgl_lna: {
        tabla_relacionada: "partes_gas_pgl_lna",
        tipo: "Uno a muchos (un parte de gasoil puede tener múltiples líneas de detalle)",
        campo_enlace_local: "id", // El id del registro en partes_gas
        campo_enlace_externo: "id", // El campo id en partes_gas_pgl_lna que referencia al registro principal
        descripcion:
          "Almacena las líneas de detalle de cada parte de gasoil, conteniendo información específica de la transacción de combustible (máquina, técnico, artículo, cantidades/valores).",
        estructura_relacionada: {
          // Estructura de la tabla de detalle
          id: "ID del parte de gasoil principal asociado",
          id2: "Identificador secundario/orden de la línea de detalle",
          C0: "Código del artículo que fue entregado. Clave foránea a la tabla 'articulos'.",
          C1: "Campo adicional asociado al artículo (significado no detallado, Ej: '000').",
          C2: "Campo adicional asociado al artículo (significado no detallado, Ej: '1', posible Cantidad).", // Posible cantidad entregada
          C3: "Campo adicional asociado al artículo (significado no detallado, Ej: '').",
        },
        relaciones_internas_de_detalle: {
          // Relaciones que parten de la tabla de detalle
          articulos: {
            tabla_relacionada: "articulos",
            tipo: "Muchos a uno (varias líneas de detalle pueden referenciar al mismo artículo)",
            campo_enlace_local: "C0", // El campo local que contiene el código del artículo
            campo_enlace_externo: "id", // El campo referenciado en la tabla articulos
            descripcion: "Vincula la línea de detalle con el artículo entregado para obtener su denominación (AR_DENO).",
          },
        },
      },
    },
    ejemplos: {
      consulta_parte_principal_por_id: "Obtener la fecha y almacén de un parte de gasoil usando su 'id'.",
      consultar_almacen_parte:
        "Para un parte, usar PGL_ALM para consultar la tabla 'almacenes' y obtener el nombre del almacén (AM_DENO).",
      consultar_detalles_carga:
        "Para un parte de gasoil específico (usando su id), consultar la tabla relacionada 'partes_gas_pgl_lna' para ver qué líneas de carga (máquina, técnico, artículo, cantidades) se registraron.",
      obtener_info_detalle:
        "Desde una línea de detalle en 'partes_gas_pgl_lna', usar C0, C1 (inferido), C3 para consultar 'maquinaria', 'tecnicos' y 'articulos' y obtener los detalles de la máquina, técnico y artículo.",
      filtrar_partes_por_fecha_o_almacen:
        "Listar partes de gasoil por fecha (filtrando por PGL_FEC) o por almacén (filtrando por PGL_ALM).",
      filtrar_lineas_por_maquina_o_articulo:
        "Buscar líneas de detalle de carga para una máquina específica (filtrando partes_gas_pgl_lna por C0) o un tipo de combustible (filtrando por C3).",
    },
  },

  /* ================================================*/
  /* Almacén – Maquinaria - Entregas Material(EPI) */
  /* ================================================*/
  entregas_mat: {
    // Clave principal (basada en el nombre de tabla)
    descripcion:
      "Registra entregas de material (específicamente EPI u otros artículos) desde el almacén al personal/técnicos. Documenta y traza qué se entrega, a quién, cuándo y desde dónde. Crucial para gestión de inventario de EPI, cumplimiento de normativas y control de costes.",
    tabla: "entregas-mat", // Nombre de tabla principal
    columnas: {
      id: "Código identificador único del registro de entrega (Clave Primaria)",
      EM_FEC: "Fecha en que se realizó la entrega.",
      EM_PER: "Código de la persona o técnico que recibió el material. Clave foránea a la tabla 'tecnicos' para obtener la denominación (TN_DENO).",
      EM_TIPO: "Tipo de entrega.",
      EM_ALM: "Código del almacén desde donde se realizó la entrega. Clave foránea a la tabla 'almacenes' para obtener la denominación (AM_DENO).",
    },
    relaciones: {
      tecnicos: {
        tabla_relacionada: "tecnicos",
        tipo: "Muchos a uno",
        campo_enlace_local: "EM_PER",
        campo_enlace_externo: "id",
        descripcion: "Vincula la entrega con la persona o técnico que recibió el material.",
      },
      almacenes: {
        tabla_relacionada: "almacenes",
        tipo: "Muchos a uno",
        campo_enlace_local: "EM_ALM",
        campo_enlace_externo: "id",
        descripcion: "Vincula la entrega con el almacén desde donde se realizó.",
      },
      entregas_mat_em_lna: {
        tabla_relacionada: "entregas-mat_em_lna",
        tipo: "Uno a muchos (un registro de entrega puede tener múltiples líneas de detalle)",
        campo_enlace_local: "id", // El id del registro en entregas-mat
        campo_enlace_externo: "id", // El campo id en entregas_mat_em_lna que referencia al registro principal
        descripcion:
          "Almacena las líneas de detalle de cada entrega, especificando los artículos que fueron entregados y posiblemente la cantidad.",
        estructura_relacionada: {
          // Estructura de la tabla de detalle
          id: "ID del registro de entrega principal asociado",
          id2: "Identificador secundario/orden de la línea de detalle",
          C0: "Código del artículo que fue entregado. Clave foránea a la tabla 'articulos'.",
          C1: "Campo adicional asociado al artículo (significado no detallado, Ej: '000').",
          C2: "Campo adicional asociado al artículo (significado no detallado, Ej: '1', posible Cantidad).", // Posible cantidad entregada
          C3: "Campo adicional asociado al artículo (significado no detallado, Ej: '').",
        },
        relaciones_internas_de_detalle: {
          // Relaciones que parten de la tabla de detalle
          articulos: {
            tabla_relacionada: "articulos",
            tipo: "Muchos a uno (varias líneas de detalle pueden referenciar al mismo artículo)",
            campo_enlace_local: "C0", // El campo local que contiene el código del artículo
            campo_enlace_externo: "id", // El campo referenciado en la tabla articulos
            descripcion: "Vincula la línea de detalle con el artículo entregado para obtener su denominación (AR_DENO).",
          },
        },
      },
    },
    ejemplos: {
      consulta_entrega_principal_por_id: "Obtener los detalles de una entrega (fecha, técnico, tipo, almacén) usando su 'id'.",
      consultar_info_relacionada:
        "Para una entrega, usar EM_PER y EM_ALM para consultar 'tecnicos' y 'almacenes' y obtener los nombres del técnico y almacén.",
      consultar_detalles_articulos_entregados:
        "Para un registro de entrega específico (usando su id), consultar la tabla relacionada 'entregas-mat_em_lna' para ver qué artículos (C0) se entregaron.",
      obtener_nombre_articulo_entregado:
        "Desde una línea de detalle en 'entregas_mat_em_lna', usar C0 para consultar la tabla 'articulos' y obtener la denominación del artículo (AR_DENO).",
      filtrar_entregas_por_tecnico_o_fecha:
        "Listar entregas realizadas a un técnico específico (filtrando por EM_PER) o en una fecha o rango de fechas (filtrando por EM_FEC).",
      filtrar_entregas_por_articulo:
        "Buscar entregas que incluyeron un artículo específico (requiere consultar la tabla de detalle 'entregas-mat_em_lna' filtrando por C0 y unir con 'entregas-mat').",
    },
  },

/* ================================================*/
/* Tecnicos */
/* ================================================*/
tecnicos: {
    alias: "tecnicos",
    descripcion:
      "Información de los técnicos de la empresa, incluyendo su nombre, teléfono, email y otros datos relevantes, así como su historial laboral y contractual.",
    tabla: "tecnicos",
    columnas: {
      id: "Código identificador único del técnico (Clave Primaria).",
      TN_DENO: "Nombre completo del técnico.",
      TN_TEL: "Número de teléfono del técnico.",
      TN_DOM: "Domicilio del técnico.",
      TN_POB: "Población del técnico.",
      TN_CDP: "Código postal del técnico.",
      TN_CIF: "Número de identificación fiscal del técnico.",
      TN_ACT: "Estado de actividad del técnico (Ej: 'A' - Activo, 'I' - Inactivo, 'B' - Baja).",
    },
    relaciones: {
      tecnicos_tn_hist: {
        tabla_relacionada: "tecnicos_tn_hist",
        tipo: "Uno a muchos (un técnico puede tener múltiples registros en su historial)",
        campo_enlace_local: "id", // El ID del técnico en esta tabla
        campo_enlace_externo: "id", // El ID del técnico en la tabla de historial
        descripcion: "Vincula al técnico con su historial laboral y contractual detallado, incluyendo fechas de inicio/fin, área, lugar de trabajo y tipo de contrato.",
      },
      // Otras posibles relaciones no mencionadas en la descripción original pero lógicamente existentes:
      // - Si los técnicos pueden ser vendedores, una relación con la tabla 'vendedores'.
      // - Si los técnicos están asignados a clientes, una relación con la tabla 'clientes'.
    },
    ejemplos: {
      consulta_tecnico_por_id:
        "Obtener la información básica de un técnico específico usando su 'id'.",
      consultar_historial_completo_tecnico:
        "Para un técnico (ej. ID '850'), obtener todos los registros de su historial laboral desde 'tecnicos_tn_hist', incluyendo fechas, áreas y tipos de contrato.",
      filtrar_tecnicos_activos:
        "Listar todos los técnicos que están actualmente activos (filtrando por TN_ACT = 'A').",
      buscar_tecnico_por_nombre:
        "Encontrar técnicos por su nombre completo (filtrando por TN_DENO).",
    },
  },










/* ======================================================================================================================================================================*/
/* Partes y Tratamientos                                                                                                                                                        */
/* ======================================================================================================================================================================*/

/* ================================================*/
/* Partes y Tratamientos – Personal – Fichajes personal */
/* ================================================*/

  fichajesperso: {
    // Clave principal (basada en el nombre de tabla)
    descripcion:
      "Registra los fichajes diarios de los técnicos, con información general del día. Los detalles de cada fichaje (técnico, ubicación, tarea, hora inicio/fin) se encuentran en la tabla relacionada 'fichajesperso_fpe_lna'.",
    tabla: "fichajesperso", // Nombre de tabla principal
    columnas: {
      id: "Código único que representa un día específico (Clave Primaria)",
      FPE_FEC: "Fecha del día.",
    },
    relaciones: {
      fichajesperso_fpe_lna: {
        tabla_relacionada: "fichajesperso_fpe_lna",
        tipo: "Uno a muchos (un día puede tener múltiples fichajes de técnicos)",
        campo_enlace_local: "id", // El id del día en fichajesperso
        campo_enlace_externo: "id", // El campo id en fichajesperso_fpe_lna que referencia al día
        descripcion:
          "Almacena los detalles de cada fichaje individual de los técnicos para un día específico (técnico, ubicación, tarea, hora de inicio y fin).",
        estructura_relacionada: {
          id: "Mismo ID que la tabla 'fichajesperso', repetido para cada fichaje del día.",
          id2: "Identificador secundario/orden de la línea de fichaje (Ej: '1', '2', etc.).",
          C0: "ID del técnico. Clave foránea a la tabla 'tecnicos' para obtener la denominación (TN_DENO).",
          C1: "Ubicación donde trabajó el técnico. Clave foránea a la tabla 'ubicaciones' para obtener la denominación (UBI_DENO).",
          C2: "Tarea realizada por el técnico. Clave foránea a la tabla 'tareas_per' para obtener la denominación (TARP_DENO).",
          C3: "Hora de inicio de la tarea (Ej: '00:00').",
          C4: "Hora de fin de la tarea (Ej: '14:00').",
        },
        relaciones_internas_de_detalle: {
          tecnicos: {
            tabla_relacionada: "tecnicos",
            tipo: "Muchos a uno",
            campo_enlace_local: "C0",
            campo_enlace_externo: "id",
            descripcion: "Vincula el fichaje con el técnico que lo realizó.",
          },
          ubicaciones: {
            tabla_relacionada: "ubicaciones",
            tipo: "Muchos a uno",
            campo_enlace_local: "C1",
            campo_enlace_externo: "id",
            descripcion: "Vincula el fichaje con la ubicación donde trabajó el técnico.",
          },
          tareas_per: {
            tabla_relacionada: "tareas_per",
            tipo: "Muchos a uno",
            campo_enlace_local: "C2",
            campo_enlace_externo: "id",
            descripcion: "Vincula el fichaje con la tarea realizada por el técnico.",
          },
          tecnicos: {
            tabla_relacionada: "tecnicos",
            tipo: "Muchos a uno (varios fichajes pueden referenciar al mismo técnico)",
            campo_enlace_local: "C0", // El campo local que contiene el código del técnico
            campo_enlace_externo: "id", // El campo referenciado en la tabla tecnicos
            descripcion:
              "Vincula la línea de detalle con el técnico que realizó el fichaje para obtener su denominación (TN_DENO).",
          },
        },
      },
    },
    ejemplos: {
      consulta_dia_fichajes: "Obtener la fecha de un día específico de fichajes usando su 'id'.",
      consultar_fichajes_por_dia:
        "Para un día específico (usando el id de 'fichajesperso'), consultar la tabla relacionada 'fichajesperso_fpe_lna' para ver todos los fichajes de los técnicos en ese día.",
      obtener_detalles_fichaje:
        "Desde una línea en 'fichajesperso_fpe_lna', usar C0, C1 y C2 para consultar 'tecnicos', 'ubicaciones' y 'tareas_per' y obtener el nombre del técnico, la ubicación y la tarea realizada.",
      filtrar_fichajes_por_tecnico_en_dia:
        "Para un día específico, listar los fichajes de un técnico en particular (filtrando 'fichajesperso_fpe_lna' por 'id' del día y 'C0' del técnico).",
      consultar_horario_fichaje:
        "Obtener la hora de inicio (C3) y fin (C4) de una tarea específica en un fichaje.",
    },
  },

/* ================================================*/
/* Partes y Tratamientos – Aplicadores Fitosanitarios */
/* ================================================*/
aplicadores_fit: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Catálogo de aplicadores fitosanitarios registrados en el sistema, identificados por un código único y una denominación.",
    tabla: `aplicadores_fit`, // Nombre de la tabla principal
    columnas: {
      id: "Código ID único del aplicador fitosanitario (Clave Primaria)",
      AFI_DENO: "Denominación del aplicador fitosanitario (Ej: 'LUIS TUBON')",
    },
    relaciones: {
      // Esta tabla podría ser referenciada por otras tablas, pero no se detalla aquí.
    },
    ejemplos: {
      consulta_aplicador_por_id:
        "Obtener la denominación de un aplicador fitosanitario específico usando su 'id'.",
      listar_todos_aplicadores:
        "Listar todos los aplicadores fitosanitarios registrados (consultando todos los registros de la tabla).",
      buscar_aplicador_por_denominacion:
        "Buscar un aplicador fitosanitario por su nombre o denominación (filtrando por AFI_DENO).",
    },
  },

/* ================================================*/
/* Partes y Tratamientos – Equipos Fitosanitarios */
/* ================================================*/
equipo_fito: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Catálogo de equipos fitosanitarios registrados en el sistema, identificados por un código único y una denominación.",
    tabla: `equipo_fito`, // Nombre de la tabla principal
    columnas: {
      id: "Código único del equipo fitosanitario (Clave Primaria)",
      EFI_DENO: "Denominación del equipo fitosanitario.",
    },
    relaciones: {
      // Esta tabla podría ser referenciada por otras tablas, pero no se detalla aquí.
    },
    ejemplos: {
      consulta_equipo_por_id:
        "Obtener la denominación de un equipo fitosanitario específico usando su 'id'.",
      listar_todos_equipos:
        "Listar todos los equipos fitosanitarios registrados (consultando todos los registros de la tabla).",
      buscar_equipo_por_denominacion:
        "Buscar un equipo fitosanitario por su nombre o denominación (filtrando por EFI_DENO).",
    },
  },










tarifas: {
    // Clave principal (nombre de tabla)
    descripcion:
      "Registra las diferentes tarifas disponibles en el sistema. Cada tarifa tiene un identificador único y una denominación que la describe.",
    tabla: `tarifas`, // Nombre de la tabla principal
    columnas: {
      ID: "Identificador único de la tarifa (Clave Primaria).",
      TP_DENO: "Denominación o descripción de la tarifa (ej: 'Tarifa A', 'Tarifa por Volumen').",
    },
    relaciones: {
      // 
      
    },
    ejemplos: {
      consulta_tarifa_por_id:
        "Obtener la denominación de una tarifa específica utilizando su 'ID'.",
      listar_todas_las_tarifas:
        "Recuperar todos los identificadores y denominaciones de las tarifas disponibles en el sistema.",
    },
  },





};

module.exports = mapaERP;