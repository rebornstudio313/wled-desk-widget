@echo off
setlocal
cd /d "%~dp0"
set "WIDGET_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "WIDGET_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
"%WIDGET_NODE%" scripts\launch-preview.mjs
if errorlevel 1 pause
