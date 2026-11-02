/**
 * generar-informe.js
 * Informe de evidencias del taller de despliegues automaticos.
 *
 * Fase 1: sin informe/capturas/figuraN.png dibuja el recuadro punteado.
 * Fase 2: si el archivo existe, inserta la imagen escalada.
 *
 * Uso: node informe/generar-informe.js
 */
const fs = require("node:fs");
const path = require("node:path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle,
  ShadingType, Table, TableRow, TableCell, WidthType, VerticalAlign, ImageRun,
  PageBreak, Footer, Header, PageNumber, Tab, TabStopType, LeaderType,
  LevelFormat, convertInchesToTwip,
} = require("docx");
const medirImagen = require("image-size").imageSize || require("image-size");

const RAIZ = path.resolve(__dirname, "..");
const CAPTURAS = path.join(__dirname, "capturas");
const SALIDA = path.join(__dirname, "salida");

const DATOS = {
  universidad: "Universidad de La Salle",
  facultad: "Facultad de Ingeniería — Programa de Ingeniería de Software",
  curso: "Herramientas de Software II",
  caso: "Taller de despliegues automáticos",
  titulo: "Pipeline de CI/CD con AWS CodePipeline, CodeBuild y Amazon ECS",
  subtitulo: "Informe de arquitectura y evidencias de configuración",
  autor: "Juan Sebastián Martínez",
  ciudad: "Bogotá D.C.",
  fecha: "Septiembre de 2026",
  region: "us-east-1",
  idCuenta: "ID_CUENTA",
  pipeline: "pipeline-api-estudiantes",
  proyectoBuild: "construccion-api-estudiantes",
  cluster: "cluster-estudiantes",
  servicio: "servicio-api-estudiantes",
  repoGitHub: "USUARIO_GITHUB/api-estudiantes",
};

const ANCHO_PAGINA = 12240, ALTO_PAGINA = 15840;
const MARGEN = convertInchesToTwip(1);
const ANCHO_UTIL = ANCHO_PAGINA - MARGEN * 2;
const ANCHO_UTIL_PX = 624;
const AZUL = "1B4F72", GRIS = "444444", GRIS_CODIGO = "F2F2F2";

let contadorFiguras = 0;
const figurasPendientes = [];

const p = (texto, o = {}) => new Paragraph({
  alignment: o.alineacion ?? AlignmentType.JUSTIFIED,
  spacing: { after: o.despues ?? 140, line: 276 },
  children: [new TextRun({
    text: texto, font: "Calibri", size: o.tamano ?? 22,
    bold: o.negrita ?? false, italics: o.cursiva ?? false, color: o.color ?? "000000",
  })],
});

const h1 = (t) => new Paragraph({
  heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 180 },
  children: [new TextRun({ text: t, font: "Calibri", size: 30, bold: true, color: AZUL })],
});

const h2 = (t) => new Paragraph({
  heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 140 },
  children: [new TextRun({ text: t, font: "Calibri", size: 25, bold: true, color: "2E5F8A" })],
});

const vinieta = (t) => new Paragraph({
  numbering: { reference: "vinietas", level: 0 },
  spacing: { after: 90, line: 276 }, alignment: AlignmentType.JUSTIFIED,
  children: [new TextRun({ text: t, font: "Calibri", size: 22 })],
});

const saltoPagina = () => new Paragraph({ children: [new PageBreak()] });

const ANCHO_CODIGO = 88;
function ajustar(lineas) {
  const salida = [];
  for (const linea of lineas) {
    if (linea.length <= ANCHO_CODIGO) { salida.push(linea); continue; }
    let resto = linea, primera = true;
    const sangria = (linea.match(/^\s*/) || [""])[0] + "  ";
    while (resto.length > ANCHO_CODIGO) {
      const limite = primera ? ANCHO_CODIGO : ANCHO_CODIGO - sangria.length;
      let corte = resto.lastIndexOf(" ", limite);
      if (corte < limite * 0.5) corte = resto.lastIndexOf(",", limite) + 1;
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
      spacing: { before: 120, after: 60 },
      children: [new TextRun({ text: subtitulo, font: "Calibri", size: 19, bold: true, color: GRIS })],
    }));
  }
  lineas.forEach((l, i) => {
    bloque.push(new Paragraph({
      spacing: { before: i === 0 ? 40 : 0, after: i === lineas.length - 1 ? 160 : 0 },
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

function archivoCompleto(rutaRelativa) {
  return fs.readFileSync(path.join(RAIZ, rutaRelativa), "utf8")
    .replace(/ID_CUENTA/g, DATOS.idCuenta)
    .replace(/REGION/g, DATOS.region)
    .trimEnd().split("\n");
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
  alignment: AlignmentType.CENTER, spacing: { before: 80, after: 200 },
  children: [new TextRun({ text: t, font: "Calibri", size: 18, italics: true, color: GRIS })],
});

function imagen(ruta, anchoMax = ANCHO_UTIL_PX) {
  const buffer = fs.readFileSync(ruta);
  const d = medirImagen(buffer);
  const escala = Math.min(1, anchoMax / d.width);
  const tipo = path.extname(ruta).slice(1).toLowerCase();
  return new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 120, after: 80 },
    children: [new ImageRun({
      data: buffer, type: tipo === "jpg" ? "jpg" : tipo,
      transformation: { width: Math.round(d.width * escala), height: Math.round(d.height * escala) },
    })],
  });
}

const leyenda = (n, t) => new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { before: 40, after: 240 },
  children: [new TextRun({ text: `Figura ${n}. ${t}`, font: "Calibri", size: 19, bold: true, color: GRIS })],
});

function captura(titulo, descripcion, alturaCm = 8) {
  contadorFiguras += 1;
  const numero = contadorFiguras;
  figurasPendientes.push({ numero, titulo, descripcion });

  const candidatos = [".png", ".jpg", ".jpeg"]
    .map((e) => path.join(CAPTURAS, `figura${numero}${e}`))
    .filter((r) => fs.existsSync(r));
  if (candidatos.length > 0) return [imagen(candidatos[0]), leyenda(numero, titulo)];

  const borde = { style: BorderStyle.DASHED, size: 8, color: "8A8A8A" };
  const marcador = new Table({
    width: { size: ANCHO_UTIL, type: WidthType.DXA }, columnWidths: [ANCHO_UTIL],
    rows: [new TableRow({
      height: { value: Math.round(alturaCm * 567), rule: "atLeast" },
      children: [new TableCell({
        width: { size: ANCHO_UTIL, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: ShadingType.CLEAR, fill: "FBFBFB", color: "auto" },
        borders: { top: borde, bottom: borde, left: borde, right: borde },
        margins: { top: 200, bottom: 200, left: 300, right: 300 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER, spacing: { after: 160 },
            children: [new TextRun({ text: "PEGUE AQUÍ LA CAPTURA DE PANTALLA", font: "Calibri", size: 24, bold: true, color: "7A7A7A" })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER, spacing: { after: 80 },
            children: [new TextRun({ text: `Figura ${numero} — ${titulo}`, font: "Calibri", size: 21, bold: true, color: "5A5A5A" })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER, spacing: { after: 0 },
            children: [new TextRun({ text: `La captura debe mostrar: ${descripcion}`, font: "Calibri", size: 19, italics: true, color: "6A6A6A" })],
          }),
        ],
      })],
    })],
  });
  return [marcador, new Paragraph({ spacing: { after: 240 }, children: [] })];
}

function portada() {
  const linea = (t, s, b, esp, c = "000000") => new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: esp },
    children: [new TextRun({ text: t, font: "Calibri", size: s, bold: b, color: c })],
  });
  return [
    new Paragraph({ spacing: { after: 900 }, children: [] }),
    linea(DATOS.universidad.toUpperCase(), 32, true, 100, AZUL),
    linea(DATOS.facultad, 22, false, 60),
    linea(DATOS.curso, 22, false, 900),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 120 },
      border: { top: { style: BorderStyle.SINGLE, size: 12, color: AZUL, space: 10 } }, children: [],
    }),
    linea(DATOS.caso, 26, true, 120, "2E5F8A"),
    linea(DATOS.titulo, 34, true, 150),
    linea(DATOS.subtitulo, 23, false, 120, GRIS),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 900 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: AZUL, space: 10 } }, children: [],
    }),
    linea("Presentado por", 20, false, 60, GRIS),
    linea(DATOS.autor, 26, true, 800),
    linea(`${DATOS.ciudad} — ${DATOS.fecha}`, 22, false, 0, GRIS),
    saltoPagina(),
  ];
}

const CONTENIDO = [
  ["1. Introducción y objetivo", 3],
  ["2. Arquitectura del pipeline", 3],
  ["2.1 Diagrama general", 4],
  ["2.2 Servicios de AWS utilizados", 4],
  ["2.3 Por qué estas etapas y no otras", 5],
  ["3. Repositorio de código fuente", 6],
  ["3.1 Estructura del repositorio", 6],
  ["3.2 Conexión entre AWS y GitHub", 6],
  ["4. Etapa de Fuente", 8],
  ["5. Etapa de Construcción", 8],
  ["5.1 El archivo buildspec.yml", 8],
  ["5.2 Configuración del proyecto de CodeBuild", 10],
  ["5.3 El artefacto imagedefinitions.json", 11],
  ["6. Etapa de Despliegue", 13],
  ["7. Permisos y seguridad del pipeline", 14],
  ["8. Prueba del despliegue automático", 17],
  ["8.1 Cambio en el código y push", 17],
  ["8.2 Ejecución del pipeline", 17],
  ["8.3 Verificación del cambio en producción", 18],
  ["9. Conclusiones", 20],
  ["10. Limpieza de los recursos", 20],
  ["11. Referencias", 21],
];

function tablaContenido() {
  return [
    h1("Tabla de contenido"),
    p("Los números de página están escritos de forma fija y corresponden al documento final; no hay ningún campo que actualizar.",
      { cursiva: true, color: GRIS, despues: 180 }),
    ...CONTENIDO.map(([texto, pagina]) => {
      const esSeccion = /^\d+\./.test(texto) && !/^\d+\.\d/.test(texto);
      return new Paragraph({
        spacing: { after: 36 },
        indent: esSeccion ? undefined : { left: convertInchesToTwip(0.3) },
        tabStops: [{ type: TabStopType.RIGHT, position: ANCHO_UTIL, leader: LeaderType.DOT }],
        children: [
          new TextRun({ text: texto, font: "Calibri", size: esSeccion ? 22 : 21, bold: esSeccion }),
          new TextRun({ children: [new Tab(), String(pagina)], font: "Calibri", size: esSeccion ? 22 : 21, bold: esSeccion }),
        ],
      });
    }),
    saltoPagina(),
  ];
}

function cuerpo() {
  const c = [];

  // ---------------- 1 ----------------
  c.push(h1("1. Introducción y objetivo"));
  c.push(p(
    "En la actividad anterior la API de gestión de estudiantes se desplegó en AWS " +
    "Fargate de forma manual: construir la imagen, publicarla en ECR y actualizar el " +
    "servicio eran tres pasos que alguien tenía que ejecutar desde su máquina. Ese " +
    "procedimiento funciona una vez, pero se degrada rápido. Depende de que quien " +
    "despliega tenga el entorno correcto, no deja rastro de qué versión del código " +
    "produjo qué imagen, y cualquier olvido —no reconstruir, no reetiquetar, publicar " +
    "desde una rama equivocada— llega a producción sin que nadie lo note."
  ));
  c.push(p(
    "Este taller sustituye ese procedimiento por un pipeline de integración y entrega " +
    "continua. El objetivo concreto: que un push a la rama principal del repositorio " +
    "produzca, sin intervención humana, una imagen nueva en ECR y un servicio de ECS " +
    "actualizado con esa imagen."
  ));
  c.push(h2("Objetivos específicos"));
  c.push(vinieta("Diseñar un pipeline de tres etapas: Fuente, Construcción y Despliegue."));
  c.push(vinieta("Conectar AWS con un repositorio de GitHub mediante AWS CodeConnections."));
  c.push(vinieta("Configurar un proyecto de CodeBuild que verifique el código, construya la imagen de Docker y la publique en Amazon ECR."));
  c.push(vinieta("Desplegar la imagen resultante en el servicio de ECS existente mediante una actualización progresiva."));
  c.push(vinieta("Aplicar el principio de menor privilegio a los roles de servicio del pipeline."));
  c.push(vinieta("Demostrar el disparo automático con un cambio real en el código."));

  // ---------------- 2 ----------------
  c.push(h1("2. Arquitectura del pipeline"));
  c.push(p(
    "El pipeline sigue el patrón más extendido para aplicaciones en contenedores: el " +
    "código vive en un repositorio externo, un servicio de compilación produce un " +
    "artefacto inmutable —la imagen— y un servicio de despliegue reemplaza lo que está " +
    "corriendo por ese artefacto. CodePipeline no hace el trabajo: lo orquesta, pasando " +
    "artefactos de una etapa a la siguiente."
  ));

  c.push(h2("2.1 Diagrama general"));
  c.push(imagen(path.join(__dirname, "arquitectura-pipeline.png")));
  contadorFiguras += 1;
  c.push(leyenda(contadorFiguras, "Arquitectura del pipeline: un push a main desencadena las tres etapas hasta el servicio de ECS."));

  c.push(h2("2.2 Servicios de AWS utilizados"));
  c.push(tabla(
    ["Servicio", "Papel en la solución"],
    [
      ["AWS CodePipeline", "Orquesta las tres etapas, guarda el estado de cada ejecución y transfiere los artefactos entre ellas."],
      ["AWS CodeConnections", "Mantiene la autorización OAuth con GitHub y entrega el código a la etapa de Fuente sin almacenar credenciales en el pipeline."],
      ["AWS CodeBuild", "Entorno efímero donde se verifican los tipos, se construye la imagen de Docker y se publica en ECR."],
      ["Amazon ECR", "Registro privado de imágenes. Cada imagen se etiqueta con el identificador del commit que la produjo."],
      ["Amazon ECS sobre AWS Fargate", "Ejecuta el contenedor. Recibe la nueva revisión de la definición de tarea y hace la actualización progresiva."],
      ["Amazon S3", "Bucket versionado donde CodePipeline deposita los artefactos que viajan entre etapas."],
      ["AWS IAM", "Roles de servicio de CodeBuild y CodePipeline, con permisos acotados a los recursos de este proyecto."],
      ["Amazon CloudWatch Logs", "Registros de la compilación y de la aplicación en ejecución."],
    ],
    [0.3, 0.7]
  ));
  c.push(pieTabla("Tabla 1. Servicios de AWS que intervienen en el pipeline."));

  c.push(h2("2.3 Por qué estas etapas y no otras"));
  c.push(p(
    "El enunciado exige como mínimo Fuente y Despliegue, y deja la Construcción como " +
    "opcional. Aquí es obligatoria por una razón concreta: la aplicación se despliega " +
    "como contenedor, y alguien tiene que construir la imagen. Sin etapa de " +
    "construcción habría que subirla a mano antes de cada ejecución, que es exactamente " +
    "el trabajo manual que el pipeline viene a eliminar."
  ));
  c.push(p(
    "Sobre el destino del despliegue, el enunciado propone Elastic Beanstalk, S3 con " +
    "CloudFront, o CloudFormation. Se eligió ECS porque la aplicación ya estaba " +
    "contenerizada y desplegada ahí en la actividad anterior: el pipeline se monta sobre " +
    "infraestructura existente en lugar de duplicarla. Elastic Beanstalk habría " +
    "implicado reempaquetar la aplicación en otro formato, y S3 con CloudFront sirve " +
    "para sitios estáticos, no para una API con lógica de servidor."
  ));
  c.push(tabla(
    ["Etapa", "Proveedor de la acción", "Entrada", "Salida"],
    [
      ["Fuente", "CodeStarSourceConnection", "Commit en la rama main", "Artefacto CodigoFuente"],
      ["Construcción", "CodeBuild", "Artefacto CodigoFuente", "Artefacto DefinicionImagen"],
      ["Despliegue", "Amazon ECS", "Artefacto DefinicionImagen", "Servicio actualizado"],
    ],
    [0.17, 0.33, 0.25, 0.25]
  ));
  c.push(pieTabla("Tabla 2. Etapas del pipeline, su proveedor y los artefactos que consumen y producen."));

  // ---------------- 3 ----------------
  c.push(saltoPagina());
  c.push(h1("3. Repositorio de código fuente"));
  c.push(p(
    "El repositorio está alojado en GitHub. Conviene explicar por qué no se usó AWS " +
    "CodeCommit, que sería la opción nativa: desde julio de 2024 AWS dejó de admitir " +
    "repositorios nuevos de CodeCommit en cuentas que no lo tuvieran ya en uso. En una " +
    "cuenta creada después de esa fecha el servicio no aparece disponible, de modo que " +
    "GitHub a través de CodeConnections es la alternativa natural."
  ));

  c.push(h2("3.1 Estructura del repositorio"));
  c.push(p(
    "El repositorio contiene la aplicación completa de la actividad anterior más el " +
    "archivo buildspec.yml, que es lo único que hubo que añadir para que el pipeline " +
    "funcione. Ese detalle merece subrayarse: contenerizar bien la aplicación en su " +
    "momento hizo que automatizar el despliegue costara un solo archivo."
  ));
  c.push(...codigo([
    "api-estudiantes/",
    "├── src/                     codigo de la API en TypeScript",
    "├── Dockerfile               imagen multietapa",
    "├── buildspec.yml            instrucciones para CodeBuild  <-- añadido",
    "├── package.json",
    "├── infra/",
    "│   ├── desplegar-aws.sh     despliegue manual (actividad anterior)",
    "│   ├── crear-pipeline.sh    crea el pipeline completo",
    "│   └── borrar-pipeline.sh   desmonta el pipeline",
    "└── README.md",
  ]));
  c.push(...captura(
    "Repositorio en GitHub",
    "la página principal del repositorio en GitHub, con la lista de archivos donde se distingan Dockerfile y buildspec.yml, y la rama main seleccionada.",
    7.5
  ));

  c.push(h2("3.2 Conexión entre AWS y GitHub"));
  c.push(p(
    "La conexión es el mecanismo por el que CodePipeline obtiene el código. AWS crea " +
    "una aplicación de GitHub llamada AWS Connector for GitHub y el usuario la autoriza " +
    "sobre los repositorios que elija. La ventaja frente al método antiguo, que consistía " +
    "en guardar un token personal en el pipeline, es que no hay ningún secreto " +
    "almacenado en la configuración y el acceso puede revocarse desde GitHub."
  ));
  c.push(p(
    "Este paso no puede automatizarse por completo. El script crea la conexión, pero " +
    "queda en estado PENDING hasta que alguien completa la autorización OAuth en la " +
    "consola; solo entonces pasa a AVAILABLE. El script se detiene e indica qué hacer."
  ));
  c.push(...codigo(
    fragmento("infra/crear-pipeline.sh", "ARN_CONEXION=\"$(aws codeconnections list-connections", "ok \"Conexion en estado AVAILABLE\"", 0),
    "infra/crear-pipeline.sh — creación y verificación de la conexión"
  ));
  c.push(...captura(
    "Conexión con GitHub en estado Disponible",
    "la consola de AWS en Developer Tools → Settings → Connections, con la conexión conexion-github en estado Disponible (Available) y el proveedor GitHub.",
    6.5
  ));

  // ---------------- 4 ----------------
  c.push(saltoPagina());
  c.push(h1("4. Etapa de Fuente"));
  c.push(p(
    "La primera etapa descarga el contenido del repositorio en el commit que disparó la " +
    "ejecución y lo deposita como artefacto en el bucket de S3. El parámetro decisivo es " +
    "DetectChanges: con el valor true, CodeConnections registra un webhook en GitHub y " +
    "cada push a la rama configurada lanza el pipeline. Sin él habría que iniciarlo a " +
    "mano, lo que anularía el propósito del taller."
  ));
  c.push(tabla(
    ["Parámetro", "Valor"],
    [
      ["Proveedor de la acción", "CodeStarSourceConnection (GitHub)"],
      ["Repositorio", DATOS.repoGitHub],
      ["Rama", "main"],
      ["Detección de cambios", "true (webhook automático)"],
      ["Artefacto de salida", "CodigoFuente"],
    ],
    [0.35, 0.65]
  ));
  c.push(pieTabla("Tabla 3. Configuración de la etapa de Fuente."));
  c.push(...captura(
    "Configuración de la etapa de Fuente",
    "el detalle de la acción de origen en la consola de CodePipeline, donde se lean el proveedor de origen, el nombre del repositorio, la rama main y la opción de detección de cambios activada.",
    8
  ));

  // ---------------- 5 ----------------
  c.push(h1("5. Etapa de Construcción"));
  c.push(h2("5.1 El archivo buildspec.yml"));
  c.push(p(
    "CodeBuild levanta un contenedor efímero, clona en él el artefacto de la etapa " +
    "anterior y ejecuta las instrucciones del buildspec. El archivo organiza el trabajo " +
    "en tres fases."
  ));
  c.push(...codigo(archivoCompleto("buildspec.yml"), "buildspec.yml"));
  c.push(p(
    "Dos decisiones del archivo merecen explicación. La primera es la etiqueta de la " +
    "imagen: en lugar de usar siempre latest, se toman los siete primeros caracteres del " +
    "identificador del commit. Así cada imagen queda ligada de forma inequívoca al " +
    "código que la produjo, y ante un fallo en producción se puede saber exactamente qué " +
    "commit está corriendo. La etiqueta latest se mantiene en paralelo por comodidad, " +
    "pero la que viaja a ECS es la del commit."
  ));
  c.push(p(
    "La segunda es la verificación de tipos con tsc --noEmit antes de construir. Si el " +
    "código no compila, la etapa falla y el pipeline se detiene ahí: una imagen rota " +
    "nunca llega a ECR ni a producción. Es la parte de integración continua del " +
    "proceso, y es el lugar natural donde añadir pruebas unitarias más adelante."
  ));

  c.push(h2("5.2 Configuración del proyecto de CodeBuild"));
  c.push(p(
    "El proyecto necesita un ajuste que suele pasarse por alto y que hace fallar la " +
    "compilación de forma confusa: el modo privilegiado. CodeBuild ejecuta las " +
    "instrucciones dentro de un contenedor, y para que ese contenedor pueda a su vez " +
    "construir imágenes de Docker necesita acceso al demonio de Docker. Sin " +
    "privilegedMode activado, docker build falla con un error de conexión al socket que " +
    "no menciona los permisos por ninguna parte."
  ));
  c.push(tabla(
    ["Parámetro", "Valor", "Motivo"],
    [
      ["Tipo de entorno", "LINUX_CONTAINER", "Entorno estándar de compilación"],
      ["Imagen", "aws/codebuild/amazonlinux2-x86_64-standard:5.0", "Trae Node, Docker y la AWS CLI preinstalados"],
      ["Modo privilegiado", "Activado", "Imprescindible para ejecutar docker build dentro del contenedor"],
      ["Tipo de cómputo", "BUILD_GENERAL1_SMALL", "Suficiente para esta imagen; es la opción más económica"],
      ["Origen del buildspec", "buildspec.yml del repositorio", "Las instrucciones se versionan junto al código"],
      ["Tiempo máximo", "20 minutos", "Corta compilaciones colgadas sin consumir cuota"],
    ],
    [0.24, 0.36, 0.4]
  ));
  c.push(pieTabla("Tabla 4. Configuración del proyecto de CodeBuild."));
  c.push(...captura(
    "Proyecto de CodeBuild configurado",
    "la página del proyecto construccion-api-estudiantes en CodeBuild, en la sección de entorno, donde se vean la imagen de compilación, el tipo de cómputo y la casilla de modo privilegiado activada.",
    8
  ));

  c.push(h2("5.3 El artefacto imagedefinitions.json"));
  c.push(p(
    "La última instrucción del buildspec genera un archivo pequeño pero esencial. La " +
    "acción de despliegue de ECS no recibe la imagen: recibe este JSON, que le indica " +
    "qué contenedor de la definición de tarea debe apuntar a qué imagen. El nombre del " +
    "contenedor tiene que coincidir exactamente con el declarado en la definición de " +
    "tarea, o el despliegue falla sin cambiar nada."
  ));
  c.push(...codigo([
    "[",
    "  {",
    '    "name": "api-estudiantes",',
    '    "imageUri": "ID_CUENTA.dkr.ecr.us-east-1.amazonaws.com/api-estudiantes:a3f91c2"',
    "  }",
    "]",
  ], "imagedefinitions.json generado por la compilación"));
  c.push(...captura(
    "Registro de la compilación en CodeBuild",
    "los registros de una ejecución correcta del proyecto de CodeBuild, donde se distingan las fases pre_build, build y post_build, el push a ECR y el contenido de imagedefinitions.json.",
    9
  ));
  c.push(...captura(
    "Imagen publicada en Amazon ECR",
    "el repositorio api-estudiantes en ECR, mostrando las imágenes con sus etiquetas: la del identificador del commit y latest, con su fecha de publicación y tamaño.",
    7
  ));

  // ---------------- 6 ----------------
  c.push(saltoPagina());
  c.push(h1("6. Etapa de Despliegue"));
  c.push(p(
    "La acción de despliegue de ECS lee el imagedefinitions.json, registra una revisión " +
    "nueva de la definición de tarea con la imagen indicada y actualiza el servicio para " +
    "que apunte a ella. A partir de ahí el trabajo lo hace ECS."
  ));
  c.push(p(
    "La actualización es progresiva. ECS arranca una tarea con la imagen nueva, espera a " +
    "que supere la comprobación de salud —la ruta /health que declara el Dockerfile— y " +
    "solo entonces drena y detiene la anterior. Si la tarea nueva no llega a estado " +
    "saludable, ECS revierte y el servicio sigue atendiendo con la versión previa. El " +
    "resultado práctico es que un despliegue fallido no deja la API caída."
  ));
  c.push(tabla(
    ["Parámetro", "Valor"],
    [
      ["Proveedor de la acción", "Amazon ECS"],
      ["Clúster", DATOS.cluster],
      ["Servicio", DATOS.servicio],
      ["Archivo de definición de imagen", "imagedefinitions.json"],
      ["Tiempo máximo de despliegue", "10 minutos"],
    ],
    [0.4, 0.6]
  ));
  c.push(pieTabla("Tabla 5. Configuración de la etapa de Despliegue."));
  c.push(...captura(
    "Configuración de la etapa de Despliegue",
    "el detalle de la acción de despliegue en CodePipeline, donde se lean el proveedor Amazon ECS, el nombre del clúster, el del servicio y el archivo imagedefinitions.json.",
    8
  ));
  c.push(...captura(
    "Pipeline con las tres etapas completadas",
    "la vista general del pipeline en la consola de CodePipeline, con las etapas Fuente, Construcción y Despliegue las tres en verde, y el identificador del commit visible en la etapa de origen.",
    9
  ));

  // ---------------- 7 ----------------
  c.push(h1("7. Permisos y seguridad del pipeline"));
  c.push(p(
    "Un pipeline tiene permiso para modificar lo que está en producción, así que sus " +
    "roles merecen el mismo cuidado que cualquier otro principal. Se crearon dos roles " +
    "de servicio distintos en lugar de uno compartido, de modo que cada servicio tenga " +
    "solo lo que necesita."
  ));
  c.push(p(
    "El rol de CodeBuild puede publicar en un repositorio concreto de ECR —no en " +
    "cualquiera— y escribir sus registros. No tiene ningún permiso sobre ECS: no podría " +
    "desplegar aunque quisiera. El rol de CodePipeline puede lanzar ese proyecto de " +
    "compilación en particular, leer y escribir en el bucket de artefactos, usar la " +
    "conexión de GitHub y actualizar el servicio de ECS."
  ));
  c.push(...codigo(archivoCompleto("infra/politicas/politica-codebuild.json"), "infra/politicas/politica-codebuild.json"));
  c.push(p(
    "Hay un permiso en el rol de CodePipeline que conviene explicar porque su necesidad " +
    "no es evidente: iam:PassRole sobre ecsTaskExecutionRole. Al registrar una revisión " +
    "nueva de la definición de tarea, CodePipeline está entregando ese rol a ECS para " +
    "que la tarea lo use. IAM trata esa entrega como una acción con permiso propio, " +
    "precisamente para impedir que un principal conceda a un servicio más privilegios de " +
    "los que él mismo tiene. La condición iam:PassedToService restringe la entrega al " +
    "servicio de tareas de ECS."
  ));
  c.push(...codigo(
    fragmento("infra/politicas/politica-codepipeline.json", "EntregarElRolDeEjecucion", "}", 2),
    "infra/politicas/politica-codepipeline.json — declaración de iam:PassRole"
  ));
  c.push(...captura(
    "Roles de servicio del pipeline en IAM",
    "la política del rol rol-codepipeline-api-estudiantes en IAM, desplegada en vista de solo lectura, donde se distingan las declaraciones de uso de la conexión, lanzamiento de la compilación y actualización del servicio de ECS.",
    8
  ));

  // ---------------- 8 ----------------
  c.push(saltoPagina());
  c.push(h1("8. Prueba del despliegue automático"));
  c.push(p(
    "La prueba que importa no es que el pipeline se ejecute cuando se pulsa el botón de " +
    "la consola, sino que se dispare solo al modificar el código. Para demostrarlo se " +
    "introduce un cambio visible desde fuera: la ruta /health devuelve un campo nuevo."
  ));

  c.push(h2("8.1 Cambio en el código y push"));
  c.push(...codigo([
    "# En src/app.ts, dentro del manejador de /health, se añade:",
    '#   entorno: process.env.NODE_ENV ?? "desarrollo",',
    "",
    "git add src/app.ts",
    'git commit -m "Agrega el campo entorno a la sonda de salud"',
    "git push origin main",
  ], "Cambio que dispara el pipeline"));
  c.push(p(
    "A partir del push no se toca nada más. El resto ocurre solo, y ese es justamente el " +
    "resultado que el taller pide demostrar."
  ));
  c.push(...captura(
    "Commit publicado en GitHub",
    "el commit recién subido en la página del repositorio en GitHub, con su mensaje y su identificador abreviado visible.",
    6.5
  ));

  c.push(h2("8.2 Ejecución del pipeline"));
  c.push(p(
    "Pocos segundos después del push, CodePipeline arranca una ejecución nueva. El " +
    "estado puede seguirse desde la consola o desde la terminal."
  ));
  c.push(...codigo([
    "aws codepipeline get-pipeline-state --name pipeline-api-estudiantes \\",
    "  --region us-east-1 \\",
    "  --query 'stageStates[].{Etapa:stageName,Estado:latestExecution.status}' \\",
    "  --output table",
  ], "Seguimiento del pipeline desde la terminal"));
  c.push(...captura(
    "Pipeline en ejecución tras el push",
    "el pipeline en la consola con una ejecución en curso, donde se vea al menos una etapa en progreso (azul) y el identificador del commit nuevo en la etapa de origen.",
    8.5
  ));
  c.push(...captura(
    "Despliegue de la nueva revisión en ECS",
    "la pestaña de despliegues del servicio servicio-api-estudiantes en ECS, mostrando la revisión nueva de la definición de tarea y el estado del despliegue como completado.",
    8
  ));

  c.push(h2("8.3 Verificación del cambio en producción"));
  c.push(p(
    "Terminado el pipeline, se consulta la API en su IP pública. La respuesta debe " +
    "incluir el campo que se añadió en el commit, lo que cierra el círculo: el cambio " +
    "pasó del editor a producción sin que nadie ejecutara un despliegue."
  ));
  c.push(...codigo([
    "curl -s http://<IP-PUBLICA>:3000/health | jq",
    "",
    "# Respuesta esperada, con el campo nuevo:",
    "# {",
    '#   "estado": "ok",',
    '#   "servicio": "api-estudiantes",',
    '#   "entorno": "production",',
    '#   "tiempoActivoSegundos": 42',
    "# }",
  ], "Verificación del despliegue"));
  c.push(...captura(
    "La API en producción devuelve el cambio",
    "la terminal o Postman con la respuesta de /health desde la IP pública de la tarea, donde se lea el campo nuevo que se agregó en el commit.",
    7.5
  ));
  c.push(...captura(
    "Registros de la aplicación en CloudWatch",
    "el grupo de registro /ecs/api-estudiantes en CloudWatch con las entradas de las solicitudes recientes, que confirman que la tarea nueva es la que está atendiendo.",
    7.5
  ));

  // ---------------- 9 ----------------
  c.push(saltoPagina());
  c.push(h1("9. Conclusiones"));
  c.push(p(
    "El pipeline convierte un procedimiento de tres pasos manuales en una consecuencia " +
    "automática de hacer push. El tiempo total desde el commit hasta producción ronda " +
    "los cuatro minutos, pero lo relevante no es la velocidad sino que el proceso dejó " +
    "de depender de que alguien lo recuerde y lo ejecute bien."
  ));
  c.push(h2("Beneficios observados"));
  c.push(vinieta("La trazabilidad es completa: cada imagen lleva como etiqueta el identificador del commit que la produjo, de modo que siempre se sabe qué código está corriendo."));
  c.push(vinieta("El despliegue es reproducible. No depende de la máquina de quien lo lanza ni de que tenga la versión correcta de Docker o de la AWS CLI."));
  c.push(vinieta("La verificación de tipos actúa como barrera: un cambio que no compila detiene el pipeline en la etapa de construcción y no llega a producción."));
  c.push(vinieta("La actualización progresiva de ECS, apoyada en la comprobación de salud, hace que un despliegue fallido no tumbe el servicio."));
  c.push(vinieta("Los permisos quedaron repartidos entre dos roles acotados en lugar de concentrarse en uno con acceso amplio."));
  c.push(h2("Limitaciones y siguientes pasos"));
  c.push(p(
    "El pipeline despliega directamente a producción sin aprobación intermedia. Para un " +
    "entorno real, CodePipeline permite insertar una acción de aprobación manual entre " +
    "la construcción y el despliegue, o un entorno de preproducción donde validar antes " +
    "de promover."
  ));
  c.push(p(
    "La etapa de construcción solo verifica tipos. El sitio natural para las pruebas " +
    "automáticas es esa misma fase: añadir la suite funcional de la actividad anterior " +
    "haría que un cambio que rompe un endpoint detuviera el pipeline."
  ));
  c.push(p(
    "Finalmente, la infraestructura se creó con scripts imperativos. Declararla con " +
    "CloudFormation o CDK permitiría versionarla junto al código y reconstruir el " +
    "entorno completo desde cero, que es el paso siguiente natural en la línea de este " +
    "taller."
  ));

  // ---------------- 10 ----------------
  c.push(h1("10. Limpieza de los recursos"));
  c.push(p(
    "El pipeline y la infraestructura de ejecución se desmontan por separado, en ese " +
    "orden: primero lo que orquesta y luego lo que ejecuta."
  ));
  c.push(...codigo([
    "bash infra/borrar-pipeline.sh    # pipeline, CodeBuild, conexion, roles, artefactos",
    "bash infra/apagar-todo.sh        # servicio de ECS, cluster, ECR y logs",
  ], "Secuencia de limpieza"));
  c.push(p(
    "Dos detalles del proceso. El bucket de artefactos tiene el versionado activo porque " +
    "CodePipeline lo exige, así que vaciarlo requiere borrar versiones y marcadores de " +
    "borrado, no solo los objetos actuales. Y al eliminar la conexión conviene revocar " +
    "también la autorización de AWS Connector for GitHub desde la configuración de " +
    "aplicaciones de GitHub: borrar la conexión en AWS no retira el permiso del lado del " +
    "repositorio."
  ));

  // ---------------- 11 ----------------
  c.push(h1("11. Referencias"));
  const refs = [
    "Amazon Web Services. (2024). AWS CodePipeline User Guide: Pipeline structure reference.",
    "Amazon Web Services. (2024). AWS CodeBuild User Guide: Build specification reference.",
    "Amazon Web Services. (2024). Tutorial: Amazon ECS standard deployment with CodePipeline.",
    "Amazon Web Services. (2024). AWS CodeConnections: Connections to GitHub.",
    "Amazon Web Services. (2024). Amazon ECR User Guide: Pushing an image.",
    "Mustafa, O. (2023). A Complete Guide to DevOps with AWS: Deploy, Build, and Scale Services with AWS Tools and Techniques. Apress.",
    "Nadon, J. (2017). Website Hosting and Migration with Amazon Web Services. Apress.",
  ];
  refs.forEach((r) => c.push(new Paragraph({
    alignment: AlignmentType.JUSTIFIED, spacing: { after: 130, line: 276 },
    indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.5) },
    children: [new TextRun({ text: r, font: "Calibri", size: 21 })],
  })));
  c.push(p(
    "Nota: las referencias a documentación de AWS corresponden a guías en línea " +
    "consultadas durante el desarrollo; conviene verificar títulos y fechas de consulta " +
    "antes de la entrega final.",
    { cursiva: true, color: GRIS }
  ));

  return c;
}

function construir() {
  return new Document({
    creator: DATOS.autor,
    title: DATOS.titulo,
    description: `${DATOS.caso} — ${DATOS.curso}`,
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
            children: [new TextRun({ text: "Taller de despliegues automáticos — Pipeline de CI/CD en AWS", font: "Calibri", size: 17, color: "777777" })],
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
  fs.mkdirSync(CAPTURAS, { recursive: true });
  const buffer = await Packer.toBuffer(construir());
  const destino = path.join(SALIDA, "Informe-Pipeline-CICD-AWS.docx");
  fs.writeFileSync(destino, buffer);
  console.log(`Documento generado: ${destino}`);
  console.log(`\nFiguras de captura solicitadas (${figurasPendientes.length}):`);
  for (const f of figurasPendientes) {
    const existe = [".png", ".jpg", ".jpeg"].some((e) => fs.existsSync(path.join(CAPTURAS, `figura${f.numero}${e}`)));
    console.log(`  ${existe ? "[OK]  " : "[----]"} Figura ${f.numero}: ${f.titulo}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
