@echo off
set DATABASE_URL=postgresql://postgres:cencom_pass_2026_prod_2026@localhost:54322/cencom_os
cd /d E:\APP-LAPTOP-SYNC\cencomOS_gara_4.0_supa\UAT
node _start-dev.mjs >> _app.out.log 2>> _app.err.log
