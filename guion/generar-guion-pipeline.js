/**
 * generar-guion-pipeline.js
 * Guion del video del taller de despliegues automáticos.
 * Uso: node guion/generar-guion-pipeline.js
 */
const fs = require("node:fs");
const path = require("node:path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle,
  ShadingType, Table, TableRow, TableCell, WidthType, VerticalAlign, Footer,
  Header, PageNumber, PageBreak, Tab, TabStopType, LeaderType, LevelFormat,
  convertInchesToTwip,
} = require("docx");

const RAIZ = path.resolve(__dirname, "..");
const SALIDA = path.join(__dirname, "salida");

const DATOS = {
  universidad: "Universidad de La Salle",
  facultad: "Facultad de Ingeniería — Programa de Ingeniería de Software",
  curso: "Herramientas de Software II",
  caso: "Taller de despliegues automáticos",
  titulo: "Guion del video de sustentación",
  subtitulo: "Pipeline de CI/CD con AWS CodePipeline, CodeBuild y Amazon ECS",
  autor: "Juan Sebastián Martínez",
  ciudad: "Bogotá D.C.",
  fecha: "Septiembre de 2026",
};

const ANCHO_PAGINA = 12240, ALTO_PAGINA = 15840;
const MARGEN = convertInchesToTwip(1);
const ANCHO_UTIL = ANCHO_PAGINA - MARGEN * 2;
const AZUL = "1B4F72", GRIS = "444444", GRIS_CODIGO = "F2F2F2";

const p = (t, o = {}) => new Paragraph({
  alignment: o.alineacion ?? AlignmentType.JUSTIFIED,
  spacing: { after: o.despues ?? 130, line: 276 },
  children: [new TextRun({ text: t, font: "Calibri", size: o.tamano ?? 22, bold: o.negrita ?? false, italics: o.cursiva ?? false, color: o.color ?? "000000" })],
});
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 170 }, children: [new TextRun({ text: t, font: "Calibri", size: 30, bold: true, color: AZUL })] });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 230, after: 130 }, children: [new TextRun({ text: t, font: "Calibri", size: 25, bold: true, color: "2E5F8A" })] });
const vinieta = (t) => new Paragraph({ numbering: { reference: "vinietas", level: 0 }, spacing: { after: 85, line: 276 }, alignment: AlignmentType.JUSTIFIED, children: [new TextRun({ text: t, font: "Calibri", size: 22 })] });
const saltoPagina = () => new Paragraph({ children: [new PageBreak()] });

const ANCHO_CODIGO = 86;
function ajustar(lineas) {
  const out = [];
  for (const l of lineas) {
    if (l.length <= ANCHO_CODIGO) { out.push(l); continue; }
    let resto = l, primera = true;
    const sangria = (l.match(/^\s*/) || [""])[0] + "  ";
    while (resto.length > ANCHO_CODIGO) {
      const lim = primera ? ANCHO_CODIGO : ANCHO_CODIGO - sangria.length;
      let corte = resto.lastIndexOf(" ", lim); if (corte <= 0) corte = lim;
      out.push((primera ? "" : sangria) + resto.slice(0, corte).trimEnd());
      resto = resto.slice(corte).replace(/^ +/, ""); primera = false;
    }
    if (resto.length) out.push(sangria + resto);
  }
  return out;
}
function codigo(orig, sub) {
  const lineas = ajustar(orig); const b = [];
  if (sub) b.push(new Paragraph({ spacing: { before: 110, after: 55 }, children: [new TextRun({ text: sub, font: "Calibri", size: 19, bold: true, color: GRIS })] }));
  lineas.forEach((l, i) => b.push(new Paragraph({
    spacing: { before: i === 0 ? 40 : 0, after: i === lineas.length - 1 ? 150 : 0 },
    shading: { type: ShadingType.CLEAR, fill: GRIS_CODIGO, color: "auto" },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: "9AA5B1", space: 6 } },
    indent: { left: 120, right: 120 },
    children: [new TextRun({ text: l.length ? l : " ", font: "Consolas", size: 17, color: "1A1A1A" })],
  })));
  return b;
}
function esIdentificador(t) { const s = t.trim(); if (!s || /\s/.test(s)) return false; return /^[A-Za-z0-9_.:{}/*$+-]+$/.test(s) && /[-._:/{}$]/.test(s); }
function tabla(enc, filas, props) {
  const anchos = props.map((f) => Math.round(ANCHO_UTIL * f));
  anchos[anchos.length - 1] += ANCHO_UTIL - anchos.reduce((a, b) => a + b, 0);
  const celda = (t, i, e) => new TableCell({
    width: { size: anchos[i], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    shading: e ? { type: ShadingType.CLEAR, fill: AZUL, color: "auto" } : undefined,
    margins: { top: 80, bottom: 80, left: 110, right: 110 },
    children: String(t).split("|").map((l) => new Paragraph({ spacing: { after: 0, line: 252 }, children: [new TextRun({ text: l, font: !e && esIdentificador(l) ? "Consolas" : "Calibri", size: 19, bold: e, color: e ? "FFFFFF" : "000000" })] })),
  });
  return new Table({ width: { size: ANCHO_UTIL, type: WidthType.DXA }, columnWidths: anchos, rows: [new TableRow({ tableHeader: true, children: enc.map((t, i) => celda(t, i, true)) }), ...filas.map((f) => new TableRow({ children: f.map((t, i) => celda(t, i, false)) }))] });
}
const pieTabla = (t) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 70, after: 190 }, children: [new TextRun({ text: t, font: "Calibri", size: 18, italics: true, color: GRIS })] });

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
const decir = (t) => new Paragraph({
  alignment: AlignmentType.JUSTIFIED, spacing: { after: 130, line: 276 },
  indent: { left: convertInchesToTwip(0.3) },
  border: { left: { style: BorderStyle.SINGLE, size: 6, color: "B7C4D1", space: 8 } },
  children: [new TextRun({ text: t, font: "Calibri", size: 21, italics: true, color: "2A3F55" })],
});
const mostrar = (t) => new Paragraph({
  spacing: { after: 110 },
  children: [new TextRun({ text: "En pantalla: ", font: "Calibri", size: 21, bold: true, color: GRIS }), new TextRun({ text: t, font: "Calibri", size: 21 })],
});

function portada() {
  const linea = (t, s, b, esp, c = "000000") => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: esp }, children: [new TextRun({ text: t, font: "Calibri", size: s, bold: b, color: c })] });
  return [
    new Paragraph({ spacing: { after: 900 }, children: [] }),
    linea(DATOS.universidad.toUpperCase(), 32, true, 100, AZUL),
    linea(DATOS.facultad, 22, false, 60),
    linea(DATOS.curso, 22, false, 850),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, border: { top: { style: BorderStyle.SINGLE, size: 12, color: AZUL, space: 10 } }, children: [] }),
    linea(DATOS.caso, 24, true, 140, "2E5F8A"),
    linea(DATOS.titulo, 36, true, 120),
    linea(DATOS.subtitulo, 23, false, 120, GRIS),
    linea("Duración objetivo: 9 minutos (límite 10)", 21, false, 120, GRIS),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 850 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: AZUL, space: 10 } }, children: [] }),
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
  ["4. Bloque 1 — El problema que resuelve el pipeline", 5],
  ["5. Bloque 2 — Arquitectura y servicios", 5],
  ["6. Bloque 3 — Etapa de Fuente y conexión con GitHub", 5],
  ["7. Bloque 4 — Etapa de Construcción y buildspec", 7],
  ["8. Bloque 5 — Etapa de Despliegue", 7],
  ["9. Bloque 6 — La prueba en vivo", 9],
  ["10. Bloque 7 — Cierre", 10],
  ["11. Anexo A — Chuleta de comandos", 10],
  ["12. Anexo B — Problemas frecuentes", 11],
];

function tablaContenido() {
  return [
    h1("Contenido"),
    ...CONTENIDO.map(([t, pag]) => new Paragraph({
      spacing: { after: 60 },
      tabStops: [{ type: TabStopType.RIGHT, position: ANCHO_UTIL, leader: LeaderType.DOT }],
      children: [new TextRun({ text: t, font: "Calibri", size: 22 }), new TextRun({ children: [new Tab(), String(pag)], font: "Calibri", size: 22 })],
    })),
    saltoPagina(),
  ];
}

function cuerpo() {
  const c = [];

  c.push(h1("1. Cómo usar este guion"));
  c.push(p(
    "Este taller tiene dos entregables: el informe en PDF y este video. El informe " +
    "documenta la configuración con capturas; el video explica el razonamiento y, sobre " +
    "todo, demuestra el pipeline funcionando en vivo."
  ));
  c.push(p(
    "El texto en cursiva con barra lateral es lo que se dice; los bloques grises son " +
    "comandos exactos. No hace falta leer el guion palabra por palabra: sirve para no " +
    "perder el hilo ni dejarse ninguno de los puntos que el enunciado pide."
  ));
  c.push(p(
    "La diferencia con el video anterior es el ritmo. Aquí hay una espera larga e " +
    "inevitable: el pipeline tarda unos cuatro minutos desde el push hasta que el cambio " +
    "está en producción. La sección siguiente explica cómo convertir esa espera en " +
    "contenido en vez de en silencio."
  ));

  c.push(h1("2. Preparación antes de grabar"));
  c.push(h2("El problema del tiempo y cómo resolverlo"));
  c.push(p(
    "Cuatro minutos de espera en un video de nueve es casi la mitad del metraje. Hay dos " +
    "estrategias, y conviene combinarlas."
  ));
  c.push(p(
    "La primera es hacer el push al principio del bloque de la demostración y seguir " +
    "hablando mientras el pipeline avanza: explicar la etapa de construcción con el " +
    "buildspec en pantalla ocupa justo el tiempo que CodeBuild tarda en terminar. La " +
    "espera deja de ser espera.", { despues: 110 }
  ));
  c.push(p(
    "La segunda es grabar el bloque de la demostración por separado y cortar la parte " +
    "muerta en la edición. Es legítimo siempre que se vea que la ejecución es real y " +
    "continua: basta con mostrar el reloj del pipeline antes y después del corte."
  ));
  c.push(h2("Lista de verificación"));
  c.push(vinieta("Ejecutar el pipeline completo con éxito al menos una vez ANTES de grabar. Si algo está mal configurado, es mejor descubrirlo sin la cámara encendida."));
  c.push(vinieta("Dejar la conexión de GitHub en estado Disponible y comprobado."));
  c.push(vinieta("Tener el cambio del código ya decidido y escrito en un archivo aparte, para pegarlo en el momento sin pensar."));
  c.push(vinieta("Anotar la IP pública actual de la tarea de ECS y verificar que responde."));
  c.push(vinieta("Abrir y ordenar las pestañas: CodePipeline, CodeBuild, ECR, ECS, el repositorio en GitHub y el editor."));
  c.push(vinieta("Subir la letra de la terminal a 16 pt o más y cerrar notificaciones."));
  c.push(vinieta("Verificar que la consola de AWS está en la región us-east-1 en todas las pestañas."));

  c.push(h1("3. Estructura del video"));
  c.push(tabla(
    ["Tiempo", "Bloque", "Punto del enunciado"],
    [
      ["0:00 – 0:40", "El problema que resuelve el pipeline", "Introducción al taller"],
      ["0:40 – 2:00", "Arquitectura y servicios", "Arquitectura del pipeline y servicios de AWS usados"],
      ["2:00 – 3:00", "Etapa de Fuente y conexión con GitHub", "Etapa de Fuente"],
      ["3:00 – 4:30", "Etapa de Construcción y buildspec", "Etapa de Construcción con CodeBuild"],
      ["4:30 – 5:30", "Etapa de Despliegue", "Etapa de Despliegue"],
      ["5:30 – 8:15", "La prueba en vivo", "Probar el pipeline con un cambio real"],
      ["8:15 – 9:00", "Cierre", "Conclusiones"],
    ],
    [0.17, 0.35, 0.48]
  ));
  c.push(pieTabla("Tabla 1. Bloques del video y requerimiento que atiende cada uno."));

  // ---- Bloque 1 ----
  c.push(saltoPagina());
  c.push(h1("4. Bloque 1 — El problema que resuelve el pipeline"));
  c.push(bloque("0:00 – 0:40", "Planteamiento"));
  c.push(mostrar("la cara, o el diagrama de arquitectura del informe."));
  c.push(decir(
    "«Buenas. Soy Juan Sebastián Martínez. En el taller anterior desplegué una API de " +
    "estudiantes en AWS Fargate, pero lo hice a mano: construir la imagen, subirla a ECR " +
    "y actualizar el servicio eran tres comandos que yo tenía que ejecutar.»"
  ));
  c.push(decir(
    "«Eso funciona una vez. El problema aparece cuando hay que repetirlo: depende de que " +
    "mi máquina tenga el entorno correcto, no queda registro de qué versión del código " +
    "produjo qué imagen, y si me olvido de reconstruir, despliego una versión vieja sin " +
    "enterarme. En este video monto un pipeline de CI/CD para que todo eso ocurra solo " +
    "cada vez que hago push.»"
  ));

  // ---- Bloque 2 ----
  c.push(h1("5. Bloque 2 — Arquitectura y servicios"));
  c.push(bloque("0:40 – 2:00", "Las tres etapas y los servicios implicados"));
  c.push(mostrar("el diagrama de arquitectura a pantalla completa."));
  c.push(decir(
    "«La arquitectura tiene tres etapas. La de Fuente descarga el código de GitHub " +
    "cuando detecta un push. La de Construcción, que corre en CodeBuild, verifica el " +
    "código, construye la imagen de Docker y la publica en ECR. Y la de Despliegue " +
    "actualiza el servicio de ECS para que use esa imagen nueva.»"
  ));
  c.push(decir(
    "«CodePipeline no hace el trabajo: lo orquesta. Va pasando artefactos de una etapa a " +
    "la siguiente a través de un bucket de S3. La etapa de fuente produce el código; la " +
    "de construcción produce un archivo pequeño, imagedefinitions.json, que le dice a la " +
    "de despliegue qué imagen usar.»"
  ));
  c.push(decir(
    "«Sobre por qué elegí ECS como destino: el enunciado proponía también Elastic " +
    "Beanstalk o S3 con CloudFront. La aplicación ya estaba contenerizada y corriendo en " +
    "ECS del taller anterior, así que monto el pipeline sobre lo que ya existe en vez de " +
    "duplicar infraestructura. S3 con CloudFront además no aplica aquí: sirve para " +
    "sitios estáticos, y esto es una API con lógica de servidor.»"
  ));
  c.push(p(
    "Si el profesor valora que se mencione CodeBuild como opcional: aquí la etapa de " +
    "construcción no es opcional, porque la aplicación se despliega como contenedor y " +
    "alguien tiene que construir la imagen. Sin esa etapa habría que subirla a mano, que " +
    "es el trabajo manual que se quiere eliminar.", { cursiva: true, color: GRIS }
  ));

  // ---- Bloque 3 ----
  c.push(h1("6. Bloque 3 — Etapa de Fuente y conexión con GitHub"));
  c.push(bloque("2:00 – 3:00", "CodeConnections y detección de cambios"));
  c.push(mostrar("la consola: Developer Tools → Settings → Connections, y luego la etapa de Fuente en el pipeline."));
  c.push(decir(
    "«El código está en GitHub. Vale la pena decir por qué no usé CodeCommit, que sería " +
    "la opción nativa de AWS: desde mediados de 2024 AWS dejó de admitir repositorios " +
    "nuevos de CodeCommit en cuentas que no lo estuvieran usando ya. En una cuenta nueva " +
    "el servicio simplemente no está disponible.»"
  ));
  c.push(decir(
    "«La conexión con GitHub se hace con AWS CodeConnections. AWS instala una aplicación " +
    "en GitHub y yo la autorizo sobre el repositorio. La ventaja frente al método " +
    "antiguo, que era guardar un token personal dentro del pipeline, es que no hay " +
    "ningún secreto almacenado y puedo revocar el acceso desde GitHub cuando quiera.»"
  ));
  c.push(decir(
    "«Este es el único paso del taller que no pude automatizar: la autorización OAuth " +
    "exige pasar por la consola. Mi script crea la conexión, pero se detiene y avisa de " +
    "que hay que completarla a mano.»"
  ));
  c.push(decir(
    "«En la etapa de Fuente, el parámetro importante es la detección de cambios. Con esa " +
    "opción activada, CodeConnections registra un webhook en GitHub y cada push a la " +
    "rama main dispara el pipeline. Sin ella tendría que lanzarlo yo, que es justo lo " +
    "que estoy intentando evitar.»"
  ));

  // ---- Bloque 4 ----
  c.push(saltoPagina());
  c.push(h1("7. Bloque 4 — Etapa de Construcción y buildspec"));
  c.push(bloque("3:00 – 4:30", "CodeBuild, buildspec.yml y modo privilegiado"));
  c.push(mostrar("el archivo buildspec.yml en el editor."));
  c.push(decir(
    "«CodeBuild levanta un contenedor efímero y ejecuta lo que diga este archivo, el " +
    "buildspec. Tiene tres fases. En pre_build inicia sesión en ECR y calcula la " +
    "etiqueta de la imagen. En build verifica los tipos y construye la imagen. Y en " +
    "post_build la publica y genera el artefacto para la etapa siguiente.»"
  ));
  c.push(...codigo(
    fragmento("buildspec.yml", "      - ETIQUETA=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION", "echo \"Commit"),
    "buildspec.yml — etiquetado por commit"
  ));
  c.push(decir(
    "«Dos decisiones que quiero destacar. La primera: no etiqueto la imagen como latest, " +
    "sino con los siete primeros caracteres del commit. Así cada imagen queda ligada de " +
    "forma inequívoca al código que la produjo. Si mañana algo falla en producción, " +
    "miro la etiqueta de la imagen que está corriendo y sé exactamente qué commit es.»"
  ));
  c.push(decir(
    "«La segunda: antes de construir, ejecuto la verificación de tipos de TypeScript. Si " +
    "el código no compila, la etapa falla y el pipeline se detiene ahí. Una imagen rota " +
    "nunca llega a ECR ni a producción. Esta es la parte de integración continua, y es " +
    "donde añadiría las pruebas unitarias como siguiente paso.»"
  ));
  c.push(mostrar("la consola de CodeBuild, en la configuración del entorno del proyecto."));
  c.push(decir(
    "«Un detalle de configuración que me costó descubrir: el modo privilegiado. " +
    "CodeBuild ejecuta las instrucciones dentro de un contenedor, y para que ese " +
    "contenedor pueda a su vez construir imágenes de Docker necesita acceso al demonio " +
    "de Docker. Si no se activa, docker build falla con un error de conexión al socket " +
    "que no menciona los permisos por ninguna parte.»"
  ));

  // ---- Bloque 5 ----
  c.push(h1("8. Bloque 5 — Etapa de Despliegue"));
  c.push(bloque("4:30 – 5:30", "Acción de ECS y actualización progresiva"));
  c.push(mostrar("la etapa de Despliegue en CodePipeline y el archivo imagedefinitions.json."));
  c.push(decir(
    "«La acción de despliegue no recibe la imagen: recibe este archivo JSON que generó " +
    "la compilación. Le dice a ECS qué contenedor de la definición de tarea debe apuntar " +
    "a qué imagen. El nombre del contenedor tiene que coincidir exactamente con el de la " +
    "definición de tarea; si no coincide, el despliegue falla sin cambiar nada.»"
  ));
  c.push(...codigo([
    "[",
    "  {",
    '    "name": "api-estudiantes",',
    '    "imageUri": "<cuenta>.dkr.ecr.us-east-1.amazonaws.com/api-estudiantes:a3f91c2"',
    "  }",
    "]",
  ], "imagedefinitions.json"));
  c.push(decir(
    "«Con eso, ECS registra una revisión nueva de la definición de tarea y actualiza el " +
    "servicio. La actualización es progresiva: arranca una tarea con la imagen nueva, " +
    "espera a que pase la comprobación de salud —la ruta /health que declaré en el " +
    "Dockerfile— y solo entonces detiene la anterior. Si la tarea nueva no llega a estar " +
    "saludable, ECS revierte y el servicio sigue atendiendo con la versión vieja. Un " +
    "despliegue fallido no me tumba la API.»"
  ));
  c.push(p(
    "Si queda tiempo, aquí encaja bien mencionar los permisos: dos roles de servicio " +
    "separados, el de CodeBuild sin ningún permiso sobre ECS y el de CodePipeline con " +
    "iam:PassRole acotado por condición. Si el tiempo aprieta, se omite y queda " +
    "documentado en el informe.", { cursiva: true, color: GRIS }
  ));

  // ---- Bloque 6 ----
  c.push(saltoPagina());
  c.push(h1("9. Bloque 6 — La prueba en vivo"));
  c.push(bloque("5:30 – 8:15", "Un push que llega a producción solo"));
  c.push(p(
    "Este es el bloque que demuestra el taller. El orden importa: primero se hace el " +
    "push, y mientras el pipeline corre se habla. No al revés.", { negrita: true }
  ));
  c.push(mostrar("primero la terminal con la respuesta actual de la API, para tener la referencia."));
  c.push(decir("«Antes de tocar nada, miro qué responde la API ahora mismo en producción.»"));
  c.push(...codigo(["curl -s http://<IP-PUBLICA>:3000/health | jq"], "Estado antes del cambio"));
  c.push(mostrar("el editor con src/app.ts."));
  c.push(decir(
    "«Voy a hacer un cambio pequeño pero visible desde fuera: que la sonda de salud " +
    "devuelva también el entorno en el que corre. Una línea.»"
  ));
  c.push(...codigo([
    "// En src/app.ts, dentro del manejador de /health:",
    'entorno: process.env.NODE_ENV ?? "desarrollo",',
  ], "El cambio"));
  c.push(decir("«Y lo subo. A partir de aquí no vuelvo a tocar AWS: todo lo que pase, pasa solo.»"));
  c.push(...codigo([
    "git add src/app.ts",
    'git commit -m "Agrega el campo entorno a la sonda de salud"',
    "git push origin main",
  ], "Push que dispara el pipeline"));
  c.push(mostrar("la consola de CodePipeline, recargando para que se vea arrancar la ejecución."));
  c.push(decir(
    "«En unos segundos el pipeline arranca solo. Ahí está: la etapa de Fuente ya tiene " +
    "el identificador de mi commit, el mismo que acabo de hacer.»"
  ));
  c.push(p(
    "Aquí empiezan los dos minutos de la construcción. Úselos: abra el registro de " +
    "CodeBuild en vivo y vaya narrando las fases a medida que aparecen. Es contenido " +
    "real, no relleno.", { cursiva: true, color: GRIS }
  ));
  c.push(mostrar("el registro de la compilación en CodeBuild, desplazándose a medida que avanza."));
  c.push(decir(
    "«Aquí se ve el buildspec ejecutándose: inicia sesión en ECR, instala dependencias, " +
    "verifica los tipos, construye la imagen y la publica. Fíjense en la etiqueta: " +
    "coincide con el commit.»"
  ));
  c.push(mostrar("ECR, con la imagen recién publicada."));
  c.push(decir("«Y aquí está la imagen en ECR, publicada hace unos segundos con la etiqueta del commit.»"));
  c.push(mostrar("ECS, pestaña de despliegues del servicio."));
  c.push(decir(
    "«La etapa de despliegue ya registró una revisión nueva de la definición de tarea y " +
    "ECS está levantando la tarea con la imagen nueva. Mientras tanto, la vieja sigue " +
    "atendiendo: no hay corte.»"
  ));
  c.push(decir("«Pipeline completo, las tres etapas en verde. Vuelvo a consultar la API.»"));
  c.push(...codigo([
    "curl -s http://<IP-PUBLICA>:3000/health | jq",
  ], "Verificación del cambio en producción"));
  c.push(decir(
    "«Ahí está el campo entorno, que hace cuatro minutos no existía. Desde que hice push " +
    "no ejecuté ningún comando contra AWS: el cambio llegó a producción solo. Eso es " +
    "exactamente lo que el taller pedía demostrar.»"
  ));

  // ---- Bloque 7 ----
  c.push(h1("10. Bloque 7 — Cierre"));
  c.push(bloque("8:15 – 9:00", "Conclusiones"));
  c.push(decir(
    "«Para cerrar. El pipeline convierte tres pasos manuales en una consecuencia " +
    "automática de hacer push. Tarda unos cuatro minutos, pero lo importante no es la " +
    "velocidad: es que el proceso dejó de depender de que yo lo recuerde y lo haga bien.»"
  ));
  c.push(decir(
    "«Gano trazabilidad, porque cada imagen lleva la etiqueta del commit que la produjo. " +
    "Gano reproducibilidad, porque el despliegue ya no depende de mi máquina. Y gano una " +
    "barrera de calidad, porque un cambio que no compila se detiene en la construcción " +
    "y no llega a producción.»"
  ));
  c.push(decir(
    "«Como siguientes pasos dejaría tres: añadir las pruebas funcionales a la etapa de " +
    "construcción, insertar una aprobación manual antes de desplegar a producción, y " +
    "declarar la infraestructura con CloudFormation para poder versionarla junto al " +
    "código. Gracias.»"
  ));

  // ---- Anexo A ----
  c.push(h1("11. Anexo A — Chuleta de comandos"));
  c.push(...codigo([
    "# --- Antes de grabar -----------------------------------------------",
    "aws sts get-caller-identity",
    "aws codeconnections list-connections --region us-east-1",
    "USUARIO_GITHUB=tu-usuario bash infra/crear-pipeline.sh",
    "",
    "# --- Estado del pipeline -------------------------------------------",
    "aws codepipeline get-pipeline-state --name pipeline-api-estudiantes \\",
    "  --region us-east-1 \\",
    "  --query 'stageStates[].{Etapa:stageName,Estado:latestExecution.status}' \\",
    "  --output table",
    "",
    "# --- Demostracion --------------------------------------------------",
    "curl -s http://<IP-PUBLICA>:3000/health | jq",
    "git add src/app.ts",
    'git commit -m "Agrega el campo entorno a la sonda de salud"',
    "git push origin main",
    "",
    "# --- Registros ------------------------------------------------------",
    "aws logs tail /aws/codebuild/construccion-api-estudiantes --follow --region us-east-1",
    "aws logs tail /ecs/api-estudiantes --follow --region us-east-1",
    "",
    "# --- IP publica actual de la tarea ----------------------------------",
    "TAREA=$(aws ecs list-tasks --cluster cluster-estudiantes \\",
    "  --service-name servicio-api-estudiantes --region us-east-1 \\",
    "  --query 'taskArns[0]' --output text)",
    "ENI=$(aws ecs describe-tasks --cluster cluster-estudiantes --tasks $TAREA \\",
    "  --region us-east-1 \\",
    "  --query \"tasks[0].attachments[0].details[?name=='networkInterfaceId'].value | [0]\" \\",
    "  --output text)",
    "aws ec2 describe-network-interfaces --network-interface-ids $ENI --region us-east-1 \\",
    "  --query 'NetworkInterfaces[0].Association.PublicIp' --output text",
    "",
    "# --- Limpieza al terminar -------------------------------------------",
    "bash infra/borrar-pipeline.sh",
    "bash infra/apagar-todo.sh",
  ]));

  // ---- Anexo B ----
  c.push(h1("12. Anexo B — Problemas frecuentes"));
  c.push(tabla(
    ["Síntoma", "Causa", "Solución"],
    [
      ["La conexión se queda en estado Pendiente", "Falta completar la autorización OAuth, que no puede hacerse desde la CLI", "Developer Tools → Settings → Connections → Update pending connection"],
      ["Cannot connect to the Docker daemon en CodeBuild", "El proyecto no tiene activado el modo privilegiado", "Activar privilegedMode en la configuración del entorno"],
      ["El push no dispara el pipeline", "La detección de cambios está desactivada o el webhook no se registró", "Verificar DetectChanges en la acción de origen y el webhook en GitHub"],
      ["El despliegue falla con un error de nombre de contenedor", "El campo name de imagedefinitions.json no coincide con el de la definición de tarea", "Igualar ambos nombres; en este proyecto es api-estudiantes"],
      ["AccessDenied al publicar en ECR", "El rol de CodeBuild no tiene permisos sobre el repositorio", "Revisar la política politica-construccion del rol"],
      ["La tarea nueva arranca y muere en bucle", "La imagen se construyó para arm64 en vez de x86_64", "Confirmar que el buildspec usa --platform linux/amd64"],
      ["is not authorized to perform iam:PassRole", "Falta el permiso de entrega del rol de ejecución en el rol de CodePipeline", "Añadir iam:PassRole sobre ecsTaskExecutionRole con la condición de servicio"],
    ],
    [0.33, 0.31, 0.36]
  ));
  c.push(pieTabla("Tabla 2. Fallos habituales al montar el pipeline y cómo resolverlos."));
  c.push(p(
    "Si algo falla en plena grabación, no corte: explique en voz alta qué dice el error " +
    "y cómo se arregla. Ver a alguien diagnosticar un fallo real suele valorarse más que " +
    "una demostración sin tropiezos.", { cursiva: true, color: GRIS }
  ));

  return c;
}

function fragmento(rutaRelativa, marcaInicio, marcaFin, lineasAntes = 0) {
  const contenido = fs.readFileSync(path.join(RAIZ, rutaRelativa), "utf8").split("\n");
  const enc = contenido.findIndex((l) => l.includes(marcaInicio));
  if (enc === -1) throw new Error(`No se encontro "${marcaInicio}" en ${rutaRelativa}`);
  const inicio = Math.max(0, enc - lineasAntes);
  let fin = contenido.findIndex((l, i) => i > enc && l.includes(marcaFin));
  if (fin === -1) fin = contenido.length - 1;
  return contenido.slice(inicio, fin + 1).map((l) => l.replace(/\t/g, "    "));
}

function construir() {
  return new Document({
    creator: DATOS.autor, title: `${DATOS.titulo} — ${DATOS.caso}`,
    numbering: { config: [{ reference: "vinietas", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: convertInchesToTwip(0.35), hanging: convertInchesToTwip(0.2) } } } }] }] },
    sections: [{
      properties: {
        page: { size: { width: ANCHO_PAGINA, height: ALTO_PAGINA }, margin: { top: MARGEN, bottom: MARGEN, left: MARGEN, right: MARGEN } },
        titlePage: true,
      },
      headers: {
        default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC", space: 6 } }, children: [new TextRun({ text: "Guion del video — Pipeline de CI/CD con AWS CodePipeline", font: "Calibri", size: 17, color: "777777" })] })] }),
        first: new Header({ children: [new Paragraph({ children: [] })] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: "Calibri", size: 18, color: "777777" })] })] }),
        first: new Footer({ children: [new Paragraph({ children: [] })] }),
      },
      children: [...portada(), ...tablaContenido(), ...cuerpo()],
    }],
  });
}

async function main() {
  fs.mkdirSync(SALIDA, { recursive: true });
  const buffer = await Packer.toBuffer(construir());
  const destino = path.join(SALIDA, "Guion-Video-Pipeline-CICD-AWS.docx");
  fs.writeFileSync(destino, buffer);
  console.log(`Guion generado: ${destino}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
