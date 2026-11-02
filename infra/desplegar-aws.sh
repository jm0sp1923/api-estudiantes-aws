#!/usr/bin/env bash
#
# desplegar-aws.sh
# Publica la imagen en Amazon ECR y levanta la API en AWS Fargate.
#
# Pasos: repositorio ECR -> build y push de la imagen -> grupo de logs ->
#        rol de ejecucion -> cluster -> definicion de tarea -> grupo de
#        seguridad -> servicio -> IP publica.
#
# Requisitos: AWS CLI v2 configurado, Docker en ejecucion y jq.
# Uso:  bash infra/desplegar-aws.sh
#
set -euo pipefail

REGION="${REGION:-us-east-1}"
REPO="${REPO:-api-estudiantes}"
ETIQUETA="${ETIQUETA:-1.0}"
CLUSTER="${CLUSTER:-cluster-estudiantes}"
FAMILIA="${FAMILIA:-tarea-api-estudiantes}"
SERVICIO="${SERVICIO:-servicio-api-estudiantes}"
GRUPO_SEG="${GRUPO_SEG:-api-estudiantes-http}"
ROL_EJECUCION="ecsTaskExecutionRole"
GRUPO_LOGS="/ecs/api-estudiantes"
PUERTO=3000

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GENERADO="$RAIZ/infra/.generado"
mkdir -p "$GENERADO"

titulo() { printf '\n\033[1;34m==> %s\033[0m\n' "$1"; }
ok()     { printf '    \033[0;32mOK\033[0m %s\n' "$1"; }
aviso()  { printf '    \033[0;33m--\033[0m %s\n' "$1"; }

command -v aws    >/dev/null || { echo "Falta AWS CLI v2"; exit 1; }
command -v docker >/dev/null || { echo "Falta Docker"; exit 1; }
command -v jq     >/dev/null || { echo "Falta jq (brew install jq)"; exit 1; }
docker info >/dev/null 2>&1  || { echo "Docker no esta en ejecucion. Abra Docker Desktop."; exit 1; }

# ---------------------------------------------------------------------------
titulo "0/8 Identificando la cuenta"
ID_CUENTA="$(aws sts get-caller-identity --query Account --output text)"
REGISTRO="$ID_CUENTA.dkr.ecr.$REGION.amazonaws.com"
IMAGEN="$REGISTRO/$REPO:$ETIQUETA"
ok "Cuenta $ID_CUENTA - region $REGION"

# ---------------------------------------------------------------------------
titulo "1/8 Repositorio de ECR"
if aws ecr describe-repositories --repository-names "$REPO" --region "$REGION" >/dev/null 2>&1; then
  ok "El repositorio $REPO ya existe"
else
  aws ecr create-repository --repository-name "$REPO" --region "$REGION" \
    --image-scanning-configuration scanOnPush=true \
    --image-tag-mutability MUTABLE >/dev/null
  ok "Repositorio $REPO creado con analisis de vulnerabilidades"
fi

# ---------------------------------------------------------------------------
titulo "2/8 Construyendo y publicando la imagen"
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "$REGISTRO" >/dev/null
ok "Sesion iniciada en ECR"

# --platform linux/amd64 es obligatorio en Mac con chip Apple Silicon:
# Fargate ejecuta x86_64 y una imagen arm64 arranca y muere en bucle con
# el error "exec format error".
docker build --platform linux/amd64 --provenance=false -t "$REPO:$ETIQUETA" "$RAIZ"
ok "Imagen construida para linux/amd64"

docker tag "$REPO:$ETIQUETA" "$IMAGEN"
docker push "$IMAGEN" >/dev/null
ok "Imagen publicada: $IMAGEN"

# ---------------------------------------------------------------------------
titulo "3/8 Grupo de registros en CloudWatch"
aws logs create-log-group --log-group-name "$GRUPO_LOGS" --region "$REGION" 2>/dev/null \
  && ok "Grupo $GRUPO_LOGS creado" || ok "El grupo $GRUPO_LOGS ya existe"
aws logs put-retention-policy --log-group-name "$GRUPO_LOGS" --retention-in-days 7 --region "$REGION"
ok "Retencion fijada en 7 dias"

# ---------------------------------------------------------------------------
titulo "4/8 Rol de ejecucion de tareas"
if aws iam get-role --role-name "$ROL_EJECUCION" >/dev/null 2>&1; then
  ok "El rol $ROL_EJECUCION ya existe"
else
  cat > "$GENERADO/confianza-ecs.json" <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PermitirQueEcsAsumaElRol",
      "Effect": "Allow",
      "Principal": { "Service": "ecs-tasks.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
  aws iam create-role --role-name "$ROL_EJECUCION" \
    --assume-role-policy-document "file://$GENERADO/confianza-ecs.json" \
    --description "Rol que ECS usa para descargar la imagen de ECR y escribir logs" >/dev/null
  aws iam attach-role-policy --role-name "$ROL_EJECUCION" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
  ok "Rol $ROL_EJECUCION creado"
  sleep 10
fi
ARN_ROL="arn:aws:iam::$ID_CUENTA:role/$ROL_EJECUCION"

# ---------------------------------------------------------------------------
titulo "5/8 Cluster de ECS"
ESTADO_CLUSTER="$(aws ecs describe-clusters --clusters "$CLUSTER" --region "$REGION" \
  --query 'clusters[0].status' --output text 2>/dev/null || echo "None")"
if [ "$ESTADO_CLUSTER" = "ACTIVE" ]; then
  ok "El cluster $CLUSTER ya existe"
else
  aws ecs create-cluster --cluster-name "$CLUSTER" --region "$REGION" \
    --capacity-providers FARGATE >/dev/null
  ok "Cluster $CLUSTER creado"
fi

# ---------------------------------------------------------------------------
titulo "6/8 Definicion de tarea"
jq -n \
  --arg familia "$FAMILIA" --arg rol "$ARN_ROL" --arg imagen "$IMAGEN" \
  --arg grupo "$GRUPO_LOGS" --arg region "$REGION" --argjson puerto "$PUERTO" '
{
  family: $familia,
  networkMode: "awsvpc",
  requiresCompatibilities: ["FARGATE"],
  cpu: "256",
  memory: "512",
  executionRoleArn: $rol,
  runtimePlatform: { cpuArchitecture: "X86_64", operatingSystemFamily: "LINUX" },
  containerDefinitions: [
    {
      name: "api-estudiantes",
      image: $imagen,
      essential: true,
      portMappings: [ { containerPort: $puerto, protocol: "tcp" } ],
      environment: [ { name: "PORT", value: ($puerto|tostring) } ],
      healthCheck: {
        command: ["CMD-SHELL", "node -e \"fetch(\u0027http://127.0.0.1:3000/health\u0027).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""],
        interval: 30, timeout: 5, retries: 3, startPeriod: 10
      },
      logConfiguration: {
        logDriver: "awslogs",
        options: {
          "awslogs-group": $grupo,
          "awslogs-region": $region,
          "awslogs-stream-prefix": "api"
        }
      }
    }
  ]
}' > "$GENERADO/tarea.json"

REVISION="$(aws ecs register-task-definition --region "$REGION" \
  --cli-input-json "file://$GENERADO/tarea.json" \
  --query 'taskDefinition.revision' --output text)"
ok "Definicion registrada: $FAMILIA:$REVISION (256 CPU / 512 MB)"

# ---------------------------------------------------------------------------
titulo "7/8 Red y grupo de seguridad"
VPC="$(aws ec2 describe-vpcs --region "$REGION" \
  --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)"
[ "$VPC" = "None" ] && { echo "No hay VPC predeterminada en $REGION"; exit 1; }

SUBREDES="$(aws ec2 describe-subnets --region "$REGION" \
  --filters Name=vpc-id,Values="$VPC" Name=default-for-az,Values=true \
  --query 'Subnets[].SubnetId' --output text | tr '\t' ',')"
ok "VPC predeterminada $VPC con subredes $SUBREDES"

ID_SG="$(aws ec2 describe-security-groups --region "$REGION" \
  --filters Name=group-name,Values="$GRUPO_SEG" Name=vpc-id,Values="$VPC" \
  --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo "None")"

if [ "$ID_SG" = "None" ] || [ -z "$ID_SG" ]; then
  ID_SG="$(aws ec2 create-security-group --region "$REGION" \
    --group-name "$GRUPO_SEG" --vpc-id "$VPC" \
    --description "Acceso HTTP al puerto $PUERTO de la API de estudiantes" \
    --query 'GroupId' --output text)"
  aws ec2 authorize-security-group-ingress --region "$REGION" \
    --group-id "$ID_SG" --protocol tcp --port "$PUERTO" --cidr 0.0.0.0/0 >/dev/null
  ok "Grupo de seguridad $ID_SG creado (entrada tcp/$PUERTO)"
else
  ok "El grupo de seguridad $ID_SG ya existe"
fi

# ---------------------------------------------------------------------------
titulo "8/8 Servicio de Fargate"
RED="awsvpcConfiguration={subnets=[$SUBREDES],securityGroups=[$ID_SG],assignPublicIp=ENABLED}"

ESTADO_SERVICIO="$(aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICIO" \
  --region "$REGION" --query 'services[0].status' --output text 2>/dev/null || echo "None")"

if [ "$ESTADO_SERVICIO" = "ACTIVE" ]; then
  aws ecs update-service --cluster "$CLUSTER" --service "$SERVICIO" --region "$REGION" \
    --task-definition "$FAMILIA:$REVISION" --desired-count 1 --force-new-deployment >/dev/null
  ok "Servicio existente actualizado a la revision $REVISION"
else
  aws ecs create-service --cluster "$CLUSTER" --service-name "$SERVICIO" --region "$REGION" \
    --task-definition "$FAMILIA:$REVISION" --desired-count 1 --launch-type FARGATE \
    --network-configuration "$RED" >/dev/null
  ok "Servicio $SERVICIO creado"
fi

printf '    .. esperando a que la tarea quede en estado RUNNING'
for _ in $(seq 1 40); do
  TAREA="$(aws ecs list-tasks --cluster "$CLUSTER" --service-name "$SERVICIO" \
    --desired-status RUNNING --region "$REGION" --query 'taskArns[0]' --output text 2>/dev/null)"
  [ "$TAREA" != "None" ] && [ -n "$TAREA" ] && break
  printf '.'; sleep 6
done
printf '\n'

[ "$TAREA" = "None" ] && { echo "La tarea no llego a RUNNING. Revise: aws logs tail $GRUPO_LOGS --follow"; exit 1; }

ENI="$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TAREA" --region "$REGION" \
  --query "tasks[0].attachments[0].details[?name=='networkInterfaceId'].value | [0]" --output text)"
IP_PUBLICA="$(aws ec2 describe-network-interfaces --network-interface-ids "$ENI" --region "$REGION" \
  --query 'NetworkInterfaces[0].Association.PublicIp' --output text)"
ok "Tarea en ejecucion con IP publica $IP_PUBLICA"

URL="http://$IP_PUBLICA:$PUERTO"
cat > "$RAIZ/.env.local" <<EOF
URL_API=$URL
REGION=$REGION
ID_CUENTA=$ID_CUENTA
IMAGEN=$IMAGEN
EOF

titulo "Despliegue completado"
cat <<EOF

  Cuenta ........... $ID_CUENTA
  Imagen ........... $IMAGEN
  Cluster .......... $CLUSTER
  Servicio ......... $SERVICIO
  Definicion ....... $FAMILIA:$REVISION
  URL publica ...... $URL

  Pruebe la API en la nube con:
    curl $URL/health
    npm run probar -- $URL

  Siga los registros con:
    aws logs tail $GRUPO_LOGS --follow --region $REGION

  NOTA: la IP publica cambia cada vez que ECS reemplaza la tarea. Para una
  direccion estable se antepone un balanceador de carga de aplicacion.

EOF
