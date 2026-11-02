/**
 * Dominio de estudiantes: modelo, validacion y almacen en memoria.
 *
 * El enunciado permite usar estructuras en memoria. El almacen se expone
 * detras de una interfaz pequena para que cambiarlo por DynamoDB o Postgres
 * mas adelante no obligue a tocar las rutas HTTP.
 */
import { randomUUID } from "node:crypto";

export interface Estudiante {
  id: string;
  nombre: string;
  apellido: string;
  correo: string;
  creadoEn: string;
}

/** Datos que llegan en el cuerpo de un POST /students. */
export interface DatosNuevoEstudiante {
  nombre: string;
  apellido: string;
  correo: string;
}

export interface ErrorValidacion {
  campo: string;
  mensaje: string;
}

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Valida el cuerpo de la solicitud y devuelve la lista de errores.
 * Un arreglo vacio significa que los datos son correctos.
 */
export function validarNuevoEstudiante(cuerpo: unknown): ErrorValidacion[] {
  const errores: ErrorValidacion[] = [];

  if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) {
    return [{ campo: "cuerpo", mensaje: "Se esperaba un objeto JSON." }];
  }

  const datos = cuerpo as Record<string, unknown>;

  for (const campo of ["nombre", "apellido"] as const) {
    const valor = datos[campo];
    if (typeof valor !== "string" || valor.trim().length === 0) {
      errores.push({ campo, mensaje: `El campo ${campo} es obligatorio.` });
    } else if (valor.trim().length > 80) {
      errores.push({ campo, mensaje: `El campo ${campo} supera los 80 caracteres.` });
    }
  }

  const correo = datos.correo;
  if (typeof correo !== "string" || correo.trim().length === 0) {
    errores.push({ campo: "correo", mensaje: "El campo correo es obligatorio." });
  } else if (!CORREO_VALIDO.test(correo.trim())) {
    errores.push({ campo: "correo", mensaje: "El correo no tiene un formato valido." });
  }

  const permitidos = new Set(["nombre", "apellido", "correo"]);
  for (const clave of Object.keys(datos)) {
    if (!permitidos.has(clave)) {
      errores.push({ campo: clave, mensaje: `El campo ${clave} no esta permitido.` });
    }
  }

  return errores;
}

/** Contrato del almacen, para poder sustituir la implementacion. */
export interface AlmacenEstudiantes {
  listar(): Estudiante[];
  obtener(id: string): Estudiante | undefined;
  buscarPorCorreo(correo: string): Estudiante | undefined;
  crear(datos: DatosNuevoEstudiante): Estudiante;
}

/**
 * Implementacion en memoria.
 *
 * Importante para la demostracion: los datos viven en el proceso, de modo
 * que al reiniciar el contenedor la coleccion vuelve al estado inicial.
 * Es la decision que pide el enunciado para simplificar, y se explica como
 * tal en el video.
 */
export class AlmacenEnMemoria implements AlmacenEstudiantes {
  private readonly estudiantes = new Map<string, Estudiante>();

  constructor(semilla: DatosNuevoEstudiante[] = []) {
    for (const datos of semilla) this.crear(datos);
  }

  listar(): Estudiante[] {
    return [...this.estudiantes.values()].sort((a, b) =>
      a.creadoEn.localeCompare(b.creadoEn)
    );
  }

  obtener(id: string): Estudiante | undefined {
    return this.estudiantes.get(id);
  }

  buscarPorCorreo(correo: string): Estudiante | undefined {
    const normalizado = correo.trim().toLowerCase();
    return this.listar().find((e) => e.correo === normalizado);
  }

  crear(datos: DatosNuevoEstudiante): Estudiante {
    const estudiante: Estudiante = {
      id: randomUUID(),
      nombre: datos.nombre.trim(),
      apellido: datos.apellido.trim(),
      correo: datos.correo.trim().toLowerCase(),
      creadoEn: new Date().toISOString(),
    };
    this.estudiantes.set(estudiante.id, estudiante);
    return estudiante;
  }
}

/** Datos iniciales para que la demostracion no arranque con una lista vacia. */
export const SEMILLA: DatosNuevoEstudiante[] = [
  { nombre: "Camila", apellido: "Rodriguez", correo: "camila.rodriguez@lasalle.edu.co" },
  { nombre: "Andres", apellido: "Gomez", correo: "andres.gomez@lasalle.edu.co" },
];
