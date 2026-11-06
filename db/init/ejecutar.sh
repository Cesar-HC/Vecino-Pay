#!/bin/bash
# Ejecuta en orden todos los .sql de db/init contra el contenedor "db".
set -e
SQLCMD=/opt/mssql-tools18/bin/sqlcmd
for archivo in /db/init/*.sql; do
  echo "Ejecutando $archivo"
  "$SQLCMD" -S db -U sa -P "$MSSQL_SA_PASSWORD" -C -b -I -f 65001 -i "$archivo"
done
echo "Scripts de base de datos aplicados."
