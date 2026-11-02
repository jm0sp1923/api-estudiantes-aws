/**
 * Rutas REST de la coleccion de estudiantes.
 *
 *   POST /students        crea un estudiante          201 Created
 *   GET  /students        lista todos los estudiantes 200 OK
 *   GET  /students/:id    obtiene uno por su id       200 OK / 404 Not Found
 */
import { Router, type Request, type Response } from "express";
import {
  validarNuevoEstudiante,
  type AlmacenEstudiantes,
  type DatosNuevoEstudiante,
} from "../dominio/estudiantes";

export function crearRutasEstudiantes(almacen: AlmacenEstudiantes): Router {
  const router = Router();

  // --- Listar todos ------------------------------------------------------
  router.get("/", (_req: Request, res: Response) => {
    const estudiantes = almacen.listar();
    res.status(200).json({
      total: estudiantes.length,
      datos: estudiantes,
    });
  });

  // --- Obtener uno por id ------------------------------------------------
  router.get("/:id", (req: Request, res: Response) => {
    const estudiante = almacen.obtener(req.params.id);

    if (!estudiante) {
      return res.status(404).json({
        error: "NoEncontrado",
        mensaje: `No existe un estudiante con el identificador ${req.params.id}.`,
      });
    }

    res.status(200).json(estudiante);
  });

  // --- Crear -------------------------------------------------------------
  router.post("/", (req: Request, res: Response) => {
    const errores = validarNuevoEstudiante(req.body);

    if (errores.length > 0) {
      return res.status(400).json({
        error: "SolicitudInvalida",
        mensaje: "El cuerpo de la solicitud no supero la validacion.",
        detalles: errores,
      });
    }

    const datos = req.body as DatosNuevoEstudiante;

    // El correo identifica de forma natural a un estudiante: se rechaza el
    // duplicado con 409 en lugar de crear dos registros equivalentes.
    const existente = almacen.buscarPorCorreo(datos.correo);
    if (existente) {
      return res.status(409).json({
        error: "CorreoDuplicado",
        mensaje: `Ya existe un estudiante registrado con el correo ${datos.correo.trim().toLowerCase()}.`,
        idExistente: existente.id,
      });
    }

    const estudiante = almacen.crear(datos);

    // 201 con Location apuntando al recurso recien creado, como manda REST.
    res.status(201).location(`/students/${estudiante.id}`).json(estudiante);
  });

  return router;
}
