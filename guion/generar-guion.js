/**
 * generar-guion.js
 * Construye el guion del video (.docx) para el Caso de Estudio de
 * contenedores: bloques cronometrados, que mostrar, que decir y los
 * comandos exactos a tener a mano durante la grabacion.
 *
 * Uso: node guion/generar-guion.js
 */
const fs = require("node:fs");
const path = require("node:path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  BorderStyle, ShadingType, Table, TableRow, TableCell, WidthType,
  VerticalAlign, Footer, Header, PageNumber, PageBreak, Tab, TabStopType,
  LeaderType, LevelFormat, convertInchesToTwip,
} = require("docx");

const RAIZ = path.resolve(__dirname, "..");
const SALIDA = path.join(__dirname, "salida");

const DATOS = {
  universidad: "Universidad de La Salle",
  facultad: "Facultad de Ingeniería — Programa de Ingeniería de Software",
  curso: "Herramientas de Software II",
  caso: "Caso de Estudio: Gestión de Estudiantes con Contenedores",
  titulo: "Guion del video de sustentación",
  subtitulo: "API RESTful en Docker desplegada en AWS Fargate",
  autor: "Juan Sebastián Martínez",
  ciudad: "Bogotá D.C.",
  fecha: "Septiembre de 2026",
};

const ANCHO_PAGINA = 12240, ALTO_PAGINA = 15840;
const MARGEN = convertInchesToTwip(1);
const ANCHO_UTIL = ANCHO_PAGINA - MARGEN * 2;
const AZUL = "1B4F72", GRIS = "444444", GRIS_CODIGO = "F2F2F2";

const p = (texto, o = {}) =>
  new Paragraph({
    alignment: o.alineacion ?? AlignmentType.JUSTIFIED,
    spacing: { after: o.despues ?? 130, line: 276 },
    children: [new TextRun({
      text: texto, font: "Calibri", size: o.tamano ?? 22,
      bold: o.negrita ?? false, italics: o.cursiva ?? false, color: o.color ?? "000000",
    })],
  });

const h1 = (t) => new Paragraph({
  heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 170 },
  children: [new TextRun({ text: t, font: "Calibri", size: 30, bold: true, color: AZUL })],
});

const h2 = (t) => new Paragraph({
  heading: HeadingLevel.HEADING_2, spacing: { before: 230, after: 130 },
  children: [new TextRun({ text: t, font: "Calibri", size: 25, bold: true, color: "2E5F8A" })],
});

const vinieta = (t) => new Paragraph({
  numbering: { reference: "vinietas", level: 0 },
  spacing: { after: 85, line: 276 }, alignment: AlignmentType.JUSTIFIED,
  children: [new TextRun({ text: t, font: "Calibri", size: 22 })],
});

const saltoPagina = () => new Paragraph({ children: [new PageBreak()] });

const ANCHO_CODIGO = 86;
function ajustar(lineas) {
  const salida = [];
  for (const linea of lineas) {
    if (linea.length <= ANCHO_CODIGO) { salida.push(linea); continue; }
    let resto = linea, primera = true;
    const sangria = (linea.match(/^\s*/) || [""])[0] + "  ";
    while (resto.length > ANCHO_CODIGO) {
      const limite = primera ? ANCHO_CODIGO : ANCHO_CODIGO - sangria.length;
      let corte = resto.lastIndexOf(" ", limite);
      if (corte <= 0) corte = limite;
      salida.push((primera ? "" : sangria) + resto.slice(0, corte).trimEnd());
      resto = resto.slice(corte).replace(/^ +/, ""); primera = false;
    }
    if (resto.length) salida.push(sangria + resto);
  }
  return salida;
}

function codigo(lineasOriginales, subtitulo) {
  const lineas = ajustar(lineasOriginales);
  const bloque = [];
  if (subtitulo) {
    bloque.push(new Paragraph({
      spacing: { before: 110, after: 55 },
      children: [new TextRun({ text: subtitulo, font: "Calibri", size: 19, bold: true, color: GRIS })],
    }));
  }
  lineas.forEach((l, i) => {
    bloque.push(new Paragraph({
      spacing: { before: i === 0 ? 40 : 0, after: i === lineas.length - 1 ? 150 : 0 },
      shading: { type: ShadingType.CLEAR, fill: GRIS_CODIGO, color: "auto" },
      border: { left: { style: BorderStyle.SINGLE, size: 12, color: "9AA5B1", space: 6 } },
      indent: { left: 120, right: 120 },
      children: [new TextRun({ text: l.length ? l : " ", font: "Consolas", size: 17, color: "1A1A1A" })],
    }));
  });
  return bloque;
}

function fragmento(rutaRelativa, marcaInicio, marcaFin, lineasAntes = 0) {
  const contenido = fs.readFileSync(path.join(RAIZ, rutaRelativa), "utf8").split("\n");
  const encontrado = contenido.findIndex((l) => l.includes(marcaInicio));
  if (encontrado === -1) throw new Error(`No se encontro "${marcaInicio}" en ${rutaRelativa}`);
  const inicio = Math.max(0, encontrado - lineasAntes);
  let fin = contenido.findIndex((l, i) => i > encontrado && l.includes(marcaFin));
  if (fin === -1) fin = contenido.length - 1;
  return contenido.slice(inicio, fin + 1).map((l) => l.replace(/\t/g, "    "));
}

function esIdentificador(t) {
  const s = t.trim();
  if (!s || /\s/.test(s)) return false;
  return /^[A-Za-z0-9_.:{}/*$+-]+$/.test(s) && /[-._:/{}$]/.test(s);
}

function tabla(encabezados, filas, proporciones) {
  const anchos = proporciones.map((f) => Math.round(ANCHO_UTIL * f));
  anchos[anchos.length - 1] += ANCHO_UTIL - anchos.reduce((a, b) => a + b, 0);
  const celda = (texto, i, esEnc) => new TableCell({
    width: { size: anchos[i], type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    shading: esEnc ? { type: ShadingType.CLEAR, fill: AZUL, color: "auto" } : undefined,
    margins: { top: 80, bottom: 80, left: 110, right: 110 },
    children: String(texto).split("|").map((l) => new Paragraph({
      spacing: { after: 0, line: 252 },
      children: [new TextRun({
        text: l, font: !esEnc && esIdentificador(l) ? "Consolas" : "Calibri",
        size: 19, bold: esEnc, color: esEnc ? "FFFFFF" : "000000",
      })],
    })),
  });
  return new Table({
    width: { size: ANCHO_UTIL, type: WidthType.DXA }, columnWidths: anchos,
    rows: [
      new TableRow({ tableHeader: true, children: encabezados.map((t, i) => celda(t, i, true)) }),
      ...filas.map((f) => new TableRow({ children: f.map((t, i) => celda(t, i, false)) })),
    ],
  });
}

const pieTabla = (t) => new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { before: 70, after: 190 },
  children: [new TextRun({ text: t, font: "Calibri", size: 18, italics: true, color: GRIS })],
});

/** Encabezado de un bloque del guion, con su franja de tiempo. */
function bloque(rango, titulo) {
  return new Paragraph({
    spacing: { before: 280, after: 150 },
    shading: { type: ShadingType.CLEAR, fill: "EAF0F6", color: "auto" },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: AZUL, space: 8 } },
    indent: { left: 120, right: 120 },
    children: [
      new TextRun({ text: `${rango}  `, font: "Consolas", size: 22, bold: true, color: AZUL }),
      new TextRun({ text: titulo, font: "Calibri", size: 25, bold: true, color: "1A1A1A" }),
    ],
  });
}

/** Lo que se dice frente a la camara: en cursiva, sangrado. */
const decir = (texto) => new Paragraph({
  alignment: AlignmentType.JUSTIFIED,
  spacing: { after: 130, line: 276 },
  indent: { left: convertInchesToTwip(0.3) },
  border: { left: { style: BorderStyle.SINGLE, size: 6, color: "B7C4D1", space: 8 } },
  children: [new TextRun({ text: texto, font: "Calibri", size: 21, italics: true, color: "2A3F55" })],
});

const mostrar = (texto) => new Paragraph({
  spacing: { after: 110 },
  children: [
    new TextRun({ text: "En pantalla: ", font: "Calibri", size: 21, bold: true, color: GRIS }),
    new TextRun({ text: texto, font: "Calibri", size: 21 }),
  ],
});

function portada() {
  const linea = (t, s, b, esp, c = "000000") => new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: esp },
    children: [new TextRun({ text: t, font: "Calibri", size: s, bold: b, color: c })],
  });
  return [
    new Paragraph({ spacing: { after: 900 }, children: [] }),
    linea(DATOS.universidad.toUpperCase(), 32, true, 100, AZUL),
    linea(DATOS.facultad, 22, false, 60),
    linea(DATOS.curso, 22, false, 850),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 120 },
      border: { top: { style: BorderStyle.SINGLE, size: 12, color: AZUL, space: 10 } }, children: [],
    }),
    linea(DATOS.caso, 24, true, 140, "2E5F8A"),
    linea(DATOS.titulo, 36, true, 120),
    linea(DATOS.subtitulo, 24, false, 120, GRIS),
    linea("Duración objetivo: 9 minutos (límite 10)", 21, false, 120, GRIS),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 850 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: AZUL, space: 10 } }, children: [],
    }),
    linea("Preparado por", 20, false, 60, GRIS),
    linea(DATOS.autor, 26, true, 800),
    linea(`${DATOS.ciudad} — ${DATOS.fecha}`, 22, false, 0, GRIS),
    saltoPagina(),
  ];
}

const CONTENIDO = [
  ["1. Cómo usar este guion", 3],
  ["2. Preparación antes de grabar", 3],
  ["3. Estructura del video", 3],
  ["4. Bloque 1 — Presentación y tecnología elegida", 5],
  ["5. Bloque 2 — Diseño de la API", 5],
  ["6. Bloque 3 — Recorrido por el código", 7],
  ["7. Bloque 4 — El Dockerfile", 8],
  ["8. Bloque 5 — Construcción y ejecución local", 10],
  ["9. Bloque 6 — Despliegue en AWS y prueba en la nube", 12],
  ["10. Bloque 7 — Cierre", 12],
  ["11. Anexo A — Chuleta de comandos", 14],
  ["12. Anexo B — Problemas frecuentes", 14],
];

function tablaContenido() {
  return [
    h1("Contenido"),
    ...CONTENIDO.map(([texto, pagina]) => new Paragraph({
      spacing: { after: 60 },
      tabStops: [{ type: TabStopType.RIGHT, position: ANCHO_UTIL, leader: LeaderType.DOT }],
      children: [
        new TextRun({ text: texto, font: "Calibri", size: 22 }),
        new TextRun({ children: [new Tab(), String(pagina)], font: "Calibri", size: 22 }),
      ],
    })),
    saltoPagina(),
  ];
}

function cuerpo() {
  const c = [];

  // ---------------- 1. Como usar ----------------
  c.push(h1("1. Cómo usar este guion"));
  c.push(p(
    "El entregable de este caso es un video de máximo diez minutos, no un documento. " +
    "Este guion existe para que la grabación salga en una sola toma: cada bloque indica " +
    "qué mostrar en pantalla, qué decir y qué comando ejecutar."
  ));
  c.push(p(
    "El texto en cursiva y con barra lateral es lo que se dice. No hay que leerlo " +
    "palabra por palabra: sirve para no perder el hilo ni olvidar los puntos que el " +
    "enunciado exige. Los bloques de fondo gris son comandos exactos, listos para copiar."
  ));
  c.push(p(
    "La duración objetivo es de nueve minutos. Ese margen de un minuto sobre el límite " +
    "absorbe las pausas naturales y el tiempo que tarda una construcción de imagen o un " +
    "despliegue en responder."
  ));

  // ---------------- 2. Preparacion ----------------
  c.push(h1("2. Preparación antes de grabar"));
  c.push(p(
    "Lo más caro de este video es esperar. Un despliegue en Fargate tarda entre uno y " +
    "dos minutos en pasar la tarea a estado RUNNING, y una construcción de imagen desde " +
    "cero puede llevar otro tanto. La estrategia es dejar todo caliente antes de pulsar " +
    "grabar y, durante la toma, repetir las operaciones con la caché ya poblada."
  ));
  c.push(h2("Lista de verificación"));
  c.push(vinieta("Docker Desktop abierto y funcionando: 'docker info' responde sin error."));
  c.push(vinieta("'aws sts get-caller-identity' devuelve la cuenta correcta."));
  c.push(vinieta("Ejecutar el despliegue completo una vez ANTES de grabar. Así la imagen ya está en ECR, el clúster existe y durante el video la segunda ejecución es mucho más rápida."));
  c.push(vinieta("Dejar el servicio desplegado y anotar la IP pública: si algo falla en vivo, se tiene una URL que responde."));
  c.push(vinieta("Construir la imagen una vez para que las capas de 'npm ci' queden en caché."));
  c.push(vinieta("Cerrar pestañas y notificaciones. Subir el tamaño de letra de la terminal a 16 pt o más: el evaluador ve el video en una ventana pequeña."));
  c.push(vinieta("Tener abiertas y ordenadas: el editor con el proyecto, una terminal, el navegador en la consola de ECS y Postman."));
  c.push(vinieta("Probar el micrófono con una grabación de diez segundos antes de la toma real."));
  c.push(p(
    "Una recomendación sobre el orden de grabación: si el tiempo aprieta, grabe primero " +
    "el bloque de AWS, que es el que más puede demorarse, y después el resto. La mayoría " +
    "de editores permite unir los segmentos sin que se note.",
    { despues: 180 }
  ));

  // ---------------- 3. Estructura ----------------
  c.push(h1("3. Estructura del video"));
  c.push(p(
    "Los siete bloques cubren, en orden, los seis puntos que el enunciado pide explicar. " +
    "La columna de la derecha indica a qué requerimiento responde cada uno."
  ));
  c.push(tabla(
    ["Tiempo", "Bloque", "Punto del enunciado que cubre"],
    [
      ["0:00 – 0:45", "Presentación y tecnología elegida", "Descripción de la tecnología backend y razones de la elección"],
      ["0:45 – 2:15", "Diseño de la API", "Endpoints, métodos HTTP y formatos JSON de solicitud y respuesta"],
      ["2:15 – 3:15", "Recorrido por el código", "Implementación de la lógica"],
      ["3:15 – 4:45", "El Dockerfile", "Dockerfile utilizado para contenerizar"],
      ["4:45 – 6:30", "Construcción y ejecución local", "Cómo se construyó la imagen y se ejecutó el contenedor; pruebas con curl o Postman"],
      ["6:30 – 8:30", "Despliegue en AWS y prueba en la nube", "Funcionamiento en la nube"],
      ["8:30 – 9:00", "Cierre", "Conclusiones"],
    ],
    [0.17, 0.32, 0.51]
  ));
  c.push(pieTabla("Tabla 1. Bloques del video y requerimiento que atiende cada uno."));

  // ---------------- 4. Bloque 1 ----------------
  c.push(saltoPagina());
  c.push(h1("4. Bloque 1 — Presentación y tecnología elegida"));
  c.push(bloque("0:00 – 0:45", "Presentación y tecnología elegida"));
  c.push(mostrar("la cara o el editor con el proyecto abierto en el árbol de archivos."));
  c.push(decir(
    "«Buenas. Soy Juan Sebastián Martínez, del curso de Herramientas de Software II. " +
    "En este video presento una API RESTful para gestionar estudiantes, contenerizada " +
    "con Docker y desplegada en AWS Fargate.»"
  ));
  c.push(decir(
    "«Elegí Node.js con TypeScript y Express. Tres razones. Primero, Express resuelve " +
    "el enrutamiento REST con muy poco código, así que el video puede centrarse en los " +
    "contenedores, que es el objetivo del caso. Segundo, TypeScript da verificación de " +
    "tipos en tiempo de compilación, lo que evita una clase entera de errores en el " +
    "manejo de los datos de entrada. Y tercero, la imagen base de Node en Alpine pesa " +
    "poco, cosa que importa cuando se sube a un registro y se descarga en cada " +
    "despliegue.»"
  ));
  c.push(p(
    "Si el profesor valora la justificación, conviene mencionar también el descarte: " +
    "Spring Boot habría dado una imagen varias veces más grande y un arranque más lento, " +
    "lo cual penaliza en Fargate, donde se paga por tiempo de ejecución.",
    { cursiva: true, color: GRIS }
  ));

  // ---------------- 5. Bloque 2 ----------------
  c.push(h1("5. Bloque 2 — Diseño de la API"));
  c.push(bloque("0:45 – 2:15", "Endpoints, métodos y formatos JSON"));
  c.push(mostrar("la tabla de endpoints del README, o el archivo src/rutas/estudiantes.ts."));
  c.push(decir(
    "«La API expone tres operaciones, más una sonda de salud. El diseño sigue el modelo " +
    "de colección y recurso: /students es la colección y /students/{id} es un elemento " +
    "concreto. El verbo HTTP decide la operación, no la ruta.»"
  ));
  c.push(tabla(
    ["Método", "Ruta", "Qué hace", "Códigos"],
    [
      ["GET", "/health", "Sonda de salud del servicio", "200"],
      ["GET", "/students", "Lista todos los estudiantes", "200"],
      ["GET", "/students/{id}", "Obtiene un estudiante por su id", "200, 404"],
      ["POST", "/students", "Crea un estudiante", "201, 400, 409"],
    ],
    [0.12, 0.26, 0.42, 0.2]
  ));
  c.push(pieTabla("Tabla 2. Endpoints de la API."));
  c.push(decir(
    "«El formato es JSON en los dos sentidos. Para crear un estudiante se envían tres " +
    "campos: nombre, apellido y correo. El identificador no se envía: lo genera el " +
    "servidor como UUID, porque dejar que el cliente proponga el id abre la puerta a " +
    "colisiones y a que sobrescriba registros ajenos.»"
  ));
  c.push(...codigo([
    "POST /students",
    "Content-Type: application/json",
    "",
    "{",
    '  "nombre": "Laura",',
    '  "apellido": "Martinez",',
    '  "correo": "laura.martinez@lasalle.edu.co"',
    "}",
  ], "Solicitud"));
  c.push(...codigo([
    "201 Created",
    "Location: /students/9f1c8e2a-4d3b-47aa-9c21-6b0f5e7d8a10",
    "",
    "{",
    '  "id": "9f1c8e2a-4d3b-47aa-9c21-6b0f5e7d8a10",',
    '  "nombre": "Laura",',
    '  "apellido": "Martinez",',
    '  "correo": "laura.martinez@lasalle.edu.co",',
    '  "creadoEn": "2026-09-21T15:04:05.000Z"',
    "}",
  ], "Respuesta"));
  c.push(decir(
    "«Tres detalles de diseño. Devuelvo 201 y no 200, porque se creó un recurso nuevo. " +
    "Incluyo el encabezado Location apuntando al recurso recién creado, que es lo que " +
    "manda REST y le permite al cliente navegar sin construir la URL a mano. Y el listado " +
    "no devuelve un arreglo pelado sino un objeto con total y datos, para poder añadir " +
    "paginación más adelante sin romper a los clientes existentes.»"
  ));
  c.push(decir(
    "«En cuanto a errores: 400 cuando falta un campo o el correo no tiene formato válido, " +
    "con el detalle de qué campo falló; 404 cuando el identificador no existe; y 409 " +
    "cuando el correo ya está registrado, porque el correo identifica de forma natural a " +
    "un estudiante y no tiene sentido duplicarlo.»"
  ));

  // ---------------- 6. Bloque 3 ----------------
  c.push(saltoPagina());
  c.push(h1("6. Bloque 3 — Recorrido por el código"));
  c.push(bloque("2:15 – 3:15", "Implementación de la lógica"));
  c.push(mostrar("el editor, con src/dominio/estudiantes.ts y src/rutas/estudiantes.ts."));
  c.push(decir(
    "«El código está separado en tres capas. El dominio define el modelo, la validación " +
    "y el almacén. Las rutas traducen HTTP a llamadas al almacén. Y la aplicación monta " +
    "Express con el registro de solicitudes y el manejo de errores.»"
  ));
  c.push(decir(
    "«Uso almacenamiento en memoria, que es lo que permite el enunciado para simplificar. " +
    "Pero no lo dejé suelto: está detrás de una interfaz. Si mañana hay que pasar a " +
    "DynamoDB, se escribe otra implementación de esta interfaz y las rutas no cambian.»"
  ));
  c.push(...codigo(
    fragmento("src/dominio/estudiantes.ts", "export interface AlmacenEstudiantes", "}"),
    "src/dominio/estudiantes.ts — contrato del almacén"
  ));
  c.push(decir(
    "«Y aquí la creación. Valida, rechaza duplicados y responde 201 con el Location. " +
    "Es importante decirlo en el video: como los datos viven en memoria, si el contenedor " +
    "se reinicia la colección vuelve al estado inicial. Es una decisión consciente para " +
    "este ejercicio, no un descuido.»"
  ));
  c.push(...codigo(
    fragmento("src/rutas/estudiantes.ts", "  router.post(\"/\"", "    res.status(201)"),
    "src/rutas/estudiantes.ts — creación de un estudiante"
  ));

  // ---------------- 7. Bloque 4 ----------------
  c.push(h1("7. Bloque 4 — El Dockerfile"));
  c.push(bloque("3:15 – 4:45", "Contenerización"));
  c.push(mostrar("el archivo Dockerfile abierto en el editor."));
  c.push(decir(
    "«Este es el Dockerfile. Es multietapa, y esa es la decisión principal. La primera " +
    "etapa instala todas las dependencias, incluidas las de desarrollo, y compila " +
    "TypeScript a JavaScript. La segunda parte de una imagen limpia y copia solo lo que " +
    "hace falta para ejecutar: las dependencias de producción y el código ya compilado.»"
  ));
  c.push(decir(
    "«El resultado es que la imagen final no lleva el compilador de TypeScript, ni " +
    "ts-node, ni el código fuente. Pesa menos y expone menos superficie de ataque.»"
  ));
  c.push(...codigo(
    fragmento("Dockerfile", "FROM node:20-alpine AS compilacion", "RUN npm run compilar"),
    "Dockerfile — etapa de compilación"
  ));
  c.push(decir(
    "«Un detalle de eficiencia: copio primero package.json y ejecuto npm ci, y solo " +
    "después copio el código. Docker cachea cada instrucción, así que mientras no cambien " +
    "las dependencias esa capa se reutiliza y la reconstrucción tarda segundos en vez de " +
    "minutos. Si copiara todo de golpe, cualquier cambio en una línea de código " +
    "invalidaría la instalación completa.»"
  ));
  c.push(...codigo(
    fragmento("Dockerfile", "FROM node:20-alpine AS ejecucion", "CMD [\"node\", \"dist/servidor.js\"]"),
    "Dockerfile — etapa de ejecución"
  ));
  c.push(decir(
    "«En la etapa final hay tres decisiones de producción. Instalo tini como proceso " +
    "init: sin él, la señal SIGTERM que envía ECS al detener la tarea no llega a Node y " +
    "el contenedor muere de forma abrupta. Ejecuto como el usuario node, sin privilegios, " +
    "en lugar de root. Y declaro un HEALTHCHECK que consulta la ruta /health, de modo que " +
    "Docker sabe si el proceso está vivo y no solo si arrancó.»"
  ));
  c.push(p(
    "Si el tiempo va justo, este es el bloque donde recortar: basta con mencionar las dos " +
    "etapas y el usuario sin privilegios, y saltarse la explicación de la caché de capas.",
    { cursiva: true, color: GRIS }
  ));

  // ---------------- 8. Bloque 5 ----------------
  c.push(saltoPagina());
  c.push(h1("8. Bloque 5 — Construcción y ejecución local"));
  c.push(bloque("4:45 – 6:30", "Build, run y pruebas con curl y Postman"));
  c.push(mostrar("la terminal, a pantalla completa y con letra grande."));
  c.push(decir("«Construyo la imagen. Un punto al final indica que el contexto de construcción es el directorio actual.»"));
  c.push(...codigo([
    "docker build -t api-estudiantes:1.0 .",
  ], "Construcción de la imagen"));
  c.push(decir(
    "«Con la caché poblada esto tarda pocos segundos. Mientras corre, se puede comentar " +
    "que Docker va ejecutando cada instrucción del Dockerfile y guardando una capa.»"
  ));
  c.push(...codigo([
    "docker images api-estudiantes",
    "docker run -d --name api-estudiantes -p 3000:3000 api-estudiantes:1.0",
    "docker ps",
  ], "Verificación y arranque del contenedor"));
  c.push(decir(
    "«La opción -d lo deja en segundo plano y -p 3000:3000 publica el puerto del " +
    "contenedor en mi máquina. En docker ps se ve el contenedor en ejecución y, al cabo " +
    "de unos segundos, el estado healthy, que viene del HEALTHCHECK del Dockerfile.»"
  ));
  c.push(decir("«Ahora las pruebas. Primero la sonda de salud y el listado inicial.»"));
  c.push(...codigo([
    "curl -s http://localhost:3000/health | jq",
    "",
    "curl -s http://localhost:3000/students | jq",
  ], "Pruebas con curl — lectura"));
  c.push(decir("«Creo un estudiante con POST y me quedo con el identificador que devuelve.»"));
  c.push(...codigo([
    "curl -s -X POST http://localhost:3000/students \\",
    "  -H 'Content-Type: application/json' \\",
    `  -d '{"nombre":"Laura","apellido":"Martinez","correo":"laura.martinez@lasalle.edu.co"}' | jq`,
  ], "Pruebas con curl — creación"));
  c.push(decir(
    "«Copio ese id y lo consulto. Aquí conviene mostrar también un caso de error, porque " +
    "demuestra que la validación existe de verdad: envío un correo con formato inválido y " +
    "la API responde 400 diciendo exactamente qué campo falló.»"
  ));
  c.push(...codigo([
    "curl -s http://localhost:3000/students/<ID-COPIADO> | jq",
    "",
    "curl -s -i -X POST http://localhost:3000/students \\",
    "  -H 'Content-Type: application/json' \\",
    `  -d '{"nombre":"Sin","correo":"esto-no-es-un-correo"}'`,
  ], "Pruebas con curl — lectura por id y validación"));
  c.push(decir(
    "«Para no hacer esto a mano uno por uno, el proyecto trae una suite que ejecuta ocho " +
    "casos contra la URL que se le indique. La misma suite servirá después contra la nube.»"
  ));
  c.push(...codigo([
    "npm run probar -- http://localhost:3000",
  ], "Suite de pruebas funcionales"));
  c.push(decir(
    "«Ocho de ocho. Y para cerrar el bloque, los registros del contenedor: cada solicitud " +
    "queda anotada en JSON con el método, la ruta, el código de estado y la latencia.»"
  ));
  c.push(...codigo([
    "docker logs --tail 15 api-estudiantes",
  ], "Registros del contenedor"));
  c.push(p(
    "Si prefiere mostrar Postman en vez de curl para la parte de creación, tenga la " +
    "petición ya guardada y con el cuerpo escrito antes de grabar. Teclear JSON en vivo " +
    "consume medio minuto y se presta a erratas.",
    { cursiva: true, color: GRIS }
  ));

  // ---------------- 9. Bloque 6 ----------------
  c.push(saltoPagina());
  c.push(h1("9. Bloque 6 — Despliegue en AWS y prueba en la nube"));
  c.push(bloque("6:30 – 8:30", "ECR, Fargate y prueba del servicio público"));
  c.push(decir(
    "«Para llevarlo a la nube uso dos servicios. Amazon ECR es el registro privado donde " +
    "se guarda la imagen, y AWS Fargate la ejecuta sin que yo administre ningún servidor: " +
    "declaro cuánta CPU y memoria necesita el contenedor y AWS se encarga del resto.»"
  ));
  c.push(mostrar("la terminal con el script de despliegue."));
  c.push(...codigo([
    "bash infra/desplegar-aws.sh",
  ], "Despliegue completo"));
  c.push(decir(
    "«El script hace ocho cosas: crea el repositorio en ECR, inicia sesión en el " +
    "registro, construye y sube la imagen, crea el grupo de registros en CloudWatch, " +
    "prepara el rol de ejecución, crea el clúster, registra la definición de tarea y " +
    "levanta el servicio en Fargate. Al final imprime la IP pública.»"
  ));
  c.push(decir(
    "«Un detalle importante si trabajan en un Mac con chip Apple: la construcción lleva " +
    "--platform linux/amd64. Fargate ejecuta arquitectura x86, y una imagen compilada " +
    "para ARM arranca y muere en bucle con el error exec format error. Es un fallo que " +
    "cuesta bastante diagnosticar porque el contenedor funciona perfecto en local.»"
  ));
  c.push(p(
    "Mientras el script avanza hay unos segundos muertos esperando a que la tarea pase a " +
    "RUNNING. Aproveche para explicar la definición de tarea: 256 unidades de CPU, 512 MB " +
    "de memoria, modo de red awsvpc y el controlador de logs awslogs.",
    { cursiva: true, color: GRIS }
  ));
  c.push(mostrar("la consola de AWS: ECS → cluster-estudiantes → pestaña Tareas, con la tarea en RUNNING."));
  c.push(decir(
    "«En la consola se ve el clúster con el servicio y una tarea en ejecución. Si entro a " +
    "la tarea aparece la configuración de red con la IP pública asignada.»"
  ));
  c.push(decir("«Y ahora la prueba que importa: la misma suite de antes, pero contra la nube.»"));
  c.push(...codigo([
    "curl -s http://<IP-PUBLICA>:3000/health | jq",
    "",
    "npm run probar -- http://<IP-PUBLICA>:3000",
  ], "Prueba de la API desplegada"));
  c.push(decir(
    "«Ocho de ocho otra vez, contra una IP pública de AWS. Es el mismo contenedor que " +
    "corría en mi máquina: esa es exactamente la portabilidad que buscábamos al " +
    "contenerizar.»"
  ));
  c.push(mostrar("CloudWatch → Grupos de registros → /ecs/api-estudiantes, o la terminal con el comando de abajo."));
  c.push(...codigo([
    "aws logs tail /ecs/api-estudiantes --follow --region us-east-1",
  ], "Registros de la aplicación en la nube"));
  c.push(decir(
    "«Y los registros del contenedor llegan a CloudWatch: aquí están las solicitudes que " +
    "acabo de hacer, con su código de estado y su latencia.»"
  ));

  // ---------------- 10. Bloque 7 ----------------
  c.push(h1("10. Bloque 7 — Cierre"));
  c.push(bloque("8:30 – 9:00", "Conclusiones"));
  c.push(decir(
    "«Para cerrar. Construí una API REST con tres operaciones sobre estudiantes, la " +
    "empaqueté en una imagen de Docker multietapa que corre como usuario sin privilegios, " +
    "la probé en local y la desplegué en AWS Fargate con la imagen alojada en ECR.»"
  ));
  c.push(decir(
    "«Lo que más valoro del contenedor es que el artefacto que probé en mi máquina es " +
    "bit a bit el mismo que corre en AWS. No hubo que instalar Node en ningún servidor ni " +
    "ajustar versiones: la imagen lleva su entorno dentro.»"
  ));
  c.push(decir(
    "«Dos limitaciones que reconozco. Los datos están en memoria, así que no sobreviven a " +
    "un reinicio de la tarea; el siguiente paso natural sería DynamoDB. Y la tarea expone " +
    "una IP pública que cambia cada vez que ECS la reemplaza: para producción habría que " +
    "poner delante un balanceador de carga con un nombre de dominio estable. Gracias.»"
  ));

  // ---------------- 11. Anexo A ----------------
  c.push(saltoPagina());
  c.push(h1("11. Anexo A — Chuleta de comandos"));
  c.push(p("Para tener en una segunda pantalla o impresa durante la grabación."));
  c.push(...codigo([
    "# --- Antes de grabar -----------------------------------------------",
    "docker info",
    "aws sts get-caller-identity",
    "bash infra/desplegar-aws.sh      # ejecutar una vez para calentar",
    "",
    "# --- Local ---------------------------------------------------------",
    "docker build -t api-estudiantes:1.0 .",
    "docker images api-estudiantes",
    "docker run -d --name api-estudiantes -p 3000:3000 api-estudiantes:1.0",
    "docker ps",
    "curl -s http://localhost:3000/health | jq",
    "curl -s http://localhost:3000/students | jq",
    "npm run probar -- http://localhost:3000",
    "docker logs --tail 15 api-estudiantes",
    "docker rm -f api-estudiantes",
    "",
    "# --- Nube ----------------------------------------------------------",
    "bash infra/desplegar-aws.sh",
    "curl -s http://<IP-PUBLICA>:3000/health | jq",
    "npm run probar -- http://<IP-PUBLICA>:3000",
    "aws logs tail /ecs/api-estudiantes --follow --region us-east-1",
    "",
    "# --- Limpieza al terminar ------------------------------------------",
    "bash infra/apagar-todo.sh",
  ]));

  // ---------------- 12. Anexo B ----------------
  c.push(h1("12. Anexo B — Problemas frecuentes"));
  c.push(tabla(
    ["Síntoma", "Causa", "Solución"],
    [
      ["La tarea arranca y se detiene en bucle; en los logs aparece exec format error", "La imagen se construyó para arm64 en un Mac con Apple Silicon y Fargate ejecuta x86_64", "Reconstruir con --platform linux/amd64 y volver a subir"],
      ["denied: requested access to the resource is denied al hacer push", "La sesión en ECR expiró o no se inició", "Repetir el aws ecr get-login-password que hace el script"],
      ["La tarea queda en PENDING y nunca pasa a RUNNING", "El rol de ejecución no existe o no tiene la política de ECS", "Verificar ecsTaskExecutionRole y su política AmazonECSTaskExecutionRolePolicy"],
      ["curl se queda colgado contra la IP pública", "El grupo de seguridad no permite la entrada al puerto 3000", "Revisar la regla de entrada tcp/3000 en sg-api-estudiantes"],
      ["La IP pública dejó de responder sin tocar nada", "ECS reemplazó la tarea y la IP cambió", "Volver a consultarla; para una dirección estable hace falta un balanceador"],
      ["CannotPullContainerError en el evento del servicio", "La etiqueta de la imagen no coincide con la que se subió a ECR", "Comprobar que la definición de tarea apunta a la etiqueta correcta"],
    ],
    [0.34, 0.3, 0.36]
  ));
  c.push(pieTabla("Tabla 3. Fallos habituales durante el despliegue y cómo resolverlos."));
  c.push(p(
    "Si algo falla en plena grabación, no reinicie la toma: explique en voz alta qué " +
    "muestra el error y cómo se corrige. Un profesor valora más ver a alguien " +
    "diagnosticar un fallo real que una demostración sin tropiezos.",
    { cursiva: true, color: GRIS }
  ));

  return c;
}

function construir() {
  return new Document({
    creator: DATOS.autor,
    title: `${DATOS.titulo} — ${DATOS.caso}`,
    numbering: {
      config: [{
        reference: "vinietas",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: convertInchesToTwip(0.35), hanging: convertInchesToTwip(0.2) } } },
        }],
      }],
    },
    sections: [{
      properties: {
        page: {
          size: { width: ANCHO_PAGINA, height: ALTO_PAGINA },
          margin: { top: MARGEN, bottom: MARGEN, left: MARGEN, right: MARGEN },
        },
        titlePage: true,
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT, spacing: { after: 120 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC", space: 6 } },
            children: [new TextRun({ text: "Guion del video — API de estudiantes en Docker y AWS Fargate", font: "Calibri", size: 17, color: "777777" })],
          })],
        }),
        first: new Header({ children: [new Paragraph({ children: [] })] }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT], font: "Calibri", size: 18, color: "777777" })],
          })],
        }),
        first: new Footer({ children: [new Paragraph({ children: [] })] }),
      },
      children: [...portada(), ...tablaContenido(), ...cuerpo()],
    }],
  });
}

async function main() {
  fs.mkdirSync(SALIDA, { recursive: true });
  const buffer = await Packer.toBuffer(construir());
  const destino = path.join(SALIDA, "Guion-Video-API-Estudiantes-Docker-AWS.docx");
  fs.writeFileSync(destino, buffer);
  console.log(`Guion generado: ${destino}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
