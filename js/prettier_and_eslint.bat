@echo off

setlocal
prompt $G$S
title check

echo on
call prettier tatt_str.js --write
call eslint tatt_str.js --fix
pause
