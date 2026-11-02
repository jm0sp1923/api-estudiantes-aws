#!/usr/bin/env bash
#
# borrar-pipeline.sh
# Elimina el pipeline, el proyecto de CodeBuild, la conexion con GitHub,
# los roles y el bucket de artefactos.
#
# No toca el servicio de ECS ni el repositorio de ECR: para eso esta
# infra/apagar-todo.sh, que se ejecuta despues.
#
# Uso:  bash infra/borrar-pipeline.sh
#
set -uo pipefail

REGION="${REGION:-us-east-1}"
PIPELINE="${PIPELINE:-pipeline-api-estudiantes}"
PROYECTO_BUILD="${PROYECTO_BUILD:-construccion-api-estudiantes}"
CONEXION="${CONEXION:-conexion-github}"
ROL_BUILD="rol-codebuild-api-estudiantes"
ROL_PIPELINE="rol-codepipeline-api-estudiantes"

titulo() { printf '\n\033[1;33m==> %s\033[0m\n' "$1"; }
ok()     { printf '    \033[0;32mOK\033[0m %s\n' "$1"; }
aviso()  { printf '    \033[0;33m--\033[0m %s\n' "$1"; }

read -r -p "Esto borrara el pipeline, CodeBuild, la conexion y el bucket de artefactos. Escriba BORRAR: " CONFIRMA
[ "$CONFIRMA" = "BORRAR" ] || { echo "Cancelado."; exit 0; }

ID_CUENTA="$(aws sts get-caller-identity --query Account --output text)"
BUCKET_ARTEFACTOS="artefactos-pipeline-$ID_CUENTA-$REGION"

# ---------------------------------------------------------------------------
titulo "1/6 Pipeline"
aws codepipeline delete-pipeline --name "$PIPELINE" --region "$REGION" 2>/dev/null \
  && ok "Pipeline $PIPELINE eliminado" || aviso "El pipeline no existe"

# ---------------------------------------------------------------------------
titulo "2/6 Proyecto de CodeBuild"
aws codebuild delete-project --name "$PROYECTO_BUILD" --region "$REGION" 2>/dev/null \
  && ok "Proyecto $PROYECTO_BUILD eliminado" || aviso "El proyecto no existe"
aws logs delete-log-group --log-group-name "/aws/codebuild/$PROYECTO_BUILD" \
  --region "$REGION" 2>/dev/null && ok "Registros de compilacion eliminados" \
  || aviso "Sin registros de compilacion"

# ---------------------------------------------------------------------------
titulo "3/6 Conexion con GitHub"
ARN_CONEXION="$(aws codeconnections list-connections --region "$REGION" \
  --query "Connections[?ConnectionName=='$CONEXION'].ConnectionArn | [0]" --output text 2>/dev/null)"
if [ -n "$ARN_CONEXION" ] && [ "$ARN_CONEXION" != "None" ]; then
  aws codeconnections delete-connection --connection-arn "$ARN_CONEXION" --region "$REGION" \
    && ok "Conexion $CONEXION eliminada"
  aviso "Revoque tambien 'AWS Connector for GitHub' en GitHub > Settings > Applications"
else
  aviso "La conexion $CONEXION no existe"
fi

# ---------------------------------------------------------------------------
titulo "4/6 Roles de servicio"
for par in "$ROL_BUILD:politica-construccion" "$ROL_PIPELINE:politica-orquestacion"; do
  rol="${par%%:*}"; politica="${par##*:}"
  if aws iam get-role --role-name "$rol" >/dev/null 2>&1; then
    aws iam delete-role-policy --role-name "$rol" --policy-name "$politica" 2>/dev/null
    aws iam delete-role --role-name "$rol" && ok "Rol $rol eliminado"
  else
    aviso "El rol $rol no existe"
  fi
done

# ---------------------------------------------------------------------------
titulo "5/6 Bucket de artefactos"
if aws s3api head-bucket --bucket "$BUCKET_ARTEFACTOS" 2>/dev/null; then
  # El bucket tiene versionado: hay que borrar versiones y marcadores de
  # borrado, no solo los objetos actuales, o delete-bucket falla.
  for tipo in Versions DeleteMarkers; do
    while true; do
      LOTE="$(aws s3api list-object-versions --bucket "$BUCKET_ARTEFACTOS" --max-items 500 \
        --query "{Objects: ${tipo}[].{Key:Key,VersionId:VersionId}}" --output json)"
      CANTIDAD="$(echo "$LOTE" | jq -r '.Objects | if . == null then 0 else length end')"
      [ "$CANTIDAD" -eq 0 ] && break
      echo "$LOTE" | jq -c '{Objects: .Objects, Quiet: true}' > /tmp/borrar-artefactos.json
      aws s3api delete-objects --bucket "$BUCKET_ARTEFACTOS" \
        --delete "file:///tmp/borrar-artefactos.json" >/dev/null
      ok "$CANTIDAD entradas de tipo $tipo eliminadas"
    done
  done
  rm -f /tmp/borrar-artefactos.json
  aws s3api delete-bucket --bucket "$BUCKET_ARTEFACTOS" --region "$REGION" \
    && ok "Bucket $BUCKET_ARTEFACTOS eliminado"
else
  aviso "El bucket $BUCKET_ARTEFACTOS no existe"
fi

# ---------------------------------------------------------------------------
titulo "6/6 Resumen"
printf '\n\033[1;32mPipeline desmontado.\033[0m\n'
printf 'El servicio de ECS y el repositorio de ECR siguen activos.\n'
printf 'Para eliminarlos tambien: bash infra/apagar-todo.sh\n\n'
