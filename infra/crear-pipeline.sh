#!/usr/bin/env bash
#
# crear-pipeline.sh
# Crea el pipeline de CI/CD: conexion a GitHub, proyecto de CodeBuild y
# pipeline de CodePipeline con las etapas Fuente, Construccion y Despliegue.
#
# PRERREQUISITO: el servicio de ECS debe existir. Si no, ejecute antes
#                bash infra/desplegar-aws.sh
#
# Uso:  USUARIO_GITHUB=tu-usuario bash infra/crear-pipeline.sh
#
set -euo pipefail

REGION="${REGION:-us-east-1}"
REPO_ECR="${REPO_ECR:-api-estudiantes}"
CLUSTER="${CLUSTER:-cluster-estudiantes}"
SERVICIO_ECS="${SERVICIO_ECS:-servicio-api-estudiantes}"
PIPELINE="${PIPELINE:-pipeline-api-estudiantes}"
PROYECTO_BUILD="${PROYECTO_BUILD:-construccion-api-estudiantes}"
CONEXION="${CONEXION:-conexion-github}"
ROL_BUILD="rol-codebuild-api-estudiantes"
ROL_PIPELINE="rol-codepipeline-api-estudiantes"
RAMA="${RAMA:-main}"

USUARIO_GITHUB="${USUARIO_GITHUB:-}"
REPO_GITHUB="${REPO_GITHUB:-api-estudiantes}"

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
POLITICAS="$RAIZ/infra/politicas"
GENERADO="$RAIZ/infra/.generado"
mkdir -p "$GENERADO"

titulo() { printf '\n\033[1;34m==> %s\033[0m\n' "$1"; }
ok()     { printf '    \033[0;32mOK\033[0m %s\n' "$1"; }
aviso()  { printf '    \033[0;33m--\033[0m %s\n' "$1"; }

command -v aws >/dev/null || { echo "Falta AWS CLI v2"; exit 1; }
command -v jq  >/dev/null || { echo "Falta jq (brew install jq)"; exit 1; }
[ -n "$USUARIO_GITHUB" ] || { echo "Defina USUARIO_GITHUB: USUARIO_GITHUB=tu-usuario bash infra/crear-pipeline.sh"; exit 1; }

# ---------------------------------------------------------------------------
titulo "0/7 Comprobaciones previas"
ID_CUENTA="$(aws sts get-caller-identity --query Account --output text)"
ok "Cuenta $ID_CUENTA - region $REGION"

ESTADO_SERVICIO="$(aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICIO_ECS" \
  --region "$REGION" --query 'services[0].status' --output text 2>/dev/null || echo "None")"
if [ "$ESTADO_SERVICIO" != "ACTIVE" ]; then
  echo "    El servicio $SERVICIO_ECS no esta activo en el cluster $CLUSTER."
  echo "    Ejecute primero: bash infra/desplegar-aws.sh"
  exit 1
fi
ok "Servicio de ECS $SERVICIO_ECS activo"

BUCKET_ARTEFACTOS="artefactos-pipeline-$ID_CUENTA-$REGION"

render() {
  sed -e "s|ID_CUENTA|$ID_CUENTA|g" \
      -e "s|REGION|$REGION|g" \
      -e "s|BUCKET_ARTEFACTOS|$BUCKET_ARTEFACTOS|g" \
      -e "s|ARN_CONEXION|${ARN_CONEXION:-*}|g" \
      "$POLITICAS/$1" > "$GENERADO/$1"
  echo "$GENERADO/$1"
}

# ---------------------------------------------------------------------------
titulo "1/7 Bucket de artefactos"
if aws s3api head-bucket --bucket "$BUCKET_ARTEFACTOS" 2>/dev/null; then
  ok "El bucket $BUCKET_ARTEFACTOS ya existe"
else
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET_ARTEFACTOS" --region "$REGION" >/dev/null
  else
    aws s3api create-bucket --bucket "$BUCKET_ARTEFACTOS" --region "$REGION" \
      --create-bucket-configuration "LocationConstraint=$REGION" >/dev/null
  fi
  ok "Bucket $BUCKET_ARTEFACTOS creado"
fi
# CodePipeline exige versionado en el bucket de artefactos.
aws s3api put-bucket-versioning --bucket "$BUCKET_ARTEFACTOS" \
  --versioning-configuration Status=Enabled
aws s3api put-public-access-block --bucket "$BUCKET_ARTEFACTOS" \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
ok "Versionado activo y acceso publico bloqueado"

# ---------------------------------------------------------------------------
titulo "2/7 Conexion con GitHub"
ARN_CONEXION="$(aws codeconnections list-connections --region "$REGION" \
  --query "Connections[?ConnectionName=='$CONEXION'].ConnectionArn | [0]" --output text 2>/dev/null || echo "None")"

if [ "$ARN_CONEXION" = "None" ] || [ -z "$ARN_CONEXION" ]; then
  ARN_CONEXION="$(aws codeconnections create-connection --region "$REGION" \
    --provider-type GitHub --connection-name "$CONEXION" \
    --query 'ConnectionArn' --output text)"
  ok "Conexion creada: $ARN_CONEXION"
else
  ok "La conexion ya existe: $ARN_CONEXION"
fi

ESTADO_CONEXION="$(aws codeconnections get-connection --connection-arn "$ARN_CONEXION" \
  --region "$REGION" --query 'Connection.ConnectionStatus' --output text)"

if [ "$ESTADO_CONEXION" != "AVAILABLE" ]; then
  cat <<EOF

    \033[1;33mACCION MANUAL REQUERIDA\033[0m

    La conexion esta en estado $ESTADO_CONEXION. Una conexion con GitHub
    exige autorizacion por OAuth, que no puede hacerse desde la CLI.

    1. Abra la consola de AWS -> Developer Tools -> Settings -> Connections
    2. Seleccione '$CONEXION' y pulse 'Update pending connection'
    3. Autorice AWS Connector for GitHub y elija el repositorio
    4. Vuelva a ejecutar este script

EOF
  exit 1
fi
ok "Conexion en estado AVAILABLE"

# ---------------------------------------------------------------------------
titulo "3/7 Rol de CodeBuild"
if aws iam get-role --role-name "$ROL_BUILD" >/dev/null 2>&1; then
  ok "El rol $ROL_BUILD ya existe"
else
  aws iam create-role --role-name "$ROL_BUILD" \
    --assume-role-policy-document "file://$(render confianza-codebuild.json)" \
    --description "Rol que CodeBuild asume para construir y publicar la imagen" >/dev/null
  ok "Rol $ROL_BUILD creado"
  sleep 10
fi
aws iam put-role-policy --role-name "$ROL_BUILD" \
  --policy-name "politica-construccion" \
  --policy-document "file://$(render politica-codebuild.json)"
ok "Politica de menor privilegio adjunta"

# ---------------------------------------------------------------------------
titulo "4/7 Proyecto de CodeBuild"
jq -n --arg nombre "$PROYECTO_BUILD" \
      --arg rol "arn:aws:iam::$ID_CUENTA:role/$ROL_BUILD" '
{
  name: $nombre,
  description: "Construye la imagen de la API de estudiantes y la publica en ECR",
  source: { type: "CODEPIPELINE", buildspec: "buildspec.yml" },
  artifacts: { type: "CODEPIPELINE" },
  environment: {
    type: "LINUX_CONTAINER",
    image: "aws/codebuild/amazonlinux2-x86_64-standard:5.0",
    computeType: "BUILD_GENERAL1_SMALL",
    privilegedMode: true
  },
  serviceRole: $rol,
  timeoutInMinutes: 20
}' > "$GENERADO/proyecto-build.json"
# privilegedMode es imprescindible: sin el no hay demonio de Docker dentro
# del contenedor de compilacion y 'docker build' falla.

if aws codebuild batch-get-projects --names "$PROYECTO_BUILD" --region "$REGION" \
    --query 'projects[0].name' --output text 2>/dev/null | grep -q "$PROYECTO_BUILD"; then
  aws codebuild update-project --region "$REGION" \
    --cli-input-json "file://$GENERADO/proyecto-build.json" >/dev/null
  ok "Proyecto $PROYECTO_BUILD actualizado"
else
  aws codebuild create-project --region "$REGION" \
    --cli-input-json "file://$GENERADO/proyecto-build.json" >/dev/null
  ok "Proyecto $PROYECTO_BUILD creado (modo privilegiado, imagen Amazon Linux 2)"
fi

# ---------------------------------------------------------------------------
titulo "5/7 Rol de CodePipeline"
if aws iam get-role --role-name "$ROL_PIPELINE" >/dev/null 2>&1; then
  ok "El rol $ROL_PIPELINE ya existe"
else
  aws iam create-role --role-name "$ROL_PIPELINE" \
    --assume-role-policy-document "file://$(render confianza-codepipeline.json)" \
    --description "Rol que CodePipeline asume para orquestar las etapas" >/dev/null
  ok "Rol $ROL_PIPELINE creado"
  sleep 10
fi
aws iam put-role-policy --role-name "$ROL_PIPELINE" \
  --policy-name "politica-orquestacion" \
  --policy-document "file://$(render politica-codepipeline.json)"
ok "Politica de menor privilegio adjunta"

# ---------------------------------------------------------------------------
titulo "6/7 Definicion del pipeline"
jq -n \
  --arg pipeline "$PIPELINE" \
  --arg rol "arn:aws:iam::$ID_CUENTA:role/$ROL_PIPELINE" \
  --arg bucket "$BUCKET_ARTEFACTOS" \
  --arg conexion "$ARN_CONEXION" \
  --arg repo "$USUARIO_GITHUB/$REPO_GITHUB" \
  --arg rama "$RAMA" \
  --arg proyecto "$PROYECTO_BUILD" \
  --arg cluster "$CLUSTER" \
  --arg servicio "$SERVICIO_ECS" '
{
  pipeline: {
    name: $pipeline,
    roleArn: $rol,
    pipelineType: "V2",
    artifactStore: { type: "S3", location: $bucket },
    stages: [
      {
        name: "Fuente",
        actions: [{
          name: "DescargarDesdeGitHub",
          actionTypeId: { category: "Source", owner: "AWS", provider: "CodeStarSourceConnection", version: "1" },
          configuration: {
            ConnectionArn: $conexion,
            FullRepositoryId: $repo,
            BranchName: $rama,
            DetectChanges: "true"
          },
          outputArtifacts: [{ name: "CodigoFuente" }],
          runOrder: 1
        }]
      },
      {
        name: "Construccion",
        actions: [{
          name: "CompilarYPublicarImagen",
          actionTypeId: { category: "Build", owner: "AWS", provider: "CodeBuild", version: "1" },
          configuration: { ProjectName: $proyecto },
          inputArtifacts: [{ name: "CodigoFuente" }],
          outputArtifacts: [{ name: "DefinicionImagen" }],
          runOrder: 1
        }]
      },
      {
        name: "Despliegue",
        actions: [{
          name: "ActualizarServicioEcs",
          actionTypeId: { category: "Deploy", owner: "AWS", provider: "ECS", version: "1" },
          configuration: {
            ClusterName: $cluster,
            ServiceName: $servicio,
            FileName: "imagedefinitions.json",
            DeploymentTimeout: "10"
          },
          inputArtifacts: [{ name: "DefinicionImagen" }],
          runOrder: 1
        }]
      }
    ],
    triggers: [
      {
        providerType: "CodeStarSourceConnection",
        gitConfiguration: {
          sourceActionName: "DescargarDesdeGitHub",
          push: [ { branches: { includes: [$rama] } } ]
        }
      }
    ]
  }
}' > "$GENERADO/pipeline.json"

if aws codepipeline get-pipeline --name "$PIPELINE" --region "$REGION" >/dev/null 2>&1; then
  aws codepipeline update-pipeline --region "$REGION" \
    --cli-input-json "file://$GENERADO/pipeline.json" >/dev/null
  ok "Pipeline $PIPELINE actualizado"
else
  aws codepipeline create-pipeline --region "$REGION" \
    --cli-input-json "file://$GENERADO/pipeline.json" >/dev/null
  ok "Pipeline $PIPELINE creado con tres etapas"
fi

# ---------------------------------------------------------------------------
titulo "7/7 Primera ejecucion"
EJECUCION="$(aws codepipeline start-pipeline-execution --name "$PIPELINE" \
  --region "$REGION" --query 'pipelineExecutionId' --output text)"
ok "Ejecucion lanzada: $EJECUCION"

titulo "Pipeline creado"
cat <<EOF

  Cuenta ............ $ID_CUENTA
  Repositorio ....... $USUARIO_GITHUB/$REPO_GITHUB (rama $RAMA)
  Conexion .......... $CONEXION
  Proyecto build .... $PROYECTO_BUILD
  Pipeline .......... $PIPELINE
  Despliegue ........ $CLUSTER / $SERVICIO_ECS
  Artefactos ........ s3://$BUCKET_ARTEFACTOS

  Siga la ejecucion con:
    aws codepipeline get-pipeline-state --name $PIPELINE --region $REGION \\
      --query 'stageStates[].{Etapa:stageName,Estado:latestExecution.status}' --output table

  O en la consola: CodePipeline -> Pipelines -> $PIPELINE

  Para probar el disparo automatico, haga un commit y un push a la rama $RAMA.

EOF
