# =============================================================================
# Dockerfile multietapa para la API de gestion de estudiantes
#
# Etapa 1 (compilacion): instala TODAS las dependencias, incluidas las de
#   desarrollo, y transpila TypeScript a JavaScript.
# Etapa 2 (ejecucion): parte de una imagen limpia y copia solo lo necesario
#   para correr: las dependencias de produccion y el codigo ya compilado.
#
# El resultado es una imagen final sin TypeScript, sin ts-node y sin codigo
# fuente: menos peso y menos superficie de ataque.
# =============================================================================

# ----------------------------- Etapa 1: build -------------------------------
FROM node:20-alpine AS compilacion

WORKDIR /app

# Se copian primero los manifiestos. Si no cambian, Docker reutiliza la capa
# de npm ci en las reconstrucciones y la imagen se arma en segundos.
COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run compilar

# --------------------------- Etapa 2: ejecucion -----------------------------
FROM node:20-alpine AS ejecucion

# tini actua como proceso init: reenvia las senales del sistema al proceso
# de Node. Sin el, el SIGTERM que envia ECS al detener la tarea no llega y
# el contenedor muere de forma abrupta tras el tiempo de espera.
RUN apk add --no-cache tini

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=compilacion /app/dist ./dist

# La imagen base de Node trae el usuario 'node' sin privilegios. Ejecutar
# como root dentro del contenedor es un riesgo innecesario.
USER node

EXPOSE 3000

# Sonda de salud del contenedor. Docker marca el contenedor como unhealthy
# si la ruta /health deja de responder.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/servidor.js"]
