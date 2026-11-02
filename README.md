# API de Gestión de Estudiantes — Docker + AWS Fargate

Herramientas de Software II · Universidad de La Salle · Ingeniería de Software

API RESTful en Node.js + TypeScript + Express, contenerizada con Docker y
desplegada en AWS Fargate con la imagen alojada en Amazon ECR.

## Endpoints

| Método | Ruta | Respuesta |
|---|---|---|
| `GET` | `/health` | `200` · estado del servicio (sonda de salud) |
| `GET` | `/students` | `200` · `{ total, datos[] }` |
| `GET` | `/students/{id}` | `200` · estudiante · `404` si no existe |
| `POST` | `/students` | `201` + `Location` · `400` inválido · `409` correo repetido |

Cuerpo de `POST /students`:

```json
{ "nombre": "Laura", "apellido": "Martinez", "correo": "laura.martinez@lasalle.edu.co" }
```

Respuesta `201`:

```json
{
  "id": "9f1c...",
  "nombre": "Laura",
  "apellido": "Martinez",
  "correo": "laura.martinez@lasalle.edu.co",
  "creadoEn": "2026-09-21T15:04:05.000Z"
}
```

## Ejecución local sin Docker

```bash
npm install
npm run dev          # http://localhost:3000
npm run probar       # 8 pruebas funcionales
```

## Ejecución local con Docker

```bash
docker build -t api-estudiantes:1.0 .
docker run -d --name api-estudiantes -p 3000:3000 api-estudiantes:1.0
curl http://localhost:3000/health
npm run probar -- http://localhost:3000
docker logs -f api-estudiantes
docker rm -f api-estudiantes
```

## Despliegue en AWS

```bash
bash infra/desplegar-aws.sh
```

Crea el repositorio de ECR, publica la imagen, registra la definición de
tarea, levanta el servicio en Fargate y devuelve la URL pública.

```bash
npm run probar -- http://<IP-PUBLICA>:3000
aws logs tail /ecs/api-estudiantes --follow
```

## Limpieza

```bash
bash infra/apagar-todo.sh
```

## Decisiones de diseño

- **Almacenamiento en memoria**, como permite el enunciado. El almacén está
  detrás de la interfaz `AlmacenEstudiantes`, así que sustituirlo por
  DynamoDB no obliga a tocar las rutas.
- **Dockerfile multietapa**: la imagen final no lleva TypeScript, ni
  `ts-node`, ni código fuente.
- **Usuario sin privilegios** (`node`) dentro del contenedor.
- **`tini` como init** para que el `SIGTERM` de ECS llegue al proceso.
- **`--platform linux/amd64`** al construir: Fargate ejecuta x86_64 y una
  imagen arm64 de un Mac con Apple Silicon falla con `exec format error`.
