@echo off
setlocal enabledelayedexpansion

title Xplitrade

:: Find Python
set PYTHON=
for %%P in (python3 python) do (
    where %%P >nul 2>&1 && set PYTHON=%%P && goto :found_python
)
echo [ERROR] Python not found. Please install Python 3.11+ from python.org
pause
exit /b 1
:found_python

:: Resolve install dir from script location
set INSTALL_DIR=%~dp0
if "%INSTALL_DIR:~-1%"=="\" set INSTALL_DIR=%INSTALL_DIR:~0,-1%

:: Launch bot or open UI
set /p CHOICE="Launch mode: [1] Trade (dry-run)  [2] Web UI only  Enter 1 or 2: "
if "%CHOICE%"=="2" goto :webserver

echo.
echo Starting Xplitrade in dry-run mode...
echo Dashboard: http://127.0.0.1:8080
echo.
%PYTHON% -m xplitrade trade --config "%INSTALL_DIR%\config\config.json"
goto :done

:webserver
echo.
echo Starting Xplitrade Web UI...
echo Dashboard: http://127.0.0.1:8080
echo.
%PYTHON% -m xplitrade webserver --config "%INSTALL_DIR%\config\config.json"

:done
pause
