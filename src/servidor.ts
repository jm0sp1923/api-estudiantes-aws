/**
 * Punto de entrada del proceso.
 *
 * El puerto llega por variable de entorno para no tener que reconstruir la
 * imagen si cambia: el Dockerfile fija 3000 por omision y la definicion de
 * tarea de ECS puede sobrescribirlo.
 */
import { crearApp } from "./app";

const PUERTO = Number(process.env.PORT ?? 3000);

const app = crearApp();

const servidor = app.listen(PUERTO, "0.0.0.0", () => {
  console.log(`API de estudiantes escuchando en el puerto ${PUERTO}`);
  console.log(`Sonda de salud disponible en /health`);
});

/**
 * Apagado ordenado. ECS envia SIGTERM al detener una tarea y espera 30
 * segundos antes de matar el proceso; cerrar el servidor a tiempo evita
 * cortar solicitudes en curso durante un despliegue.
 */
for (const senal of ["SIGTERM", "SIGINT"] as const) {
  process.on(senal, () => {
    console.log(`Senal ${senal} recibida, cerrando el servidor...`);
    servidor.close(() => {
      console.log("Servidor cerrado correctamente.");
      process.exit(0);
    });
  });
}
