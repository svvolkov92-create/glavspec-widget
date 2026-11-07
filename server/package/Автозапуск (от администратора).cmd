@echo off
chcp 65001 >nul
rem Регистрирует сервер в Планировщике заданий: запуск при включении компьютера, без входа пользователя.
rem Запускать правой кнопкой → «Запуск от имени администратора».
net session >nul 2>nul
if not %errorlevel%==0 (
  echo Нужны права администратора: правой кнопкой по файлу → «Запуск от имени администратора».
  pause
  exit /b 1
)
cd /d "%~dp0"
set RUNNER=
for /f "delims=" %%i in ('where node 2^>nul') do if not defined RUNNER set RUNNER=%%i
if not defined RUNNER (
  echo Для автозапуска нужен Node.js 20+ ^(https://nodejs.org, LTS^): служба работает без входа пользователя,
  echo а «Пульт» установлен только для одного пользователя.
  pause
  exit /b 1
)
set PORT=8080
if exist config.json for /f "tokens=2 delims=:, " %%p in ('findstr /c:"\"port\"" config.json') do set PORT=%%p
schtasks /Create /TN "Кабинет заказчика" /SC ONSTART /RU SYSTEM /F /TR "\"%RUNNER%\" \"%~dp0cabinet-server.js\""
netsh advfirewall firewall delete rule name="Кабинет заказчика" >nul 2>nul
netsh advfirewall firewall add rule name="Кабинет заказчика" dir=in action=allow protocol=TCP localport=%PORT%
schtasks /Run /TN "Кабинет заказчика"
echo.
echo Готово. Сервер запущен и будет стартовать вместе с компьютером. Порт %PORT% открыт в брандмауэре.
echo Ключ команды — в файле data\cabinet.json, строка "teamKey" (или запустите «Запустить.cmd» один раз — он покажет ключ).
pause
