param(
	[string]$Server = "root@72.60.55.235",
	[string]$RemoteDir = "/root/pf-control-web",
	[string]$DbName = "pf_control",
	[string]$DbUser = "pf_user",
	[Parameter(Mandatory = $true)]
	[string]$DbPassword,
	[string]$DbHost = "127.0.0.1",
	[int]$DbPort = 5432
)

$ErrorActionPreference = "Stop"

function Escape-SingleQuotes([string]$Value) {
	return $Value -replace "'", "''"
}

$dbNameSql = Escape-SingleQuotes $DbName
$dbUserSql = Escape-SingleQuotes $DbUser
$dbPasswordSql = Escape-SingleQuotes $DbPassword

$databaseUrl = "postgresql://$DbUser`:$DbPassword@$DbHost`:$DbPort/$DbName"

$remoteScript = @"
set -e
export DEBIAN_FRONTEND=noninteractive

if ! command -v psql >/dev/null 2>&1; then
	apt-get update
	apt-get install -y postgresql postgresql-contrib
fi

systemctl enable postgresql
systemctl start postgresql

sudo -u postgres psql <<'SQL'
DO
\$\$
BEGIN
	IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$dbUserSql') THEN
		EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', '$dbUserSql', '$dbPasswordSql');
	ELSE
		EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', '$dbUserSql', '$dbPasswordSql');
	END IF;
END
\$\$;

DO
\$\$
BEGIN
	IF NOT EXISTS (SELECT FROM pg_database WHERE datname = '$dbNameSql') THEN
		EXECUTE format('CREATE DATABASE %I', '$dbNameSql');
	END IF;
END
\$\$;

EXECUTE format('GRANT ALL PRIVILEGES ON DATABASE %I TO %I', '$dbNameSql', '$dbUserSql');
SQL

mkdir -p "$RemoteDir"
cat > "$RemoteDir/.db.env" <<'ENVFILE'
export DATABASE_URL='$databaseUrl'
ENVFILE

if [ -f "$RemoteDir/package.json" ]; then
	cd "$RemoteDir"
	set -a
	. ./.db.env
	set +a
	npm run db:push || true
	if pm2 describe pf-control-web >/dev/null 2>&1; then
		pm2 restart pf-control-web --update-env
		pm2 save
	fi
fi

echo "PostgreSQL listo. DATABASE_URL guardada en $RemoteDir/.db.env"
"@

Write-Host "[1/1] Instalando PostgreSQL y guardando DATABASE_URL en el VPS..."
ssh $Server $remoteScript
if ($LASTEXITCODE -ne 0) {
	throw "Fallo la configuracion remota de PostgreSQL."
}

Write-Host "Configuracion PostgreSQL completada."
