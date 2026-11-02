/**
 * Construccion de la aplicacion Express.
 *
 * Se separa de servidor.ts para poder montarla en pruebas sin abrir un
 * puerto, y para que el arranque del proceso quede en un solo lugar.
 */
import express, { type Application, type Request, type Response, type NextFunction } from "express";
import { crearRutasEstudiantes } from "./rutas/estudiantes";
import { AlmacenEnMemoria, SEMILLA, type AlmacenEstudiantes } from "./dominio/estudiantes";

export function crearApp(almacen: AlmacenEstudiantes = new AlmacenEnMemoria(SEMILLA)): Application {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));

  // Registro sencillo de cada solicitud: en Fargate esta salida va directo
  // a CloudWatch Logs a traves del controlador awslogs.
  app.use((req: Request, res: Response, siguiente: NextFunction) => {
    const inicio = Date.now();
    res.on("finish", () => {
      const ms = Date.now() - inicio;
      console.log(
        JSON.stringify({
          metodo: req.method,
          ruta: req.originalUrl,
          estado: res.statusCode,
          latenciaMs: ms,
          fecha: new Date().toISOString(),
        })
      );
    });
    siguiente();
  });

  // Sonda de salud: la usa el HEALTHCHECK de Docker y el chequeo del
  // balanceador o del servicio de ECS para saber si la tarea esta viva.
  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({
      estado: "ok",
      servicio: "api-estudiantes",
      version: process.env.npm_package_version ?? "1.0.0",
      tiempoActivoSegundos: Math.round(process.uptime()),
    });
  });

  app.use("/students", crearRutasEstudiantes(almacen));

  // 404 para cualquier ruta no declarada.
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: "RutaNoEncontrada",
      mensaje: `La ruta ${req.method} ${req.originalUrl} no existe en esta API.`,
    });
  });

  // Manejador de errores: captura, entre otros, el JSON mal formado que
  // express.json() rechaza antes de llegar a las rutas.
  app.use((error: Error & { status?: number; type?: string }, _req: Request, res: Response, _siguiente: NextFunction) => {
    if (error.type === "entity.parse.failed") {
      return res.status(400).json({
        error: "JsonInvalido",
        mensaje: "El cuerpo de la solicitud no es JSON valido.",
      });
    }

    console.error("Error no controlado:", error);
    res.status(error.status ?? 500).json({
      error: "ErrorInterno",
      mensaje: "Ocurrio un error inesperado procesando la solicitud.",
    });
  });

  return app;
}
