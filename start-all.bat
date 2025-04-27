@echo off
echo Starting ServiceSathi components in separate windows...

REM Start Akshaya Portal
echo Starting Akshaya Portal (localhost:5601)...
start "Akshaya Portal" cmd /k "cd akshaya-portal && echo Running Akshaya Portal... && node server.js"

REM Wait a moment for the first window to potentially initialize
timeout /t 2 /nobreak > nul

REM Start WhatsApp Bot Server
echo Starting WhatsApp Bot Server (localhost:5600)...
start "WhatsApp Bot" cmd /k "cd WhatsAppBotServer && echo Running WhatsApp Bot Server... && node server.js"

REM Wait a moment for the first window to potentially initialize
timeout /t 2 /nobreak > nul

REM Start WhatsApp Chat Server
echo Starting WhatsApp Chat Server (localhost:3030)...
start "WhatsApp Chat Bot" cmd /k "cd WhatsAppBotServer && echo Running WhatsApp Chat Server... && node chatScreenServer.js"

REM Wait a moment
timeout /t 2 /nobreak > nul

REM Start Status Monitor
echo Starting Status Monitor...
start "Status Monitor" cmd /k "echo Running Status Monitor... && node status-monitor.js"

echo All components launched. Check the individual windows for logs.
