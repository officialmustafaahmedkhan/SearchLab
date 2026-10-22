@echo off
REM ===========================================================================
REM  SearchLab - local launcher
REM ===========================================================================
REM  Double-click this file to start BOTH servers:
REM
REM    1. the Python execution engine   http://127.0.0.1:8000
REM    2. the React frontend            http://localhost:5173
REM
REM  Two separate windows open, so you can see each server's output and stop
REM  either one on its own with Ctrl+C. Close a window to stop that server.
REM
REM  Then open http://localhost:5173 in your browser.
REM
REM  Note: use `localhost`, not `127.0.0.1`, for the frontend. Both work, but
REM  `localhost` is what the dev server prints.
REM ===========================================================================

setlocal
cd /d "%~dp0"

echo.
echo ==========================================================
echo   SearchLab - starting local servers
echo ==========================================================
echo.
echo   Engine   : http://127.0.0.1:8000
echo   Frontend : http://localhost:5173
echo.
echo   Two windows will open. Close a window to stop that server.
echo.

REM --- Sanity checks -------------------------------------------------------
where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python was not found on your PATH.
    echo         Install Python, or make sure it is on PATH, then retry.
    echo.
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm was not found on your PATH.
    echo         Install Node.js from https://nodejs.org, then retry.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo [SETUP] node_modules is missing - running "npm install" first...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] "npm install" failed. See the messages above.
        pause
        exit /b 1
    )
    echo.
)

REM --- Start the Python engine in its own window ---------------------------
echo [1/2] Starting the Python engine...
start "SearchLab Engine" cmd /k "cd /d "%~dp0" && python python_engine.py"

REM Give the engine a moment to bind port 8000 before the UI loads.
timeout /t 3 /nobreak >nul

REM --- Start the frontend dev server in its own window ---------------------
echo [2/2] Starting the frontend dev server...
start "SearchLab Frontend" cmd /k "cd /d "%~dp0" && npm run dev"

REM --- Verify the engine came up ------------------------------------------
echo.
echo Waiting for the engine to respond...
timeout /t 5 /nobreak >nul

where curl >nul 2>nul
if not errorlevel 1 (
    curl -s -o nul -w "" http://127.0.0.1:8000/health 2>nul
    if errorlevel 1 (
        echo [WARN] The engine is not responding yet.
        echo        Check the "SearchLab Engine" window for errors.
    ) else (
        echo [OK] Engine is running.
    )
)

echo.
echo ==========================================================
echo   Ready.  Open:  http://localhost:5173
echo ==========================================================
echo.
echo   Keep both server windows open while you work.
echo   Press any key to close THIS window (the servers keep running).
echo.
pause >nul
endlocal
