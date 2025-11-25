@echo off
REM This script sets up and runs the Python backend server.

echo [INFO] Navigating to the backend directory...
cd backend

REM Check if the virtual environment directory exists
IF NOT EXIST venv (
    echo [INFO] Virtual environment not found. Creating one...
    python -m venv venv
    IF %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to create virtual environment. Please ensure Python is installed and in your PATH.
        goto :eof
    )
)

echo [INFO] Activating virtual environment...
call .\venv\Scripts\activate

echo [INFO] Setting PYTHONPATH to allow absolute imports...
set PYTHONPATH=%CD%

echo [INFO] Installing required packages from requirements.txt...
pip install -r requirements.txt
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install pip packages.
    goto :eof
)

echo [INFO] Downloading necessary NLTK data (punkt, stopwords)...
python -c "import nltk; nltk.download('punkt'); nltk.download('stopwords')"
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to download NLTK data.
    goto :eof
)


echo [SUCCESS] Setup complete.
echo [INFO] Starting FastAPI server with uvicorn...
echo [INFO] Press CTRL+C in this window to stop the server.
echo ----------------------------------------------------

uvicorn main:app --reload

:eof
echo.

echo Server stopped or failed to start.
pause
