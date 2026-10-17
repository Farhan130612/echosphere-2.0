@echo off
title ECHOSPHERE 2.0 — Local Server
echo.
echo  Starting ECHOSPHERE 2.0 local server...
echo.
start "" /B node "%~dp0server.js"
timeout /t 1 /nobreak >nul
start "" "http://localhost:8080/"
echo  Server running at http://localhost:8080/
echo  Close this window to stop the server.
echo.
pause
