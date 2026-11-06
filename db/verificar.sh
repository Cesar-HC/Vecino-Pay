#!/bin/bash
# Verifica las semillas contra el informe. Sale con código distinto de 0 si algo no coincide.
set -e
/opt/mssql-tools18/bin/sqlcmd -S db -U sa -P "$MSSQL_SA_PASSWORD" -C -b -I -f 65001 -i /db/verificar_semillas.sql
