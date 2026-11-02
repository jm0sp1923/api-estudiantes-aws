#!/usr/bin/env bash
#
# apagar-todo.sh
# Elimina todo lo creado por desplegar-aws.sh.
#
# Orden importante: primero el servicio (deja de consumir la tarea y libera
# la interfaz de red), luego el cluster, despues el grupo de seguridad -que
# no se puede borrar mientras una ENI lo use-, y al final ECR y los logs.
#
# Uso:  bash infra/apagar-todo.sh
#
set -uo pipefail

REGION="${REGION:-us-east-1}"
REPO="${REPO:-api-estudiantes}"
CLUSTER="${CLUSTER:-cluster-estudiantes}"
FAMILIA="${FAMILIA:-tarea-api-estudiantes}"
SERVICIO="${SERVICIO:-servicio-api-estudiantes}"
GRUPO_SEG="${GRUPO_SEG:-api-estudiantes-http}"
GRUPO_LOGS="/ecs/api-estudiantes"

titulo() { printf '\n\033[1;33m==> %s\033[0m\n' "$1"; }
ok()     { printf '    \033[0;32mOK\033[0m %s\n' "$1"; }
aviso()  { printf '    \033[0;33m--\033[0m %s\n' "$1"; }

read -r -p "Esto borrara el servicio, el cluster, el repositorio de ECR y los logs. Escriba BORRAR para continuar: " CONFIRMA
[ "$CONFIRMA" = "BORRAR" ] || { echo "Cancelado."; exit 0; }

# ---------------------------------------------------------------------------
titulo "1/6 Deteniendo el servicio"
if aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICIO" --region "$REGION" \
    --query 'services[0].status' --output text 2>/dev/null | grep -q ACTIVE; then
  aws ecs update-service --cluster "$CLUSTER" --service "$SERVICIO" \
    --desired-count 0 --region "$REGION" >/dev/null
  ok "Tareas reducidas a cero"
  aws ecs delete-service --cluster "$CLUSTER" --service "$SERVICIO" \
    --force --region "$REGION" >/dev/null
  ok "Servicio $SERVICIO eliminado"
  printf '    .. esperando a que se liberen las interfaces de red'
  for _ in $(seq 1 20); do
    PENDIENTES="$(aws ecs list-tasks --cluster "$CLUSTER" --region "$REGION" \
      --query 'length(taskArns)' --output text 2>/dev/null || echo 0)"
    [ "$PENDIENTES" = "0" ] && break
    printf '.'; sleep 6
  done
  printf '\n'
else
  aviso "El servicio $SERVICIO no existe"
fi

# ---------------------------------------------------------------------------
titulo "2/6 Dando de baja las definiciones de tarea"
for arn in $(aws ecs list-task-definitions --family-prefix "$FAMILIA" --status ACTIVE \
    --region "$REGION" --query 'taskDefinitionArns[]' --output text 2>/dev/null); do
  aws ecs deregister-task-definition --task-definition "$arn" --region "$REGION" >/dev/null
  ok "Revision dada de baja: ${arn##*/}"
done

# ---------------------------------------------------------------------------
titulo "3/6 Eliminando el cluster"
aws ecs delete-cluster --cluster "$CLUSTER" --region "$REGION" >/dev/null 2>&1 \
  && ok "Cluster $CLUSTER eliminado" || aviso "No se pudo eliminar el cluster (puede que ya no exista)"

# ---------------------------------------------------------------------------
titulo "4/6 Eliminando el grupo de seguridad"
VPC="$(aws ec2 describe-vpcs --region "$REGION" --filters Name=isDefault,Values=true \
  --query 'Vpcs[0].VpcId' --output text)"
ID_SG="$(aws ec2 describe-security-groups --region "$REGION" \
  --filters Name=group-name,Values="$GRUPO_SEG" Name=vpc-id,Values="$VPC" \
  --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null)"

if [ -n "$ID_SG" ] && [ "$ID_SG" != "None" ]; then
  # La ENI de Fargate tarda un poco en desaparecer; se reintenta.
  for intento in 1 2 3 4 5; do
    if aws ec2 delete-security-group --group-id "$ID_SG" --region "$REGION" 2>/dev/null; then
      ok "Grupo de seguridad $ID_SG eliminado"; break
    fi
    [ "$intento" = "5" ] && aviso "El grupo $ID_SG sigue en uso; borrelo a mano en unos minutos"
    printf '    .. la interfaz de red aun esta asociada, reintentando (%s)\n' "$intento"
    sleep 15
  done
else
  aviso "El grupo de seguridad $GRUPO_SEG no existe"
fi

# ---------------------------------------------------------------------------
titulo "5/6 Eliminando el repositorio de ECR"
aws ecr delete-repository --repository-name "$REPO" --force --region "$REGION" >/dev/null 2>&1 \
  && ok "Repositorio $REPO y sus imagenes eliminados" \
  || aviso "El repositorio $REPO no existe"

# ---------------------------------------------------------------------------
titulo "6/6 Eliminando los registros"
aws logs delete-log-group --log-group-name "$GRUPO_LOGS" --region "$REGION" 2>/dev/null \
  && ok "Grupo de logs $GRUPO_LOGS eliminado" || aviso "Sin grupo de logs que borrar"

printf '\n\033[1;32mLimpieza completada.\033[0m\n'
printf 'El rol ecsTaskExecutionRole se conserva: es un rol estandar reutilizable\n'
printf 'por cualquier otro servicio de ECS y no genera ningun costo.\n\n'
