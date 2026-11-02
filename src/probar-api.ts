/**
 * Pruebas funcionales de la API.
 *
 * Funciona igual contra el contenedor local y contra la tarea de Fargate:
 * solo cambia la URL base. Esto permite demostrar en el video que el mismo
 * conjunto de pruebas pasa en los dos entornos.
 *
 * Uso:
 *   npm run probar
 *   npm run probar -- http://localhost:3000
 *   npm run probar -- http://54.123.45.67:3000
 */

const BASE = (process.argv[2] ?? process.env.URL_API ?? "http://localhost:3000").replace(/\/+$/, "");

interface Resultado {
  nombre: string;
  paso: boolean;
  detalle: string;
}

const resultados: Resultado[] = [];

function registrar(nombre: string, paso: boolean, detalle: string): void {
  resultados.push({ nombre, paso, detalle });
  console.log(`\n[${paso ? "PASA" : "FALLA"}] ${nombre}`);
  console.log(`   ${detalle}`);
}

async function main(): Promise<void> {
  console.log("=".repeat(70));
  console.log("PRUEBAS FUNCIONALES - API de gestion de estudiantes");
  console.log(`URL base: ${BASE}`);
  console.log("=".repeat(70));

  // 1. Sonda de salud
  const salud = await fetch(`${BASE}/health`);
  const cuerpoSalud = await salud.json();
  registrar(
    "GET /health responde 200",
    salud.status === 200 && cuerpoSalud.estado === "ok",
    `HTTP ${salud.status} - estado: ${cuerpoSalud.estado} - activo hace ${cuerpoSalud.tiempoActivoSegundos}s`
  );

  // 2. Listado inicial
  const listaInicial = await fetch(`${BASE}/students`);
  const cuerpoInicial = await listaInicial.json();
  registrar(
    "GET /students lista la coleccion",
    listaInicial.status === 200 && Array.isArray(cuerpoInicial.datos),
    `HTTP ${listaInicial.status} - total: ${cuerpoInicial.total}`
  );

  // 3. Creacion
  const correoUnico = `prueba.${Date.now()}@lasalle.edu.co`;
  const creacion = await fetch(`${BASE}/students`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre: "Laura", apellido: "Martinez", correo: correoUnico }),
  });
  const creado = await creacion.json();
  registrar(
    "POST /students crea un estudiante",
    creacion.status === 201 && typeof creado.id === "string",
    `HTTP ${creacion.status} - id: ${creado.id} - Location: ${creacion.headers.get("location")}`
  );

  // 4. Lectura por id
  const porId = await fetch(`${BASE}/students/${creado.id}`);
  const cuerpoPorId = await porId.json();
  registrar(
    "GET /students/{id} devuelve el estudiante creado",
    porId.status === 200 && cuerpoPorId.correo === correoUnico,
    `HTTP ${porId.status} - ${cuerpoPorId.nombre} ${cuerpoPorId.apellido} <${cuerpoPorId.correo}>`
  );

  // 5. Identificador inexistente
  const inexistente = await fetch(`${BASE}/students/00000000-0000-0000-0000-000000000000`);
  const cuerpoInexistente = await inexistente.json();
  registrar(
    "GET /students/{id} inexistente devuelve 404",
    inexistente.status === 404,
    `HTTP ${inexistente.status} - ${cuerpoInexistente.error}`
  );

  // 6. Validacion de campos obligatorios
  const invalido = await fetch(`${BASE}/students`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre: "SinApellido", correo: "no-es-un-correo" }),
  });
  const cuerpoInvalido = await invalido.json();
  registrar(
    "POST /students con datos invalidos devuelve 400",
    invalido.status === 400 && Array.isArray(cuerpoInvalido.detalles),
    `HTTP ${invalido.status} - ${cuerpoInvalido.detalles?.map((d: { campo: string }) => d.campo).join(", ")}`
  );

  // 7. Correo duplicado
  const duplicado = await fetch(`${BASE}/students`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre: "Otra", apellido: "Persona", correo: correoUnico }),
  });
  const cuerpoDuplicado = await duplicado.json();
  registrar(
    "POST /students con correo repetido devuelve 409",
    duplicado.status === 409,
    `HTTP ${duplicado.status} - ${cuerpoDuplicado.error}`
  );

  // 8. El listado refleja la creacion
  const listaFinal = await fetch(`${BASE}/students`);
  const cuerpoFinal = await listaFinal.json();
  registrar(
    "GET /students refleja el nuevo registro",
    cuerpoFinal.total === cuerpoInicial.total + 1,
    `total antes: ${cuerpoInicial.total} - total ahora: ${cuerpoFinal.total}`
  );

  const superadas = resultados.filter((r) => r.paso).length;
  console.log(`\n${"=".repeat(70)}`);
  console.log(`RESULTADO: ${superadas}/${resultados.length} pruebas superadas`);
  console.log("=".repeat(70));

  process.exit(superadas === resultados.length ? 0 : 1);
}

main().catch((error) => {
  console.error("\nError ejecutando las pruebas:", error instanceof Error ? error.message : error);
  console.error(`Verifique que la API este respondiendo en ${BASE}`);
  process.exit(1);
});
