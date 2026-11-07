@echo off
chcp 65001 >nul
title Кабинет заказчика
cd /d "%~dp0"
rem Node.js, если установлен; иначе среда из установленного «Пульта главспеца».
where node >nul 2>nul
if %errorlevel%==0 (
  node cabinet-server.js
) else if exist "%LOCALAPPDATA%\Programs\PultGlavspeca\PultGlavspeca.exe" (
  set ELECTRON_RUN_AS_NODE=1
  "%LOCALAPPDATA%\Programs\PultGlavspeca\PultGlavspeca.exe" cabinet-server.js
) else (
  echo Не найден Node.js и не установлен «Пульт главспеца».
  echo Установите Node.js 20 или новее с https://nodejs.org ^(LTS^) и запустите снова.
)
pause
