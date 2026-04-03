@echo off
title ServiceSathi Launcher
echo ==========================================
echo        ServiceSathi - Starting Up
echo ==========================================
echo.

REM Start Akshaya Portal
echo [1/2] Starting Akshaya Portal (localhost:5601)...
start "Akshaya Portal" cmd /k "cd /d %~dp0akshaya-portal && node server.js"

timeout /t 2 /nobreak > nul

REM Start WhatsApp Bot Server
echo [2/2] Starting WhatsApp Bot Server (localhost:5600)...
start "WhatsApp Bot Server" cmd /k "cd /d %~dp0whatsapp-bot-server && node server.js"

echo.
echo ==========================================
echo   Both servers launched successfully!
echo.
echo   Akshaya Portal:       http://localhost:5601
echo   WhatsApp Bot Server:  http://localhost:5600
echo ==========================================
echo.
echo Close this window or press any key to exit.
pause > nul
