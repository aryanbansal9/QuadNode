@echo off
TITLE QuadNode Enterprise Edge AI Startup Suite
color 0A
echo ========================================================
echo       Starting QuadNode Enterprise Edge AI System       
echo ========================================================

:: 1. Start Ollama Service in background
echo [+] Initializing Ollama local LLM daemon...
start /b ollama serve >nul 2>&1
timeout /t 3 /nobreak >nul

:: 2. Activate Python Virtual Environment and Start FastAPI
echo [+] Activating Python Virtual Environment & Starting FastAPI...
cd /d "%~dp0"
call venv\Scripts\activate

echo [+] Launching Uvicorn Server on http://127.0.0.1:8000...
start cmd /k "call venv\Scripts\activate && python -m uvicorn backend.main:app --reload"

echo ========================================================
echo          System Ready & Endpoints Online!             
echo ========================================================
pause