@echo off
rem Inicia o Agente de Impressao do SalesTrack.
rem Na primeira execucao cria o ambiente Python (.venv) e instala as dependencias.
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo Preparando o ambiente do agente pela primeira vez...
    py -3 -m venv .venv 2>nul || python -m venv .venv
)
if not exist ".venv\Scripts\python.exe" goto erro

rem Sem mudanca no requirements.txt isto nao baixa nada (e funciona sem internet)
".venv\Scripts\python.exe" -m pip install --quiet --disable-pip-version-check -r requirements.txt
if errorlevel 1 goto erro

".venv\Scripts\python.exe" agente.py
goto fim

:erro
echo.
echo Nao foi possivel preparar o agente de impressao.
echo Confira se o Python 3 esta instalado (https://www.python.org/downloads/)
echo e se ha internet na primeira execucao.
pause

:fim
