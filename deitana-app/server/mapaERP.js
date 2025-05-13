const mapaERP = {


    /* ======================================================================================================================================================================*/
    /* ARCHIVOS                                                                                                                                                            */
    /* ======================================================================================================================================================================*/
    
    
    
        /* ================================================*/
        /* Archivos – Generales – Acciones Comerciales */
        /* ================================================*/
        acciones_com: {
            descripcion: "Registro de acciones comerciales realizadas con clientes",
            columnas: {
                id: "Identificador único de la acción comercial",
                ACCO_DENO: "Denominación o tipo de acción comercial",
                ACCO_CDCL: "Código del cliente",
                ACCO_CDVD: "Código del vendedor",
                ACCO_FEC: "Fecha de la acción",
                ACCO_HOR: "Hora de la acción"
            },
            relaciones: [
                {
                    tablaDestino: "clientes",
                    campoOrigen: "ACCO_CDCL",
                    campoDestino: "id",
                    tipo: "muchos-a-uno",
                    uso: "Para obtener información detallada del cliente asociado a la acción comercial"
                },
                {
                    tablaDestino: "vendedores",
                    campoOrigen: "ACCO_CDVD",
                    campoDestino: "id",
                    tipo: "muchos-a-uno",
                    uso: "Para conocer el vendedor responsable de la acción"
                },
                {
                    tablaDestino: "acciones_com_acco_not",
                    campoOrigen: "id",
                    campoDestino: "id",
                    tipo: "uno-a-muchos",
                    uso: "Para obtener las observaciones asociadas a la acción comercial"
                }
            ],
            ejemplos: [
                {
                    descripcion: "Obtener información completa de una acción comercial",
                    query: "SELECT a.*, c.CL_DENO as cliente, v.VD_DENO as vendedor, o.C0 as observacion FROM acciones_com a LEFT JOIN clientes c ON a.ACCO_CDCL = c.id LEFT JOIN vendedores v ON a.ACCO_CDVD = v.id LEFT JOIN acciones_com_acco_not o ON a.id = o.id WHERE a.id = 1"
                }
            ]
        },
    
        acciones_com_acco_not: {
            descripcion: "Tabla que registra información detallada sobre observaciones, incidencias y feedback. Almacena notas asociadas a cada acción en acciones_com, divididas en filas según el id2.",
            tabla: "acciones_com_acco_not",
            columnas: {
                id: "Identificador de la acción comercial a la que se refiere la observación",
                id2: "Identificador secuencial de la parte del texto de la observación",
                C0: "Texto de la observación o nota"
            },
            ejemplos: {
                consulta_observaciones: "Para obtener todas las observaciones de una acción, se buscaría por el mismo id en diferentes id2",
                ejemplo_observacion: "Una observación puede estar dividida en múltiples registros, por ejemplo:\nid: '0000000293', id2: '1', C0: 'INCIDENCIA 348'\nid: '0000000293', id2: '2', C0: 'Salvador Garro llama a Antonio G...'\nid: '0000000293', id2: '3', C0: 'planta que no se puede poner...'"
            }
        },
    
    
    
    /* ================================================*/
    /* Archivos – Generales – Artículos */
    /* ================================================*/
    articulos: {
        descripcion: "La tabla 'articulos' en el ERP de Semilleros Deitana contiene el inventario completo de productos. Cada registro representa un artículo único, identificado por un código (id). Esta tabla almacena información esencial de cada artículo, incluyendo su descripción (AR_DENO), códigos de barras (AR_BAR), proveedor asignado (AR_PRV), clasificación por grupo y familia (AR_GRP, AR_FAM), precio (AR_PUD, AR_POP, AR_PST, AR_PVME), stock (AR_STOK), y otros datos relevantes como tipo de IVA (AR_TIVA) y estado (AR_EST).",
        tabla: "articulos",
        columnas: {
            id: "Código único del artículo",
            AR_DENO: "Denominación o descripción del artículo",
            AR_REF: "Referencia adicional del artículo (Sin información específica en el ejemplo)",
            AR_BAR: "Código de barras del artículo",
            AR_TIVA: "Tipo de IVA aplicado al artículo",
            AR_GRP: "Código del grupo al que pertenece el artículo",
            AR_FAM: "Código de la familia del artículo",
            AR_PRV: "Código del proveedor principal del artículo. Referencia al campo 'id' en la tabla 'proveedores'. Si está vacío, el proveedor no está cargado o se adquirió de otra forma.",
            AR_WEB: "Información adicional para la web",
            AR_DCG: "(Sin información específica)",
            AR_IVAP: "IVA aplicado al precio",
            AR_PGE: "% de germinación",
            // Nota: Los campos de precio (AR_PUD, AR_POP, AR_PST, AR_PVME) y stock (AR_STOK) mencionados en la descripción general no están detallados individualmente en la lista de campos proporcionada, pero se infiere su existencia.
        },
        relaciones: {
            proveedores: {
                tabla_relacionada: "proveedores",
                tipo: "Uno a muchos (un proveedor puede proveer muchos artículos)",
                campo_enlace_local: "AR_PRV",
                campo_enlace_externo: "id",
                descripcion: "Permite identificar qué proveedor principal suministra cada artículo. Si el campo 'AR_PRV' está vacío en un registro de artículo, significa que el proveedor principal no está registrado para ese artículo en este sistema."
            }
        },
        ejemplos: {
            consulta_proveedor: "Un artículo con id '00000042' y AR_DENO 'TOMATE RIO GRANDE( PERA RASTRERO)' tiene AR_PRV '00040'. Esto significa que el proveedor con id '00040' en la tabla 'proveedores' es el encargado de proveer este artículo.",
            consulta_grupo_familia: "Se puede filtrar o agrupar artículos por su código de grupo (AR_GRP) o familia (AR_FAM).",
            consulta_barra: "Buscar un artículo por su código de barras utilizando el campo AR_BAR."
        }
    },
    
    
        /* ================================================*/
        /* Archivos – Generales – Clientes */
        /* ================================================*/
        clientes: {
            descripcion: "En Semilleros Deitana, la sección de 'Clientes' dentro del ERP centraliza la información detallada de nuestra cartera de clientes. Cada registro contiene datos esenciales como teléfono, domicilio, código postal, población, provincia, entre otros. Disponer de esta información de manera organizada es fundamental para la accesibilidad, la vinculación con otros registros del sistema y la gestión eficiente de la información relevante de cada cliente.",
            tabla: "clientes",
            columnas: {
                id: "Códoig único que identifica a cada cliente",
                CL_DENO: "Denominación o nombre completo del cliente",
                CL_DOM: "Domicilio del cliente",
                CL_POB: "Población del cliente",
                CL_PROV: "Provincia del cliente",
                CL_CDP: "Código postal del cliente",
                CL_TEL: "Número(s) de teléfono del cliente",
                CL_FAX: "Número de FAX del cliente",
                CL_CIF: "Código de Identificación",
                CL_EMA: "Dirección de correo electrónico del cliente",
                CL_WEB: "Dirección web del cliente",
                CL_PAIS: "País de residencia del cliente"
            },
            relaciones: {
                // Aquí se pueden añadir las relaciones con otras tablas cuando sea necesario
            },
            ejemplos: {
                consulta_pais: "Para obtener información de clientes residentes en España, se consultaría el campo CL_PAIS buscando el valor 'España'",
                consulta_poblacion: "Se puede filtrar por población (CL_POB) o provincia (CL_PROV)",
                consulta_completa: "Si se solicita la información completa de un cliente, se proporcionarán los datos cargados en los campos correspondientes (CL_DENO, CL_DOM, CL_POB, etc.)"
            }
        },
    
    
    
    /* ================================================*/
    /* Archivos – Generales – Formas de pago/cobro */
    /* ================================================*/
    fpago: { // Usamos fpago como clave, ya que es la tabla principal descrita
        descripcion: "Define y gestiona las formas de pago y cobro utilizadas en transacciones comerciales. Actúa como un catálogo maestro para estandarizar operaciones financieras, vincular transacciones y gestionar vencimientos.",
        tabla: "fpago", // Nombre de tabla original
        columnas: {
            id: "Código único de la forma de pago/cobro (Clave Primaria)",
            FP_DENO: "Denominación o descripción de la forma de pago (ej: 'RECIBO 90 DIAS F.F.')",
            FP_NVT: "Número de vencimientos asociados",
            FP_CART: "Indica si se gestiona en cartera de cobros/pagos",
            FP_RW: "Referencia relacionada con la web (propósito no especificado)"
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
                    "Encargos de siembra", "Albarenes compra", "Pedidos a Proveedor",
                    "Registro de Facturas Recibidas", "Albaran Venta Ornamental",
                    "Cartera de cobros", "Cartera de pagos"
                ],
                tipo: "Uno a muchos (una forma de pago puede estar en muchos registros de otras tablas)",
                campo_enlace_externo: "id",
                campo_enlace_local_ejemplos: ["*_FP"], // Patrón típico de nombres de campos en tablas que referencian a fpago
                descripcion: "Esta tabla es referenciada por numerosas tablas de transacciones y documentos para especificar la forma de pago/cobro utilizada."
            }
        },
        ejemplos: {
            consulta_fpago_por_id: "Obtener los detalles de una forma de pago/cobro específica usando su 'id'.",
            consulta_fpago_por_denominacion: "Buscar una forma de pago/cobro por su denominación (FP_DENO).",
            consultar_transacciones_por_fpago: "Listar todas las transacciones (pedidos, facturas, etc.) que utilizan una forma de pago específica (requiere consultar las tablas que referencian a fpago)."
        }
    },
    
    
    
    /* ================================================*/
    /* Archivos – Generales – Nuestros bancos */
    /* ================================================*/
    bancos: { // Usamos el nombre de la tabla principal, que es la misma
        descripcion: "Gestión centralizada de información de las entidades bancarias con las que opera Semilleros Deitana ('Nuestros bancos'). Sirve para la correcta ejecución de operaciones financieras, pagos y cobros.",
        tabla: "bancos",
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
            BA_DCD: "Dígito(s) de control de la cuenta",
            BA_CUEN: "Número de cuenta bancaria tradicional",
            BA_SWI: "Código SWIFT/BIC",
            BA_RIES: "Nivel de riesgo interno",
            BA_TIPO: "Tipo de banco (clasificación interna)",
            BA_OBS: "Observaciones o comentarios internos"
            // Nota: También se pueden registrar Contactos bancarios (Contacto, Cargo, Teléfono, Email) asociados a cada entidad, aunque no están detallados como campos directos aquí.
        },
        relaciones: {
            // No se especifican relaciones explícitas con otras tablas en el texto proporcionado.
        },
        ejemplos: {
            consulta_filtrada: "Buscar bancos por denominación (BA_DENO), código postal (BA_CDP) o código SWIFT (BA_SWI).",
            consulta_completa: "Obtener todos los datos cargados (BA_DENO, BA_DOM, BA_IBAN, BA_SWI, etc.) de un banco específico. Si un campo no tiene información, se indicará (ej: 'Código SWIFT: No hay información disponible').",
            consulta_contactos: "Consultar la información de los contactos bancarios asociados a una entidad (Contacto, Cargo, Teléfono, Email)."
        }
    },
    
    
    
    
    /* ================================================*/
    /* Archivos – Generales – Proveedores */
    /* ================================================*/
    proveedores: {
        descripcion: "La tabla 'proveedores' dentro del sistema ERP centraliza la información detallada de todos los proveedores con los que opera Semilleros Deitana. Cada registro representa un proveedor único, identificado mediante un código (id). Esta tabla almacena datos cruciales que abarcan información fiscal, detalles de contacto, datos bancarios y aspectos administrativos, incluyendo domicilio, provincia, CIF, y registros de la última compra, entre otros. Disponer de esta información completa y organizada es esencial para la gestión eficiente de la cadena de suministro y las relaciones con los proveedores.",
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
            PR_DOMEN: "Domicilio o detalles para el envío de facturas"
            // Nota sobre campos vacíos: Si un campo no tiene información, se asume 'No hay información disponible'.
        },
        relaciones: {
            // Aquí se pueden añadir las relaciones con otras tablas cuando sea necesario (ej: con pedidos de compra, facturas recibidas)
        },
        ejemplos: {
            consulta_provincia: "Para encontrar proveedores ubicados en la provincia de 'Almeria', se consultaría la tabla proveedores filtrando por el campo PR_PROV con el valor 'ALMERIA'.",
            consulta_email: "Si se buscan proveedores con un correo electrónico registrado, se verificaría la existencia de un valor en el campo PR_EMA.",
            consulta_completa: "Al solicitar la información completa de un proveedor, se proporcionarían los datos cargados en los campos correspondientes (PR_DENO, PR_DOM, PR_POB, etc.)"
        }
    },
    
    
        
        /* ================================================*/
        /* Archivos – Generales – Vendedores/Usuarios */
        /* ================================================*/
        vendedores: {
            descripcion: "La tabla 'vendedores'  del sistema ERP de Semilleros Deitana constituye el repositorio centralizado para la gestión de la información de los usuarios internos que desempeñan funciones de venta o que simplemente tienen acceso al sistema como usuarios.",
            tabla: "vendedores",
            columnas: {
                id: "Código único que identifica a cada vendedor/usuario",
                VD_DENO: "Denominación o nombre completo del vendedor/usuario",
                VD_DOM: "Domicilio del vendedor/usuario",
                VD_POB: "Población de residencia",
                VD_PROV: "Provincia de residencia",
                VD_PDA: "Número técnico asociado (clave foránea a tabla tecnicos)"
            },
            ejemplos: {
                consulta_nombre: "Para buscar un vendedor por nombre, se consultaría el campo VD_DENO",
                consulta_ubicacion: "Se puede filtrar por población (VD_POB) o provincia (VD_PROV)",
                consulta_completa: "Si se solicita la información completa de un vendedor, se proporcionarán los datos cargados en los campos correspondientes (VD_DENO, VD_DOM, VD_POB, etc.)"
            }
        },
    
       
    
    
    
        /* ================================================*/
    /* Archivos – Auxiliares – Bandejas */
    /* ================================================*/
    bandejas: {
        descripcion: "La tabla 'bandejas' dentro del sistema ERP contiene un listado exhaustivo y detallado de las características técnicas y económicas asociadas a los diferentes tipos de bandejas (ya sean físicas, reutilizables o desechables) que se emplean en los procesos de siembra y cultivo en alvéolos. Es importante notar que esta sección también puede incluir información relativa a macetas u otros contenedores utilizados en estos procesos.",
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
            BN_ART: "Identificador",
            BN_ALVC: "Número de alvéolos.",
            BN_EM2: "Especifica los metros cuadrados que ocupa la bandeja",
            BN_ALVG: "Número de alvéolos considerados",
        },
        relaciones: {
            // Se menciona una posible relación con 'articulos' a través del campo BN_ART, pero no se proporcionan detalles suficientes para estructurarla aquí.
        },
        ejemplos: {
            // El texto proporcionado no incluye ejemplos de consultas o uso específicos de la tabla 'bandejas'.
            // Los ejemplos dados son valores de ejemplo para campos específicos.
        }
    },
    
    
    
    /* ================================================*/
    /* Archivos – Auxiliares – Casas comerciales */
    /* ================================================*/
    casas_com: { // Usamos el nombre de la tabla como clave principal
        descripcion: "Gestión y almacenamiento de información de las casas comerciales con las que Semilleros Deitana interactúa. Es fundamental para mantener un registro organizado de socios comerciales y sus datos clave.",
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
            CC_DFEC: "Fecha de inicio de validez de tarifa",
            CC_HFEC: "Fecha de fin de validez de tarifa"
            // Nota sobre datos: La completitud de CC_DOM, CC_TEL, CC_FAX, CC_CIF, CC_EMA, CC_WEB, CC_DFEC, CC_HFEC puede variar (pueden ser NULL o vacíos).
        },
        relaciones: {
            // No se especifican relaciones explícitas con otras tablas en el texto proporcionado.
        },
        ejemplos: {
            // El texto proporcionado no incluye ejemplos de consultas o uso específicos de la tabla 'casas_comerciales'.
            // Se menciona la variabilidad de los datos en ciertos campos.
        }
    },
    
    
    
    /* ================================================*/
    /* Archivos – Auxiliares – Categorias */
    /* ================================================*/
    categorias: {
        descripcion: "Define las categorías laborales utilizadas en Semilleros Deitana para establecer condiciones contractuales y económicas de los trabajadores (salario, horarios, costes). No son categorías de producto.",
        tabla: "categorias",
        columnas: {
            id: "Identificador único de la categoría laboral (Clave Primaria)",
            CG_DENO: "Nombre o denominación de la categoría laboral (Ej: PRODUCCION, ENCARGADO)",
            CG_SALDIA: "Salario diario base para esta categoría (Tipo: DECIMAL)",
            CG_COSHOR: "Coste calculado por hora de trabajo normal (Tipo: DECIMAL)",
            CG_SDIA: "Coste calculado por hora extra (Tipo: DECIMAL). Nota: Aunque el nombre sugiere 'Salario Día', representa el coste por hora extra según la descripción."
        },
        relaciones: {
            // No se especifican relaciones explícitas con otras tablas en el texto proporcionado (ej: con empleados).
        },
        ejemplos: {
            // El texto proporcionado no incluye ejemplos de consultas o uso específicos de la tabla 'categorias'.
            // Los ejemplos dados son valores de ejemplo para campos específicos.
        }
    },
    
    
    
    /* ================================================*/
    /* Archivos – Auxiliares – Créditos caución */
    /* ================================================*/
    creditocau: {
        descripcion: "Gestión y seguimiento de seguros de crédito (créditos caución) asociados a clientes para proteger frente al riesgo de impago. Permite registrar y consultar pólizas o acuerdos de seguro de crédito específicos.",
        tabla: "creditocau",
        columnas: {
            id: "Identificador único del crédito caución (Clave Primaria)",
            CAU_CCL: "Código del cliente asociado. Clave foránea a la tabla 'clientes'.",
            CAU_DIAS: "Número máximo de días de crédito permitidos (Tipo: INT).",
            CAU_TIPO: "Tipo de crédito caución ('N': No asegurado, 'A': Asegurado)."
        },
        relaciones: {
            clientes: {
                tabla_relacionada: "clientes",
                tipo: "Muchos a uno (varios créditos caución para un cliente)",
                campo_enlace_local: "CAU_CCL",
                campo_enlace_externo: "id",
                descripcion: "Vincula el crédito caución con la información detallada del cliente correspondiente."
            },
            creditocau_cau_obs: {
                tabla_relacionada: "creditocau_cau_obs",
                tipo: "Uno a muchos (un crédito caución puede tener varias observaciones)",
                campo_enlace_local: "id", // El id del crédito caución
                campo_enlace_externo: "id", // El campo id en creditocau_cau_obs que referencia al crédito caución
                descripcion: "Almacena observaciones o seguimientos. Las observaciones completas para un crédito caución se reconstruyen concatenando el campo 'C0' de los registros vinculados por 'id'."
            }
        },
        ejemplos: {
            consulta_cliente: "Para obtener información del cliente asociado a un crédito caución, usar el campo CAU_CCL del registro creditocau para consultar la tabla 'clientes' por su 'id'.",
            consulta_observaciones: "Para ver las observaciones de un crédito caución, consultar la tabla 'creditocau_cau_obs' usando el 'id' del crédito caución y concatenar el contenido del campo 'C0' de los resultados.",
            consulta_tipo_dias: "Se puede filtrar o consultar créditos caución por el número de días (CAU_DIAS) o el tipo de cobertura (CAU_TIPO)."
        }
    },
    
    
    
    /* ================================================*/
    /* Archivos – Auxiliares – Delegaciones */
    /* ================================================*/
    almacenes: { // Usamos almacenes como clave, ya que es la tabla principal descrita
        descripcion: "Representa las delegaciones o almacenes físicos y operativos de la empresa. Sirve como referencia para identificar la ubicación asociada a una acción en el ERP y vincular recursos financieros por defecto.",
        tabla: "almacenes", // Nombre de tabla original
        columnas: {
            id: "Código único de la delegación o almacén (Clave Primaria)",
            AM_DENO: "Denominación o nombre de la delegación/almacén (Ej: 'GARDEN')",
            AM_CAJA: "Denominación de la 'Caja Almacen / Sucursal Efectivo' por defecto. Se relaciona con 'bancos' (id) para obtener la denominación (BA_DENO).", // Descripción basada estrictamente en el texto provisto
            AM_BCO: "Denominación del 'Banco Cobros / Pagos Defectos' por defecto. Se relaciona con 'bancos' (id) para obtener la denominación (BA_DENO)." // Descripción basada estrictamente en el texto provisto
        },
        relaciones: {
             bancos_caja_defecto: {
                 tabla_relacionada: "bancos",
                 tipo: "Muchos a uno (varios almacenes pueden usar la misma caja por defecto)", // Implícito
                 campo_enlace_local: "AM_CAJA", // El campo local que contiene el ID del banco/caja
                 campo_enlace_externo: "id", // El campo referenciado en la tabla bancos
                 descripcion: "Vincula la delegación/almacén con la caja de efectivo por defecto, obteniendo su denominación desde la tabla 'bancos'." // Adaptado a la descripción del texto
            },
             bancos_banco_defecto: {
                  tabla_relacionada: "bancos",
                  tipo: "Muchos a uno (varios almacenes pueden usar el mismo banco por defecto)", // Implícito
                  campo_enlace_local: "AM_BCO", // El campo local que contiene el ID del banco
                  campo_enlace_externo: "id", // El campo referenciado en la tabla bancos
                  descripcion: "Vincula la delegación/almacén con el banco por defecto para cobros/pagos, obteniendo su denominación desde la tabla 'bancos'." // Adaptado a la descripción del texto
            }
            // En esta versión de la descripción, no se menciona explícitamente que otras tablas referencien a 'almacenes'.
        },
        ejemplos: {
            consulta_almacen_por_id: "Obtener los detalles de una delegación/almacén específico usando su 'id'.",
            consulta_almacen_por_denominacion: "Buscar una delegación/almacén por su denominación (AM_DENO).",
            consultar_bancos_defecto: "Para una delegación/almacén, usar AM_CAJA y AM_BCO para consultar la tabla 'bancos' y obtener los nombres de la caja y el banco por defecto asociados."
        }
    },
    
    
    /* ================================================*/
    /* Archivos – Auxiliares – Dispositivos móviles */
    /* ================================================*/
    dispositivos: {
        descripcion: "Gestión centralizada de dispositivos móviles (PDAs u otros terminales portátiles) utilizados en Semilleros Deitana. Mantiene un registro detallado con datos técnicos y administrativos para control y seguimiento.",
        tabla: "dispositivos",
        columnas: {
            id: "Código único del dispositivo móvil (Clave Primaria)",
            DIS_DENO: "Denominación o nombre descriptivo del dispositivo",
            DIS_MARCA: "Marca comercial del dispositivo",
            DIS_MOD: "Modelo técnico del dispositivo",
            DIS_FCOM: "Fecha de adquisición (Puede ser NULL)",
            DIS_MAC: "Dirección MAC del dispositivo",
            DIS_IP: "Dirección IP asignada al dispositivo",
            DIS_KEY: "Clave o identificador de seguridad",
            DIS_BAJA: "Estado operativo (0: Activo, 1: Dado de baja)"
        },
        relaciones: {
            dispositivos_dis_obs: {
                tabla_relacionada: "dispositivos_dis_obs",
                tipo: "Uno a muchos (un dispositivo puede tener varias observaciones)",
                campo_enlace_local: "id", // El id del dispositivo
                campo_enlace_externo: "id", // El campo id en dispositivos_dis_obs que referencia al dispositivo
                descripcion: "Almacena observaciones o comentarios complementarios. Las observaciones completas para un dispositivo se reconstruyen concatenando el campo 'C0' de los registros vinculados por 'id', posiblemente ordenados por 'id2'."
            }
        },
        ejemplos: {
            consulta_basica: "Obtener información principal de un dispositivo directamente de la tabla 'dispositivos' usando su 'id'.",
            consulta_observaciones: "Para ver las observaciones de un dispositivo, consultar 'dispositivos_dis_obs' usando el 'id' del dispositivo. Concatenar 'C0' de las filas resultantes. Nota: No todos los dispositivos pueden tener observaciones.",
            consulta_estado: "Filtrar dispositivos por su estado operativo (DIS_BAJA)."
        }
    },
    
    
    /* ================================================*/
    /* Archivos – Auxiliares – Envases de venta */
    /* ================================================*/
    envases_vta: {
        descripcion: "Cataloga los diferentes tipos de envases y formatos utilizados para la comercialización de semillas y productos, detallando características físicas y comerciales.",
        tabla: "envases_vta",
        columnas: {
            id: "Identificador único del envase de venta (Clave Primaria)",
            EV_DENO: "Denominación o nombre del envase (Ej: Sobre pequeño, Bolsa 1 Kg)",
            EV_NEM: "Unidad de medida del envase (Ej: UD, SB, L, KG)",
            EV_CANT: "Cantidad total contenida en el envase",
            EV_UDSS: "Número de unidades por presentación o sobre, si aplica"
        },
        relaciones: {
            // No se especifican relaciones explícitas con otras tablas en el texto proporcionado (ej: con artículos).
        },
        ejemplos: {
            consulta_denominacion: "Buscar envases por su denominación (EV_DENO).",
            consulta_contenido: "Consultar la cantidad total (EV_CANT) y la unidad de medida (EV_NEM) de un envase.",
            consulta_presentacion: "Obtener el número de unidades por presentación (EV_UDSS) si aplica para un envase específico."
        }
    },
    
    
    /* ================================================*/
    /* Archivos - Auxiliares - Invernaderos */
    /* ================================================*/
    invernaderos: {
        descripcion: "Contiene la información base de las estructuras físicas de invernaderos, utilizadas para siembra y cultivo. Incluye identificación, vinculación a almacenes, secciones y filas. Nota: Existen otras tablas relacionadas (secciones, filas, tratamientos) no detalladas aquí.",
        tabla: "invernaderos",
        columnas: {
            id: "Identificador único del invernadero (Clave Primaria)",
            INV_DENO: "Denominación o nombre completo del invernadero (Ej: A4 Pg.28-Parcela.1000)",
            INV_ALM: "Código del almacén asociado o vinculado a este invernadero.", // Clave foránea a la tabla 'almacenes'
            INV_NSECI: "Número de secciones inicial o de referencia",
            INV_NSEC: "Número total de secciones",
            INV_NFIL: "Número total de filas"
        },
        relaciones: {
            almacenes: {
                tabla_relacionada: "almacenes",
                tipo: "Muchos a uno (varios invernaderos pueden estar en un almacén)", // Inferred type
                campo_enlace_local: "INV_ALM",
                campo_enlace_externo: "id",
                descripcion: "Vincula el invernadero con el almacén asociado. La tabla 'almacenes' tiene campos como 'id' (código del almacén) y 'AM_DENO' (nombre del almacén)."
            }
            // Otras relaciones con secciones, filas, tratamientos, etc., existen pero no están detalladas.
        },
        ejemplos: {
            consulta_almacen_asociado: "Para obtener el nombre del almacén asociado a un invernadero, usar el campo INV_ALM del invernadero para consultar el campo 'id' en la tabla 'almacenes' y obtener su AM_DENO.",
            consulta_basica: "Obtener la identificación (id, INV_DENO), número de secciones (INV_NSEC) o filas (INV_NFIL) de un invernadero específico."
        }
    },
    
    
    /* ================================================*/
    /* Archivos - Auxiliares - Motivos */
    /* ================================================*/
    motivos: {
        descripcion: "Catálogo estandarizado de causas o razones predefinidas utilizadas para documentar y clasificar eventos, acciones o situaciones internas (Ej: plagas, descartes, incidencias).",
        tabla: "motivos",
        columnas: {
            id: "Código único del motivo (Clave Primaria)",
            MOT_DENO: "Denominación o descripción del motivo (Ej: PLAGA, DESCARTE)"
        },
        relaciones: {
            // No se especifican relaciones explícitas en el texto, pero esta tabla es likely referenciada por otras tablas de eventos o incidencias.
        },
        ejemplos: {
            listar_motivos: "Obtener el listado de motivos, combinando el código (id) y la descripción (MOT_DENO) para presentación (Ej: '0001 - PLAGA').",
            clasificar_evento: "Utilizar el 'id' o 'MOT_DENO' de esta tabla para clasificar un evento registrado en otro lugar del sistema."
        }
    },
    
    
    /* ================================================*/
    /* Archivos - Auxiliares - Paises */
    /* ================================================*/
    paises: {
        descripcion: "Catálogo maestro de referencia con el listado de países relevantes para la actividad comercial y productiva de la empresa (origen/destino productos, ubicación clientes/proveedores). Diseñada para servir como soporte a otras tablas.",
        tabla: "paises",
        columnas: {
            id: "Código único del país (Clave Primaria)",
            PA_DENO: "Denominación o nombre completo del país (Ej: FRANCIA, ESPAÑA)"
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
        }
    },
    
    /* ================================================*/
    /* Archivos - Auxiliares - Procesos */
    /* ================================================*/
    procesos: {
        descripcion: "Define las etapas o procedimientos del ciclo productivo agrícola (semillero), como germinación o trasplante. Contiene campos que controlan la lógica interna del ERP para estas etapas.",
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
                descripcion: "Almacena observaciones adicionales para los procesos. Las observaciones completas se reconstruyen concatenando el campo 'C0' de las filas vinculadas por 'id', ordenadas por 'id2'.",
                estructura_relacionada: { // Estructura de la tabla relacionada para referencia
                     id: "ID del proceso asociado",
                     id2: "Línea u orden de la observación",
                     C0: "Texto de la observación"
                }
            }
            // Relaciones potenciales inferidas de la interfaz (pestañas como General, Ornamental, Producción, Consumos, Incremento de días).
            // Es probable que existan relaciones con tablas de producción (produccion_*), consumos (consumos_*), tratamientos (p-tratamientos), siembras (p-siembras), inventario o invernaderos.
        },
        ejemplos: {
            consulta_procesos: "Listar todos los procesos registrados (id, PRO_DENO, etc.).",
            consulta_procesos_por_logica: "Filtrar procesos por su configuración (Ej: ¿Modifican bandejas? PRO_MBAN = 'S', ¿Permiten sin ubicación? PRO_NOUBI = 'S').",
            consulta_observaciones: "Buscar observaciones para un proceso específico usando su 'id' en la tabla 'procesos_pro_obs' y reconstruir el texto completo desde el campo 'C0'. Nota: No todos los procesos tienen observaciones.",
            consulta_siembra: "Identificar procesos que son parte de la siembra (PRO_SEMB)."
        }
    },
    
    
    
    /* ================================================*/
    /* Archivos – Auxiliares – Productos Fitosanitarios */
    /* ================================================*/
    productos_fitosanitarios: {
        descripcion: "Gestión y registro detallado de productos fitosanitarios para tratamientos agronómicos (prevención, control de plagas/enfermedades). Centraliza información técnica y de uso para aplicación segura y trazabilidad.",
        tabla: "tipo_trat",
        columnas: {
            id: "Identificador único del producto fitosanitario (Clave Primaria)",
            TTR_NOM: "Nombre comercial del producto (Ej: PREVICUR ENERGY)",
            TTR_DOS: "Dosis estándar o recomendada (Ej: 0,2-0,3 %)",
            TTR_FOR: "Fórmula o principio(s) activo(s)",
            TTR_ENS: "Campo auxiliar (Información incierta, puede estar vacío)", // Nota sobre validación/significado
            TTR_ECO: "Indica si es ecológico ('S'/'N')",
            TTR_BIO: "Indica si es de origen biológico ('S'/'N')",
            TTR_ESPE: "Especies vegetales autorizadas o recomendadas (Ej: CALABACÍN - MELÓN)",
            TTR_AGN: "Agentes nocivos que combate (Ej: FITOPHTHORA - PITIUM)",
            TTR_INT: "Enlace web (ficha técnica, registro, etc.)",
            TTR_REG: "Número de registro oficial",
            TTR_FCAD: "Fecha de caducidad"
        },
        relaciones: {
            // No se especifican relaciones explícitas con otras tablas en el texto proporcionado (ej: con tratamientos aplicados).
        },
        ejemplos: {
            consulta_producto_por_nombre_id: "Buscar un producto fitosanitario por su id o TTR_NOM para obtener sus detalles técnicos y de uso.",
            listar_productos_por_tipo: "Filtrar productos fitosanitarios que son ecológicos (TTR_ECO='S') o biológicos (TTR_BIO='S').",
            consultar_aplicabilidad: "Verificar las especies (TTR_ESPE) o agentes (TTR_AGN) para los que un producto está autorizado."
        }
    },
    
    
    /* ================================================*/
    /* Archivos – Auxiliares – Sección Tareas */
    /* ================================================*/
    tareas_seccion: {
        descripcion: "Catálogo de categorías o tipos de tareas operativas y administrativas (injertos, siembra, riegos, limpieza, etc.). Fundamental para clasificar y cuantificar mano de obra y actividades en partes de trabajo y reportes.",
        tabla: "tareas_seccion",
        columnas: {
            id: "Identificador único de la sección de tarea (Clave Primaria, también TARS_COD)",
            TARS_DENO: "Denominación o nombre de la sección de tarea (Ej: INJERTOS HACER, SIEMBRA)",
            TARS_UNDM: "Unidad de medida asociada a la tarea (Ej: 'Planta', 'Bandeja', o vacío para tareas sin unidad productiva). Indica cómo se cuantifica la tarea."
        },
        relaciones: {
            // No se especifican relaciones explícitas en el texto, pero esta tabla es referenciada por tablas que registran actividades o partes de trabajo.
        },
        ejemplos: {
            consulta_seccion: "Buscar una sección de tarea por su id o TARS_DENO para obtener su unidad de medida (TARS_UNDM).",
            clasificacion_actividad: "Utilizar el id o TARS_DENO de esta tabla para clasificar una actividad registrada (ej: en un parte de trabajo).",
            consulta_unidad_medida: "Identificar la unidad de medida (TARS_UNDM) usada para cuantificar una tarea específica, como 'Bandeja' para 'SIEMBRA'."
        }
    },
    
    
    /* ================================================*/
    /* Archivos – Auxiliares – Sectores y Subsectores */
    /* ================================================*/
    sectores: {
        descripcion: "Define clasificaciones comerciales o de origen para pedidos y clientes (canales de venta, áreas de negocio). Crucial para análisis comercial, segmentación y seguimiento por canal. Nota: Aunque la gestión directa no siempre es visible en el entorno de prueba, los datos existen y se usan para clasificación.",
        tabla: "sectores",
        columnas: {
            id: "Código único del sector o subsector (Clave Primaria)",
            SC_DENO: "Nombre o denominación del sector o subsector (Ej: SIN ASIGNAR, TIENDA, INTERNET, PROFESIONAL)"
        },
        relaciones: {
            // No se especifican relaciones explícitas documentadas que referencien a 'sectores' desde otras tablas en este contexto.
            // Se infiere que esta tabla es utilizada como clave foránea en tablas como 'clientes' y 'pedidos' para clasificar registros.
        },
        ejemplos: {
            listar_sectores: "Obtener el listado de todos los sectores/subsectores registrados (id y SC_DENO).",
            clasificar_registro: "Utilizar el id o SC_DENO de esta tabla para clasificar clientes, pedidos u otras transacciones.",
            // Ejemplos de uso potencial en combinación con otras tablas (si las relaciones se confirman):
            // analisis_por_sector: "Agrupar y analizar pedidos o clientes según su sector asignado (requiere relación con tablas correspondientes)."
        }
    },
    
    
    /* ================================================*/
    /* Archivos – Auxiliares – Sustratos */
    /* ================================================*/
    sustratos: {
        descripcion: "Gestión y registro de materiales o mezclas utilizados como medio de cultivo. Esencial para control de costes, precios y planificación de materiales en la producción.",
        tabla: "sustratos",
        columnas: {
            id: "Código único del sustrato (Clave Primaria, también SUS_COD)",
            SUS_DENO: "Denominación o nombre descriptivo del sustrato (Ej: PERLITA PELIGRAM, SUST.ESPECIAL)",
            SUS_PVP: "Precio de venta al público por alveolo (Tipo: DECIMAL)",
            SUS_COS: "Coste interno por alveolo (Tipo: DECIMAL)"
        },
        relaciones: {
            // No se especifican relaciones explícitas en el texto, pero esta tabla es referenciada por tablas relacionadas con producción o costos.
        },
        ejemplos: {
            consulta_sustrato: "Buscar un sustrato por su id o SUS_DENO para obtener su nombre, PVP y coste por alveolo.",
            calcular_coste_produccion: "Utilizar el campo SUS_COS en módulos de producción para calcular el coste del sustrato por alveolo o bandeja.",
            // Ejemplo de posible inconsistencia (basado en la observación):
            // visualizar_inconsistencia: "Observar posibles diferencias en la visualización de datos (PVP, COS, Denominación) para un mismo sustrato (ej: id 001) entre la base de datos y la interfaz del ERP de pruebas."
        },
        notas: {
            inconsistencia_datos_pruebas: "Se ha observado que los datos de un mismo sustrato (ej. id 001) pueden diferir entre la base de datos y la visualización en el entorno de pruebas del ERP. Se recomienda validar los datos críticos directamente en la base de datos."
        }
    },
    
    
    
    /* ================================================*/
    /* Archivos – Auxiliares – Ubicaciones */
    /* ================================================*/
    ubicaciones: {
        descripcion: "Catálogo centralizado de ubicaciones físicas o lógicas (invernaderos, semilleros, almacenes) relevantes para las operaciones. Proporciona referencia espacial estandarizada para organizar, trazar y optimizar actividades y recursos.",
        tabla: "ubicaciones", // Nombre de tabla original
        columnas: {
            id: "Código único de la ubicación (Clave Primaria)",
            UBI_DENO: "Denominación o nombre descriptivo de la ubicación (Ej: 'SEMILLERO A', 'Semillero C')"
        },
        relaciones: {
            // La descripción no detalla explícitamente relaciones formales (claves foráneas) desde otras tablas.
            // Sin embargo, se infiere que esta tabla es referenciada por numerosas tablas en módulos como inventario, producción y logística (relaciones Muchos a Uno)
            // para asignar y gestionar elementos o actividades por ubicación, utilizando ubicaciones.id como clave foránea.
        },
        ejemplos: {
            listar_ubicaciones: "Obtener el listado de todas las ubicaciones registradas (id y UBI_DENO).",
            consulta_denominacion_por_id: "Buscar la denominación (UBI_DENO) de una ubicación dado su código (id).",
            consulta_id_por_denominacion: "Buscar el código (id) de una ubicación dada su denominación (UBI_DENO).",
            // Ejemplos de uso potencial en combinación con otras tablas (si las relaciones se confirman):
            // filtrar_inventario_por_ubicacion: "Ver el inventario disponible en una ubicación específica (requiere que la tabla de inventario referencie a 'ubicaciones')."
            // registrar_proceso_en_ubicacion: "Asignar una ubicación (invernadero, etc.) a un registro de proceso productivo (requiere que la tabla de procesos referencie a 'ubicaciones')."
        }
    },
    
    
    
    /* ================================================*/
    /* Archivos – Auxiliares – Zonas */
    /* ================================================*/
    zonas: {
        descripcion: "Catálogo para organizar áreas físicas o lógicas operativas (trabajo, producción, almacenamiento). Fundamental para estructurar espacialmente, mejorar trazabilidad y optimizar gestión de inventario y tareas.",
        tabla: "zonas",
        columnas: {
            id: "Código único de la zona (Clave Primaria)",
            ZN_DENO: "Denominación o nombre descriptivo de la zona (Ej: Garden, ZONA)",
            ZN_SUB: "Subzona o código de agrupación secundaria (Puede estar vacío)",
            ZN_RUTA: "Campo asociado a una ruta (Puede estar vacío)"
        },
        relaciones: {
            // No se especifican relaciones explícitas documentadas que referencien a 'zonas' desde otras tablas en este contexto.
            // Sin embargo, esta tabla es referenciada por módulos como inventario, producción y logística para asignar y gestionar elementos por área.
        },
        ejemplos: {
            listar_zonas: "Obtener el listado de todas las zonas registradas (id, ZN_DENO, etc.).",
            consulta_denominacion_por_id: "Buscar la denominación (ZN_DENO) de una zona dado su código (id).",
            consulta_zonas_por_subzona: "Filtrar zonas que pertenecen a una subzona específica (ZN_SUB).",
            // Ejemplos de uso en combinación con otras tablas (si las relaciones se confirman):
            // filtrar_inventario_por_zona: "Ver el inventario en una zona específica (requiere relación con tabla de inventario)."
            // asignar_tarea_a_zona: "Planificar una tarea a realizar en una zona determinada."
        }
    },
    
    
    
    /* ================================================*/
    /* Archivos – Otros – Departamentos */
    /* ================================================*/
    departamentos: {
        descripcion: "Cataloga las áreas o unidades funcionales de la empresa (administración, producción, etc.). Fundamental para asignar responsabilidades, gestionar usuarios/roles, clasificar tareas y generar reportes por área.",
        tabla: "departamentos",
        columnas: {
            id: "Código único del departamento (Clave Primaria)",
            DEP_DENO: "Denominación o nombre del departamento (Ej: COORDINADOR, ADMINISTRACION)"
        },
        relaciones: {
            // No se especifican relaciones explícitas documentadas que referencien a 'departamentos' desde otras tablas en este contexto.
            // Sin embargo, esta tabla es clave y referenciada por tablas como 'usuarios', 'tareas', o 'empleados'
            // para vincular registros a una unidad organizacional.
        },
        ejemplos: {
            listar_departamentos: "Obtener el listado de todos los departamentos registrados (id y DEP_DENO).",
            consulta_denominacion_por_id: "Buscar la denominación (DEP_DENO) de un departamento dado su código (id).",
            consulta_id_por_denominacion: "Buscar el código (id) de un departamento dada su denominación (DEP_DENO).",
            // Ejemplos de uso en combinación con otras tablas (si las relaciones se confirman):
            // filtrar_usuarios_por_departamento: "Listar usuarios que pertenecen a un departamento específico (requiere relación con tabla de usuarios)."
            // asignar_tarea_a_departamento: "Vincular una tarea a un departamento responsable."
        }
    },
    
    
    
    /* ================================================*/
    /* Archivos – Otros – Secciones Trabajadores */
    /* ================================================*/
    secciones_trabajadores: { // Usamos el nombre que aparece en la descripción de campos
        descripcion: "Cataloga áreas funcionales, grupos o secciones internas a las que pertenecen los trabajadores. Fundamental para la gestión de RRHH, asignación de tareas y reportes de personal segmentados.",
        // Nota: El texto fuente menciona "Tabla principal: secciones", pero luego describe campos para "secciones_trabajadores". Asumimos que 'secciones_trabajadores' es el nombre de tabla relevante aquí.
        tabla: "secciones", // Nombre de tabla basado en los campos descritos
        columnas: {
            id: "Código único de la sección de trabajador (Clave Primaria)",
            SE_DENO: "Denominación o nombre de la sección (Ej: ADMINISTRACION, PRODUCCION)"
        },
        relaciones: {
            // No se especifican relaciones explícitas documentadas que referencien a 'secciones_trabajadores' desde otras tablas en este contexto.
            // Sin embargo, esta tabla es clave y es referenciada por la tabla 'trabajadores' para asignar a cada empleado su sección.
        },
        ejemplos: {
            listar_secciones: "Obtener el listado de todas las secciones de trabajadores registradas (id y SE_DENO).",
            consulta_denominacion_por_id: "Buscar la denominación (SE_DENO) de una sección dado su código (id).",
            consulta_id_por_denominacion: "Buscar el código (id) de una sección dada su denominación (SE_DENO).",
            // Ejemplos de uso en combinación con la tabla trabajadores (si la relación se confirma):
            // filtrar_trabajadores_por_seccion: "Listar trabajadores que pertenecen a una sección específica (requiere relación con tabla de trabajadores)."
            // contar_trabajadores_por_seccion: "Obtener el número de trabajadores en una sección determinada (requiere relación y conteo en tabla de trabajadores)."
        }
    },
    
    
    /* ================================================*/
    /* Archivos – Otros – Tareas Per */
    /* ================================================*/
    tareas_per: {
        descripcion: "Gestión detallada de tareas internas realizadas por el personal. Cada tarea se vincula a una 'Sección de Tarea' (de la tabla tareas_seccion). Esencial para partes de trabajo, seguimiento de tiempo/recursos y análisis de productividad.",
        tabla: "tareas_per",
        columnas: {
            id: "Código único de la tarea (Clave Primaria)",
            TARP_DENO: "Denominación o nombre de la tarea (Ej: H.CARRETILLERO, H.LIMPIEZA GENERAL)",
            TARP_SECC: "Código de la sección de tarea a la que pertenece. Clave foránea a la tabla 'tareas_seccion'.",
            TARP_TIPO: "Tipo general de tarea (Ej: 'Otros', 'Siembra', 'Mantenimiento')"
        },
        relaciones: {
            tareas_seccion: {
                tabla_relacionada: "tareas_seccion",
                tipo: "Muchos a uno (varias tareas_per pueden estar en una tareas_seccion)",
                campo_enlace_local: "TARP_SECC",
                campo_enlace_externo: "id", // o TARS_COD en tareas_seccion
                descripcion: "Vincula cada tarea con su sección de tarea correspondiente. Permite obtener la denominación de la sección (TARS_DENO) a partir del código TARP_SECC."
            }
        },
        ejemplos: {
            listar_tareas: "Obtener el listado de todas las tareas registradas (id, TARP_DENO, etc.).",
            consulta_tarea_por_id: "Buscar una tarea por su código (id) para ver su denominación, sección y tipo.",
            consulta_tareas_por_seccion_codigo: "Listar todas las tareas (tareas_per) que pertenecen a una sección específica usando el código de sección (TARP_SECC).",
            consulta_tareas_por_seccion_nombre: "Listar tareas de una sección específica usando el nombre de la sección (requiere unir con la tabla tareas_seccion).",
            consulta_tareas_por_tipo: "Filtrar tareas por su tipo general (TARP_TIPO, Ej: 'Siembra')."
        }
    },
    
    
    
    /* ======================================================================================================================================================================*/
    /* PRODUCCION                                                                                                                                                             */
    /* ======================================================================================================================================================================*/
    
    
    
    /* ================================================*/
    /* Produccion - Partes - Partes de siembra */
    /* ================================================*/
    p_siembras: { // Usamos p_siembras como clave
        descripcion: "Documenta las 'partes' o eventos específicos de siembra. Registra cuándo, dónde, qué artículo (semilla) se sembró, quién realizó la operación y bajo qué estado. Base para seguimiento de siembra, materiales, personal y ubicación inicial de cultivos.",
        tabla: `p-siembras`, // Nombre de tabla original
        columnas: {
            id: "Código único del registro de parte de siembra (Clave Primaria)",
            PSI_FEC: "Fecha de la operación de siembra",
            PSI_HOR: "Hora de la operación de siembra",
            PSI_OPE: "Identificador del operario responsable. Clave foránea a la tabla 'vendedores'.",
            PSI_SEM: "Identificador de la semilla o artículo sembrado. Clave foránea a la tabla 'articulos'.",
            PSI_EST: "Estado actual del registro de la parte de siembra (Ej: 'S').",
            PSI_ALM: "Identificador del almacén o ubicación asociado. Clave foránea a la tabla 'almacenes'.",
            PSI_TIPO: "Clasificador o tipo específico para la parte de siembra (Ej: 'A').",
            PSI_CCOM: "Identificador de la casa comercial asociada. Clave foránea a la tabla 'casas_com'."
        },
        relaciones: {
            vendedores: {
                tabla_relacionada: "vendedores",
                tipo: "Muchos a uno",
                campo_enlace_local: "PSI_OPE",
                campo_enlace_externo: "id",
                descripcion: "Permite obtener la denominación (VD_DENO) del operario que realizó la siembra."
            },
            articulos: {
                tabla_relacionada: "articulos",
                tipo: "Muchos a uno",
                campo_enlace_local: "PSI_SEM",
                campo_enlace_externo: "id",
                descripcion: "Permite obtener la denominación (AR_DENO) exacta de la semilla o artículo sembrado."
            },
            almacenes: {
                tabla_relacionada: "almacenes",
                tipo: "Muchos a uno",
                campo_enlace_local: "PSI_ALM",
                campo_enlace_externo: "id",
                descripcion: "Permite obtener la denominación (AM_DENO) del almacén o ubicación donde se registró la siembra."
            },
            casas_com: {
                tabla_relacionada: "casas_com",
                tipo: "Muchos a uno",
                campo_enlace_local: "PSI_CCOM",
                campo_enlace_externo: "id",
                descripcion: "Permite identificar la casa comercial asociada (obteniendo su denominación SC_DENO o CC_DENO de casas_com)." // Asumiendo SC_DENO o CC_DENO por ejemplos previos
            }
        },
        ejemplos: {
            consulta_parte_siembra: "Obtener los detalles de un registro de siembra específico usando su 'id'.",
            obtener_info_relacionada: "Para un registro de siembra, usar los campos PSI_OPE, PSI_SEM, PSI_ALM, PSI_CCOM para consultar las tablas 'vendedores', 'articulos', 'almacenes' y 'casas_com' y obtener nombres/denominaciones.",
            consultar_siembras_por_operario: "Listar todas las partes de siembra realizadas por un operario específico (filtrando por PSI_OPE).",
            consultar_siembras_de_semilla: "Encontrar todas las siembras registradas para un artículo/semilla particular (filtrando por PSI_SEM)."
        }
    },
    
    
    
    
    
    
    
    /* ================================================*/
    /* Produccion - Partes - Partes Extendido */
    /* ================================================*/
    p_extension: { // Usamos p_extension como clave
        descripcion: "Documenta operaciones de 'extendido' o movimiento interno de material (plántulas/bandejas) entre ubicaciones, principalmente invernaderos. Fundamental para seguimiento de ubicación y trazabilidad interna.",
        tabla: `p-extension`, // Nombre de tabla original
        columnas: {
            id: "Número único del registro de extendido (Clave Primaria)",
            PEX_NPA: "Número de partida asociado a la operación", // Probablemente clave foránea a tabla de partidas
            PEX_FEC: "Fecha de la operación de extendido",
            PEX_HORA: "Hora de la operación de extendido",
            PEX_USU: "Identificador del usuario o responsable que realizó el extendido. Clave foránea a la tabla 'vendedores'.",
            PEX_TIPO: "Tipo de operación de extendido (Ej: 'P', 'C'). El significado depende de la configuración.",
            PEX_IOR: "Identificador del invernadero de origen. Clave foránea a la tabla 'invernaderos'.",
            PEX_IDE: "Identificador del invernadero de destino. Clave foránea a la tabla 'invernaderos'."
        },
        relaciones: {
            vendedores: {
                tabla_relacionada: "vendedores",
                tipo: "Muchos a uno",
                campo_enlace_local: "PEX_USU",
                campo_enlace_externo: "id",
                descripcion: "Permite obtener el nombre (VD_DENO) del usuario que realizó el extendido."
            },
            invernaderos_origen: { // Relación para el invernadero de origen
                tabla_relacionada: "invernaderos",
                tipo: "Muchos a uno",
                campo_enlace_local: "PEX_IOR",
                campo_enlace_externo: "id",
                descripcion: "Permite obtener la denominación (INV_DENO) del invernadero desde donde se movió el material."
            },
            invernaderos_destino: { // Relación para el invernadero de destino
                tabla_relacionada: "invernaderos",
                tipo: "Muchos a uno",
                campo_enlace_local: "PEX_IDE",
                campo_enlace_externo: "id",
                descripcion: "Permite obtener la denominación (INV_DENO) del invernadero hacia donde se movió el material."
            }
            // Relación probable con una tabla de 'partidas' a través del campo PEX_NPA, no detallada en el texto.
        },
        ejemplos: {
            consulta_por_id: "Obtener los detalles de una operación de extendido específica usando su 'id'.",
            consulta_por_fecha: "Listar operaciones de extendido realizadas en una fecha o rango de fechas específico (filtrando por PEX_FEC).",
            obtener_invernaderos_usuario: "Para un registro de extendido, usar PEX_IOR, PEX_IDE y PEX_USU para consultar 'invernaderos' y 'vendedores' y obtener los nombres del origen, destino y usuario.",
            filtrar_por_origen_destino: "Encontrar extendidos realizados desde/hacia un invernadero específico (filtrando por PEX_IOR o PEX_IDE).",
            filtrar_por_usuario_fecha: "Buscar extendidos realizados por un usuario específico en un período de tiempo (filtrando por PEX_USU y PEX_FEC)."
        }
    },
    
    
    
/* ======================================================================================================================================================================*/
/* INJERTOS                                                                                                                                                             */
/* ======================================================================================================================================================================*/
    
    /* ================================================*/
/* Injertos – Utilidades – Escandallo Injerto */
/* ================================================*/
p_escan_inj: { // Usamos p_escan_inj como clave
    descripcion: "Registra datos de 'escandallo' (conteo/medición) durante o después del proceso de injerto. Documenta alveolos, huecos, plantas, bandejas asociados a una partida, con fecha, hora y operario. Crucial para control y trazabilidad de injertos.",
    tabla: "p-escan-inj", // Nombre de tabla original
    columnas: {
        id: "Código identificador único del registro de escandallo (Clave Primaria)", // Referenciado como 'Id' en el texto
        PEI_PAR: "Código de Partida asociado", // Sugiere relación con tabla de partidas
        PEI_ALV: "Número de Alveolos registrados",
        PEI_HUE: "Número de Huecos registrados",
        PEI_ETIQ: "Etiqueta asociada al registro",
        PEI_PLAN: "Cantidad de Plantas registradas",
        PEI_BAND: "Cantidad de Bandejas registradas",
        PEI_FEC: "Fecha en que se realizó el escandallo",
        PEI_HORA: "Hora en que se realizó el escandallo",
        PEI_CDOP: "Código del Operario responsable. Sugiere relación con tabla de operarios/vendedores."
    },
    relaciones: {
        // La descripción no detalla explícitamente relaciones formales (claves foráneas) con otras tablas.
        // Sin embargo, se infieren relaciones potenciales:
        // PEI_PAR sugiere una relación con una tabla de 'partidas'.
        // PEI_CDOP sugiere una relación con una tabla de 'operarios' o 'vendedores'.
    },
    ejemplos: {
        consulta_registro_por_id: "Obtener los detalles de un registro de escandallo usando su 'id'.",
        filtrar_por_partida: "Listar registros de escandallo asociados a un código de partida específico (filtrando por PEI_PAR).",
        filtrar_por_fecha_operario: "Buscar registros de escandallo realizados en una fecha específica (filtrando por PEI_FEC) o por un operario determinado (filtrando por PEI_CDOP).",
        consultar_conteos: "Obtener los valores de Alveolos (PEI_ALV), Huecos (PEI_HUE), Plantas (PEI_PLAN) o Bandejas (PEI_BAND) registrados en un escandallo."
    }
},


/* ================================================*/
/* Injertos – Injertos por Fases – Técnicos Fases */
/* ================================================*/
tecnicos_fases: {
    descripcion: "Registra qué técnicos participaron en qué fase del proceso de injerto para una partida específica en una fecha/hora dada, incluyendo la cantidad de bandejas manejadas. Documenta la participación técnica y el avance por fase de las partidas de injerto.",
    tabla: "tecnicos_fases", // Nombre de tabla principal
    columnas: {
        id: "Código único del registro (Clave Primaria)",
        TF_FEC: "Fecha en que se registró esta fase para la partida",
        TF_PAR: "Partida de producción a la que se refiere el registro", // Sugiere relación con tabla de partidas
        TF_FASE: "Fase específica del proceso de injerto", // Sugiere posible relación con tabla de fases de injerto
        TF_LNA: "Campo opcional (uso no confirmado, actualmente NULL)"
    },
    relaciones: {
        tecnicos_fases_tf_lna: {
            tabla_relacionada: "tecnicos_fases_tf_lna",
            tipo: "Uno a muchos (un registro de fase puede tener múltiples líneas de detalle)",
            campo_enlace_local: "id", // El id del registro en tecnicos_fases
            campo_enlace_externo: "id", // El campo id en tecnicos_fases_tf_lna que referencia al registro principal
            descripcion: "Almacena los detalles por línea de un registro de fase, principalmente el técnico participante y las bandejas manejadas.",
            estructura_relacionada: { // Estructura de la tabla de detalle
                id: "ID del registro de fase principal asociado",
                id2: "Identificador secundario/orden de la línea",
                C0: "Código del técnico. Clave foránea a la tabla 'tecnicos'.",
                C1: "Número de bandejas manejadas por el técnico en esta línea."
            },
            relaciones_internas_de_detalle: { // Relaciones que parten de la tabla de detalle
                 tecnicos: {
                    tabla_relacionada: "tecnicos",
                    tipo: "Muchos a uno (varias líneas de detalle pueden referenciar al mismo técnico)",
                    campo_enlace_local: "C0", // El campo local que contiene el código del técnico
                    campo_enlace_externo: "id", // El campo referenciado en la tabla tecnicos
                    descripcion: "Vincula cada línea de detalle de técnico/bandejas con la información del técnico (Ej: TN_DENO para el nombre)."
                 }
            }
        },
        // Relaciones potenciales inferidas:
        // El campo TF_PAR sugiere una relación con una tabla que gestione las partidas de producción.
        // El campo TF_FASE sugiere una posible relación con una tabla que defina las diferentes fases del proceso de injerto.
    },
    ejemplos: {
        consulta_registro_principal: "Obtener los detalles básicos de un registro en 'tecnicos_fases' usando su 'id' (Fecha, Partida, Fase).",
        consultar_detalles_tecnicos: "Para un registro específico en 'tecnicos_fases' (usando su id), consultar la tabla relacionada 'tecnicos_fases_tf_lna' para ver qué técnicos (C0) participaron y cuántas bandejas (C1) manejó cada uno.",
        obtener_nombre_tecnico: "Desde un registro en 'tecnicos_fases_tf_lna' (usando el campo C0), consultar la tabla 'tecnicos' para obtener el nombre del técnico (TN_DENO).",
        filtrar_registros_por_partida_o_fase: "Listar registros en 'tecnicos_fases' que corresponden a una partida específica (TF_PAR) o una fase particular (TF_FASE)."
    }
},



/* ================================================*/
/* Injertos – Injertos por Fases – Partes injertos Sandias */
/* ================================================*/
p_inj_sandia: { // Clave principal sin comillas si es para un objeto JS literal
    descripcion: "Documenta detalles operativos específicos del proceso de injerto de sandía. Registra información sobre la máquina ('enterradora'), operario, partida, cantidad de bandejas, fecha, hora y etiqueta asociada. Fundamental para la trazabilidad y el control de este proceso productivo específico.",
    tabla: "p-inj-sandia", // Nombre de tabla original
    columnas: {
        id: "Código identificador interno del registro (Clave Primaria)",
        PIS_ENT: "Identificador de la Enterradora (máquina). Sugiere relación con tabla de máquinas/equipos.",
        PIS_OPE: "Identificador del Operario (número largo). Sugiere posible relación con tabla de operarios/vendedores.",
        PIS_PAR: "Código de Partida asociada. Sugiere relación con tabla de partidas.",
        PIS_NBAN: "Número de bandejas procesadas en este registro.",
        PIS_FEC: "Fecha en que se realizó el registro.",
        PIS_HORA: "Hora en que se realizó el registro.",
        PIS_ETIQ: "Etiqueta asociada.",
        PIS_CDOP: "Código del Operario (código más corto). Sugiere posible relación con tabla de operarios/vendedores/técnicos. Nota: Posible redundancia o diferencia con PIS_OPE."
    },
    relaciones: {
        observaciones: "La descripción no detalla explícitamente relaciones formales (claves foráneas) con otras tablas.",
        inferidas: {
            partidas: {
                campo_local: "PIS_PAR",
                descripcion_inferida: "Sugiere relación con una tabla que gestione las partidas de producción."
            },
            operarios: {
                campos_locales: ["PIS_OPE", "PIS_CDOP"],
                descripcion_inferida: "Sugiere posible relación con una tabla que gestione operarios/usuarios (vendedores/técnicos), aunque hay ambigüedad entre PIS_OPE y PIS_CDOP."
            },
            maquinas_enterradoras: {
                campo_local: "PIS_ENT",
                descripcion_inferida: "Sugiere posible relación con una tabla que gestione máquinas o equipos de injerto ('enterradoras')."
            }
        }
    },
    ejemplos: {
        consulta_registro_por_id: "Obtener los detalles de un registro de parte de injerto de sandía usando su 'id'.",
        filtrar_por_partida: "Listar registros asociados a un código de partida específico (filtrando por PIS_PAR).",
        filtrar_por_fecha: "Buscar registros realizados en una fecha específica (filtrando por PIS_FEC).",
        filtrar_por_operario_o_maquina: "Encontrar registros asociados a un operario (filtrando por PIS_OPE o PIS_CDOP) o a una enterradora específica (filtrando por PIS_ENT)."
    }
}, 

/* ================================================*/
/* Injertos – Injertos por Fases – Partes injertos Tomate */
/* ================================================*/
p_inj_tomate: { // Clave principal
    descripcion: "Documenta detalles operativos específicos del proceso de injerto de tomate. Registra información sobre el operario, partida, cantidad de bandejas, fecha, hora y etiqueta asociada. Fundamental para la trazabilidad y el control de este proceso productivo específico.",
    tabla: "p-inj-tomate", // Nombre de tabla original
    columnas: {
        id: "Identificador interno del registro (Clave Primaria, campo oculto)",
        PIT_OPE: "Identificador largo o 'Etiqueta Operario'. Sugiere posible relación con tabla de operarios/vendedores.",
        PIT_PAR: "Código de Partida asociada. Sugiere relación con tabla de partidas.",
        PIT_NBAN: "Número de bandejas procesadas en este registro.",
        PIT_FEC: "Fecha en que se realizó el registro.",
        PIT_HORA: "Hora en que se realizó el registro.",
        PIT_ETIQ: "Etiqueta asociada.",
        PIT_CDOP: "Código del Operario (código más corto). Sugiere posible relación con tabla de operarios/vendedores/técnicos. Nota: Posible redundancia o diferencia con PIT_OPE."
    },
    relaciones: {
        observaciones: "La descripción no detalla explícitamente relaciones formales (claves foráneas) con otras tablas.",
        inferidas: {
            partidas: {
                campo_local: "PIT_PAR",
                descripcion_inferida: "Sugiere relación con una tabla que gestione las partidas de producción."
            },
            operarios: {
                campos_locales: ["PIT_OPE", "PIT_CDOP"],
                descripcion_inferida: "Sugiere posible relación con una tabla que gestione operarios/usuarios (vendedores/técnicos), aunque hay ambigüedad entre PIT_OPE y PIT_CDOP. PIT_CDOP parece más probable como clave externa directa."
            }
        }
    },
    ejemplos: {
        consulta_registro_oculto_por_id: "Obtener los detalles de un registro usando su 'id' (aunque sea oculto en interfaz).",
        filtrar_por_partida: "Listar registros asociados a un código de partida específico (filtrando por PIT_PAR).",
        filtrar_por_fecha: "Buscar registros realizados en una fecha específica (filtrando por PIT_FEC).",
        filtrar_por_operario: "Encontrar registros asociados a un operario usando PIT_OPE o PIT_CDOP (filtrando por uno de estos campos)."
    }
},
    
    /* ======================================================================================================================================================================*/
    /* VENTAS                                                                                                                                                       */
    /* ======================================================================================================================================================================*/
    
    
    /* ======================================================================================================================================================================*/
    /* COBROS                                                                                                                                                            */
    /* ======================================================================================================================================================================*/
    
/* ================================================*/
/* Cobros – General – Cartera de Cobros */
/* ================================================*/
cobros: { // Clave principal (nombre de tabla)
    descripcion: "Administra la 'cartera de cobros', registrando documentos o partidas pendientes de cobro a clientes. Permite seguimiento de importes adeudados, fechas de vencimiento y vinculación con vendedor, cliente y banco.",
    tabla: "cobros", // Nombre de tabla original
    columnas: {
        id: "Identificador único de cada partida de cobro (Clave Primaria)",
        CB_VD: "Vendedor que originó la operación. Clave foránea a la tabla 'vendedores' para obtener la denominación (VD_DENO).",
        CB_CCL: "Cliente deudor. Clave foránea a la tabla 'clientes' para obtener la denominación (CL_DENO).",
        CB_FEC: "Fecha en la que se generó o registró la cartera de cobro.",
        CB_VTO: "Fecha de vencimiento del cobro.",
        CB_TIPO: "Tipo de la cartera de cobro (Ej: 'P', 'R').",
        CB_IMPO: "Importe monetario del cobro pendiente.",
        CB_BAN: "Entidad bancaria asociada al cobro. Clave foránea a la tabla 'bancos' para obtener la denominación (BA_DENO)."
    },
    relaciones: {
        vendedores: {
            tabla_relacionada: "vendedores",
            tipo: "Muchos a uno",
            campo_enlace_local: "CB_VD",
            campo_enlace_externo: "id",
            descripcion: "Vincula la partida de cobro con el vendedor que gestionó la operación."
        },
        clientes: {
            tabla_relacionada: "clientes",
            tipo: "Muchos a uno",
            campo_enlace_local: "CB_CCL",
            campo_enlace_externo: "id",
            descripcion: "Vincula la partida de cobro con el cliente deudor."
        },
        bancos: {
            tabla_relacionada: "bancos",
            tipo: "Muchos a uno",
            campo_enlace_local: "CB_BAN",
            campo_enlace_externo: "id",
            descripcion: "Vincula la partida de cobro con la entidad bancaria asociada."
        }
    },
    ejemplos: {
        consulta_cobro_por_id: "Obtener los detalles de una partida de cobro específica usando su 'id'.",
        consultar_cobros_por_cliente: "Listar todas las partidas de cobro pendientes para un cliente específico (filtrando por CB_CCL).",
        filtrar_cobros_por_fecha_vencimiento: "Buscar cobros cuya fecha de vencimiento (CB_VTO) esté en un rango específico.",
        obtener_info_relacionada: "Para una partida de cobro, usar CB_VD, CB_CCL y CB_BAN para consultar 'vendedores', 'clientes' y 'bancos' y obtener los nombres del vendedor, cliente y banco."
    }
}, 


/* ================================================*/
/* Cobros – General – Remesas Cobros */
/* ================================================*/
remesas: { // Clave principal (nombre de tabla)
    descripcion: "Gestiona 'remesas de cobro', agrupando partidas pendientes (de Cartera de cobros) para su presentación conjunta a un banco. Esencial para automatizar y controlar el proceso de cobro bancario y conciliación.",
    tabla: "remesas", // Nombre de tabla original
    columna: {
        id: "Número único que identifica cada remesa (Clave Primaria)",
        RM_BCO: "Número del banco asociado a la remesa. Clave foránea a la tabla 'bancos' para obtener la denominación (BA_DENO).",
        RM_FEC: "Fecha en la que se generó la remesa.",
        RM_TIPO: "Tipo de documento o proceso de la remesa (Ej: 'Tipo Dto').",
        RM_TTT: "Importe total de la remesa (suma de todos los cobros que la componen)."
    },
    relaciones: {
        bancos: {
            tabla_relacionada: "bancos",
            tipo: "Muchos a uno",
            campo_enlace_local: "RM_BCO",
            campo_enlace_externo: "id",
            descripcion: "Vincula la remesa con la entidad bancaria a la que se presenta."
        },
        cobros_incluidos: {
            tabla_relacionada: "[Tabla no especificada]", // Nombre de tabla desconocido según la descripción
            tipo: "Uno a muchos (una remesa puede incluir muchos cobros)",
            campo_enlace_local: "id", // El id de la remesa
            campo_enlace_externo: "[Campo en tabla rel. que apunta a remesas.id]", // Nombre de campo desconocido
            descripcion: "Relación con una tabla auxiliar (nombre no especificado) que registra qué partidas individuales de la cartera de cobros (tabla 'cobros') están incluidas en esta remesa y han sido procesadas/canceladas por ella.",
            relacion_interna: { // La tabla auxiliar se relaciona a su vez con la tabla 'cobros'
                tabla_relacionada: "cobros",
                tipo: "Muchos a uno (varias líneas en la tabla auxiliar apuntan al mismo cobro si un cobro pudiera estar en múltiples remesas, aunque lo típico sería Uno a Uno en la tabla auxiliar con referencia a cobros)", // Ajustar si se aclara la estructura
                campo_enlace_local: "[Campo en tabla rel. que apunta a cobros.id]", // Nombre de campo desconocido
                campo_enlace_externo: "id", // El id del cobro
                descripcion: "Vincula la línea de la tabla auxiliar con la partida de cobro original de la tabla 'cobros'."
            }
        }
    },
    ejemplos: {
        consulta_remesa_por_id: "Obtener los detalles de una remesa específica usando su 'id'.",
        consultar_banco_remesa: "Para una remesa, usar RM_BCO para consultar la tabla 'bancos' y obtener el nombre del banco asociado (BA_DENO).",
        filtrar_remesas_por_fecha_o_tipo: "Listar remesas generadas en una fecha o rango de fechas (filtrando por RM_FEC) o por un tipo específico (filtrando por RM_TIPO).",
        consultar_cobros_en_remesa: "Ver qué partidas de cobro individuales están incluidas en una remesa específica (requiere consultar la tabla auxiliar no especificada que relaciona remesas con cobros)."
    }
},






/* ================================================*/
/* Cobros – Caja – Movimientos Caja Bancos */
/* ================================================*/
movimientos_caja_bancos: { // Clave principal (basada en el nombre de la sección)
    descripcion: "Registra y gestiona los traspasos de fondos entre las diferentes cajas (efectivo) y cuentas bancarias de la empresa. Documenta flujos monetarios internos para control de tesorería y conciliación.",
    tabla: "[Tabla de Movimientos Caja Bancos]", // Nombre de tabla inferido o no especificado explícitamente (campos con prefijo MV_)
    columnas: {
        id: "Código o identificador único de cada movimiento (Clave Primaria)",
        MV_FEC: "Fecha en la que se registró el movimiento",
        MV_CTO: "Concepto o breve descripción del movimiento",
        MV_IMPO: "Cantidad monetaria del importe del movimiento",
        MV_USU: "Usuario que gestionó el movimiento. Clave foránea a la tabla 'vendedores' para obtener la denominación (VD_DENO).",
        MV_BAO: "Nombre del banco o caja de Origen del movimiento. Clave foránea a la tabla 'bancos' para obtener la denominación (BA_DENO) de la entidad de origen.",
        MV_TIPO: "Tipo de movimiento (Ej: '1').",
        MV_CTB: "Indica si el movimiento es 'Contabilizable' (Ej: 'S')." // Interpretación basada en el ejemplo 'S'
    },
    relaciones: {
        vendedores: {
            tabla_relacionada: "vendedores",
            tipo: "Muchos a uno",
            campo_enlace_local: "MV_USU",
            campo_enlace_externo: "id",
            descripcion: "Vincula el movimiento con el usuario responsable que lo registró."
        },
        bancos_origen: { // Relación para la entidad de origen
            tabla_relacionada: "bancos", // Asumiendo que 'bancos' incluye tanto bancos como cajas de efectivo
            tipo: "Muchos a uno",
            campo_enlace_local: "MV_BAO",
            campo_enlace_externo: "id",
            descripcion: "Vincula el movimiento con el banco o caja de origen."
        }
        // Se infiere que también existe una relación similar para el banco o caja de destino del movimiento (campo no detallado).
    },
    ejemplos: {
        consulta_movimiento_por_id: "Obtener los detalles de un movimiento de caja/bancos específico usando su 'id'.",
        filtrar_por_fecha: "Listar movimientos registrados en una fecha o rango de fechas específico (filtrando por MV_FEC).",
        filtrar_por_usuario: "Buscar movimientos gestionados por un usuario específico (filtrando por MV_USU).",
        filtrar_por_origen_o_tipo: "Encontrar movimientos que provienen de un banco/caja de origen específico (filtrando por MV_BAO) o que son de un tipo particular (filtrando por MV_TIPO).",
        obtener_info_relacionada: "Para un movimiento, usar MV_USU y MV_BAO para consultar 'vendedores' y 'bancos' y obtener los nombres del usuario y la entidad de origen."
    }
},


    
    /* ======================================================================================================================================================================*/
    /* COMPRAS                                                                                                                                                             */
    /* ======================================================================================================================================================================*/
    

/* ================================================*/
/* Compras – Gestión Compras – Albaranes Compra */
/* ================================================*/
alb_compra: { // Clave principal (basada en el nombre de tabla)
    descripcion: "Registra y administra los albaranes de compra, documentando la recepción de mercancías o servicios de proveedores. Crucial para control de inventario, verificación de pedidos, validación de facturas y seguimiento de condiciones comerciales.",
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
        AC_TTT: "Monto total final del albarán."
    },
    relaciones: {
        proveedores: {
            tabla_relacionada: "proveedores",
            tipo: "Muchos a uno",
            campo_enlace_local: "AC_CPR",
            campo_enlace_externo: "id",
            descripcion: "Vincula el albarán con el proveedor que emitió la entrega."
        },
        almacenes: {
            tabla_relacionada: "almacenes",
            tipo: "Muchos a uno",
            campo_enlace_local: "AC_ALM",
            campo_enlace_externo: "id",
            descripcion: "Vincula el albarán con el almacén de Semilleros Deitana donde se recibieron los artículos."
        },
        fpago: {
            tabla_relacionada: "fpago",
            tipo: "Muchos a uno",
            campo_enlace_local: "AC_FP",
            campo_enlace_externo: "id",
            descripcion: "Vincula el albarán con la forma de pago acordada para la transacción."
        },
        // Relaciones potenciales inferidas:
        pedidos_compra: {
            tabla_relacionada: "[Tabla de Pedidos de Compra]", // Nombre de tabla no especificado
            tipo: "Muchos a uno (un albarán puede provenir de un pedido)", // Tipo inferido
            campo_enlace_local: "AC_NPD", // El campo que contiene el número/id del pedido
            campo_enlace_externo: "[Campo id/número en tabla de pedidos]", // Nombre de campo no especificado
            descripcion_inferida: "Sugiere vínculo con una tabla de pedidos de compra, permitiendo trazar el albarán al pedido original."
        },
        facturas_proveedor: {
             tabla_relacionada: "[Tabla de Facturas de Proveedor]", // Nombre de tabla no especificado
             tipo: "Uno a uno o Uno a cero-o-uno (un albarán se asocia a una factura o ninguna)", // Tipo inferido
             campo_enlace_local: "AC_FRA", // El campo que contiene el número/id de la factura
             campo_enlace_externo: "[Campo id/número en tabla de facturas]", // Nombre de campo no especificado
             descripcion_inferida: "Sugiere vínculo con una tabla de facturas de proveedor, permitiendo asociar el albarán a la factura emitida."
        }
    },
    ejemplos: {
        consulta_albaran_por_id: "Obtener los detalles de un albarán de compra específico usando su 'id'.",
        consultar_info_relacionada: "Para un albarán, usar AC_CPR, AC_ALM y AC_FP para consultar 'proveedores', 'almacenes' y 'fpago' y obtener los nombres del proveedor, almacén y forma de pago.",
        filtrar_albaranes_por_proveedor_o_fecha: "Listar albaranes recibidos de un proveedor específico (filtrando por AC_CPR) o en un rango de fechas (filtrando por AC_FEC).",
        vincular_a_pedido_o_factura: "Usar AC_NPD o AC_FRA/AC_FFR para encontrar el pedido de compra o la factura asociada (requiere consultar las tablas correspondientes)."
    }
},


/* ================================================*/
/* Compras – Gestión Compras – Pedidos a Proveedor */
/* ================================================*/
pedidos_pr: { // Clave principal (nombre de tabla)
    descripcion: "Registra y sigue los pedidos de compra realizados a proveedores. Punto de partida formal para solicitar adquisición de bienes/servicios. Crucial para planificación de compras, control de inventario, gestión de proveedores y base para recepciones/facturas.",
    tabla: "pedidos_pr", // Nombre de tabla original
    columnas: {
        id: "Número único que identifica cada pedido a proveedor (Clave Primaria)",
        PP_CPR: "Código del proveedor. Clave foránea a la tabla 'proveedores' para obtener la denominación (PR_DENO).",
        PP_ALM: "Almacén de recepción designado. Clave foránea a la tabla 'almacenes' para obtener la denominación (AM_DENO).",
        PP_FEC: "Fecha en que se emitió el pedido.",
        PP_FSV: "Fecha esperada de entrega por el proveedor ('fecha servir').",
        PP_FP: "Forma de pago acordada. Clave foránea a la tabla 'fpago' para obtener la denominación (FP_DENO).",
        PP_BRU: "Monto bruto total del pedido.",
        PP_NETO: "Monto neto del pedido.",
        PP_IMPU: "Costo total de los impuestos aplicados.",
        PP_TTT: "Monto total final del pedido.",
        PP_DPP: "Persona dentro de la empresa que realizó o solicitó el pedido ('Pedido por')." // Sugiere relación con tabla de usuarios/empleados
    },
    relaciones: {
        proveedores: {
            tabla_relacionada: "proveedores",
            tipo: "Muchos a uno",
            campo_enlace_local: "PP_CPR",
            campo_enlace_externo: "id",
            descripcion: "Vincula el pedido con el proveedor al que se le realizó la solicitud."
        },
        almacenes: {
            tabla_relacionada: "almacenes",
            tipo: "Muchos a uno",
            campo_enlace_local: "PP_ALM",
            campo_enlace_externo: "id",
            descripcion: "Vincula el pedido con el almacén donde se espera recibir la mercancía."
        },
        fpago: {
            tabla_relacionada: "fpago",
            tipo: "Muchos a uno",
            campo_enlace_local: "PP_FP",
            campo_enlace_externo: "id",
            descripcion: "Vincula el pedido con la forma de pago acordada."
        },
        // Relación potencial inferida:
        solicitante: {
             tabla_relacionada: "[Tabla de Usuarios/Empleados]", // Nombre de tabla no especificado
             tipo: "Muchos a uno (varios pedidos pueden ser solicitados por la misma persona)", // Tipo inferido
             campo_enlace_local: "PP_DPP", // El campo que contiene el identificador de la persona
             campo_enlace_externo: "[Campo id/código en tabla de usuarios/empleados]", // Nombre de campo no especificado
             descripcion_inferida: "Sugiere vínculo con una tabla que identifique a los empleados o usuarios que pueden generar pedidos."
        }
    },
    ejemplos: {
        consulta_pedido_por_id: "Obtener los detalles de un pedido a proveedor específico usando su 'id'.",
        consultar_info_relacionada: "Para un pedido, usar PP_CPR, PP_ALM y PP_FP para consultar 'proveedores', 'almacenes' y 'fpago' y obtener los nombres del proveedor, almacén y forma de pago.",
        filtrar_pedidos_por_proveedor_o_fecha: "Listar pedidos realizados a un proveedor específico (filtrando por PP_CPR) o en un rango de fechas (filtrando por PP_FEC).",
        filtrar_pedidos_por_fecha_entrega_esperada: "Buscar pedidos con una fecha de entrega esperada (PP_FSV) en un rango específico.",
        filtrar_pedidos_por_solicitante: "Encontrar pedidos realizados por una persona específica dentro de la empresa (filtrando por PP_DPP)."
    }
}, 


/* ================================================*/
/* Compras – Facturación Compras – Registro de Facturas Recibidas */
/* ================================================*/
facturas_r: { // Clave principal (basada en el nombre de tabla)
    descripcion: "Registra y gestiona las facturas recibidas de proveedores. Punto de entrada formal de documentos de cobro de proveedores. Crucial para control financiero, cuentas por pagar, validación y base para pagos.",
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
        FR_USU: "Usuario que realizó el registro de la factura. Clave foránea a la tabla 'vendedores' para obtener la denominación (VD_DENO)."
    },
    relaciones: {
        proveedores: {
            tabla_relacionada: "proveedores",
            tipo: "Muchos a uno",
            campo_enlace_local: "FR_CPR",
            campo_enlace_externo: "id",
            descripcion: "Vincula la factura con el proveedor que la emitió."
        },
        almacenes: {
            tabla_relacionada: "almacenes",
            tipo: "Muchos a uno",
            campo_enlace_local: "FR_ALM",
            campo_enlace_externo: "id",
            descripcion: "Vincula la factura con el almacén posiblemente relacionado con la recepción."
        },
        fpago: {
            tabla_relacionada: "fpago",
            tipo: "Muchos a uno",
            campo_enlace_local: "FR_FP",
            campo_enlace_externo: "id",
            descripcion: "Vincula la factura con la forma de pago asociada."
        },
        vendedores: {
            tabla_relacionada: "vendedores",
            tipo: "Muchos a uno",
            campo_enlace_local: "FR_USU",
            campo_enlace_externo: "id",
            descripcion: "Vincula la factura con el usuario interno que realizó el registro."
        },
        // Relación potencial inferida:
        albaranes_compra: {
             tabla_relacionada: "alb-compra", // Nombre de tabla inferido
             tipo: "Posiblemente Muchos a Muchos o Uno a Muchos", // Tipo inferido, una factura puede cubrir varios albaranes o viceversa
             campo_enlace_local: "id", // Id de la factura
             campo_enlace_externo: "[Campo(s) en tabla de enlace o en alb-compra que apuntan a factura.id]", // Mecanismo de enlace no especificado
             descripcion_inferida: "Sugiere vínculo con la tabla de albaranes de compra ('alb-compra'), permitiendo relacionar la factura recibida con las entregas correspondientes."
        }
    },
    ejemplos: {
        consulta_factura_por_id: "Obtener los detalles de una factura recibida específica usando su 'id'.",
        consultar_info_relacionada: "Para una factura, usar FR_CPR, FR_ALM, FR_FP y FR_USU para consultar 'proveedores', 'almacenes', 'fpago' y 'vendedores' y obtener los nombres del proveedor, almacén, forma de pago y usuario registrador.",
        filtrar_facturas_por_proveedor_o_fecha: "Listar facturas recibidas de un proveedor específico (filtrando por FR_CPR) o registradas en un rango de fechas (filtrando por FR_FEC).",
        filtrar_facturas_por_usuario_o_forma_pago: "Buscar facturas registradas por un usuario específico (filtrando por FR_USU) o con una forma de pago particular (filtrando por FR_FP).",
        vincular_a_albaran: "Encontrar los albaranes de compra asociados a esta factura (requiere consultar la tabla de albaranes o una tabla de enlace, si existe)."
    }
}, 

/* ================================================*/
/* Compras – Facturación Compras – Facturas de Gastos */
/* ================================================*/
gastos: { // Clave principal (nombre de tabla)
    descripcion: "Registra facturas correspondientes a gastos generales de la empresa, distintos de compras de inventario (incluye pagos de préstamos). Documenta costos operativos y administrativos para control, contabilidad y análisis.",
    tabla: "gastos", // Nombre de tabla original
    columnas: {
        id: "Código de registro único que identifica cada gasto (Clave Primaria)",
        GA_PRV: "Denominación de la entidad o persona a la que corresponde el gasto (campo de texto descriptivo, no clave foránea a tabla de proveedores según descripción).", // Nota basada en el texto fuente
        GA_SUFA: "Número de factura asociado a este gasto.",
        GA_FEC: "Fecha en que se registró el gasto.",
        GA_CTO: "Concepto o descripción detallada del gasto.",
        GA_TTF: "Monto total del gasto."
    },
    relaciones: {
        observaciones: "La descripción proporcionada no detalla explícitamente relaciones formales (claves foráneas) con otras tablas como proveedores (más allá de la denominación en GA_PRV), vendedores o formas de pago (fpago)."
        // Aunque lógicamente podrían existir relaciones (ej: con tabla de centros de coste, proyectos, etc.), no están descritas aquí.
    },
    ejemplos: {
        consulta_gasto_por_id: "Obtener los detalles de un registro de gasto específico usando su 'id'.",
        filtrar_gastos_por_fecha: "Listar gastos registrados en una fecha o rango de fechas específico (filtrando por GA_FEC).",
        buscar_gasto_por_entidad_o_concepto: "Buscar gastos que contengan cierta denominación en GA_PRV o cierto texto en el concepto GA_CTO.",
        filtrar_gastos_por_numero_factura: "Encontrar gastos asociados a un número de factura específico (filtrando por GA_SUFA)."
    }
},




/* ================================================*/
/* Compras – General Pagos – Cartera de pagos */
/* ================================================*/
pagos: { // Clave principal (nombre de tabla)
    descripcion: "Administra la 'cartera de pagos', registrando obligaciones pendientes a proveedores y otros acreedores. Permite seguimiento de cantidades adeudadas, fechas de vencimiento, y vinculación con acreedor, banco de origen y responsable interno.",
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
        PG_VD: "Vendedor o usuario interno que gestionó este pago. Clave foránea a la tabla 'vendedores' para obtener la denominación (VD_DENO)."
    },
    relaciones: {
        proveedores: {
            tabla_relacionada: "proveedores",
            tipo: "Muchos a uno",
            campo_enlace_local: "PG_CPR",
            campo_enlace_externo: "id",
            descripcion: "Vincula la partida de pago con el proveedor acreedor."
        },
        bancos: {
            tabla_relacionada: "bancos",
            tipo: "Muchos a uno",
            campo_enlace_local: "PG_BAN",
            campo_enlace_externo: "id",
            descripcion: "Vincula la partida de pago con la cuenta bancaria de la empresa desde la cual se realizará el pago."
        },
        vendedores: {
            tabla_relacionada: "vendedores",
            tipo: "Muchos a uno",
            campo_enlace_local: "PG_VD",
            campo_enlace_externo: "id",
            descripcion: "Vincula la partida de pago con el usuario/vendedor interno que gestionó el registro."
        },
        // Relación potencial inferida:
        documentos_origen: {
             tabla_relacionada: "[Tablas de Facturas Recibidas / Albarenes Compra]", // Nombres de tablas no especificados explícitamente
             tipo: "Posiblemente Muchos a Uno o Muchos a Muchos", // Tipo inferido, un pago puede cubrir uno o varios documentos
             campo_enlace_local: "PG_DTO", // El campo que contiene el número del documento
             campo_enlace_externo: "[Campo número de documento en tablas origen]", // Nombre de campo no especificado (ej: FR_SUFA, AC_SUA)
             descripcion_inferida: "Sugiere vínculo con las facturas recibidas o albaranes de compra que originaron la obligación de pago, usando el número de documento (PG_DTO)."
        }
    },
    ejemplos: {
        consulta_pago_por_id: "Obtener los detalles de una partida de pago específica usando su 'id'.",
        consultar_pagos_por_proveedor: "Listar todas las partidas de pago pendientes para un proveedor específico (filtrando por PG_CPR).",
        filtrar_pagos_por_fecha_vencimiento: "Buscar pagos cuya fecha de vencimiento (PG_VTO) esté en un rango específico.",
        obtener_info_relacionada: "Para una partida de pago, usar PG_CPR, PG_BAN y PG_VD para consultar 'proveedores', 'bancos' y 'vendedores' y obtener los nombres del proveedor, banco de origen y responsable interno.",
        buscar_pago_por_documento: "Encontrar partidas de pago asociadas a un número de documento específico (filtrando por PG_DTO)."
    }
},

/* ================================================*/
/* Compras – General Pagos – Remesas de Pago */
/* ================================================*/
transferencias: { // Clave principal (nombre de tabla)
    descripcion: "Gestiona 'remesas de pago', agrupando partidas pendientes (de Cartera de pagos) para su procesamiento conjunto, típicamente vía banco. Facilita y automatiza el proceso de pago a proveedores de forma masiva.",
    tabla: "transferencias", // Nombre de tabla original
    columnas: {
        id: "Número único que identifica cada remesa de pago (Clave Primaria)",
        XT_BCO: "Código del banco de Semilleros Deitana desde el cual se realizará la remesa. Clave foránea a la tabla 'bancos' para obtener la denominación (BA_DENO).",
        XT_FEC: "Fecha en que se generó la remesa.",
        XT_TIPO: "Tipo de remesa o proceso asociado.",
        XT_TTT: "Importe total de la remesa (suma de todos los pagos individuales)."
    },
    relaciones: {
        bancos: {
            tabla_relacionada: "bancos",
            tipo: "Muchos a uno",
            campo_enlace_local: "XT_BCO",
            campo_enlace_externo: "id",
            descripcion: "Vincula la remesa con la cuenta bancaria de la empresa desde la cual se emitirán los pagos."
        },
        pagos_incluidos: {
            tabla_relacionada: "pagos", // La tabla 'Cartera de pagos'
            tipo: "Implícita - Uno a muchos (una remesa agrupa muchos pagos)",
            campo_enlace_local: "id", // El id de la remesa
            campo_enlace_externo: "[Campo(s) en 'pagos' o tabla intermedia]", // Mecanismo de enlace no especificado (probablemente via una tabla intermedia o un campo en 'pagos' que referencia a 'transferencias')
            descripcion_inferida: "Relación conceptual (y probablemente implementada) que vincula esta remesa con las partidas individuales de la 'Cartera de pagos' ('pagos') que están incluidas en ella para ser procesadas."
        }
    },
    ejemplos: {
        consulta_remesa_por_id: "Obtener los detalles de una remesa de pago específica usando su 'id'.",
        consultar_banco_remesa: "Para una remesa, usar XT_BCO para consultar la tabla 'bancos' y obtener el nombre del banco de origen (BA_DENO).",
        filtrar_remesas_por_fecha_o_tipo: "Listar remesas generadas en una fecha o rango de fechas (filtrando por XT_FEC) o por un tipo específico (filtrando por XT_TIPO).",
        consultar_pagos_en_remesa: "Ver qué partidas de pago individuales (de la tabla 'pagos') están incluidas en una remesa específica (requiere consultar la tabla 'pagos' o una tabla intermedia que las vincule con 'transferencias')."
    }
},











    
    /* ======================================================================================================================================================================*/
    /* ORNAMENTAL                                                                                                                                                            */
    /* ======================================================================================================================================================================*/
    
    
    
    /* ======================================================================================================================================================================*/
    /* ALMACEN                                                                                                                                                            */
    /* ======================================================================================================================================================================*/
    
    
    
    };
    
    module.exports = { mapaERP };