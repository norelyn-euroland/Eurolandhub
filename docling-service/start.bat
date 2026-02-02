@echo off
REM Quick start script for Docling service (Windows)

echo 🚀 Starting Docling Document Parsing Service...

REM Check if virtual environment exists
if not exist "venv" (
    echo 📦 Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
echo 🔧 Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo 📥 Installing dependencies...
pip install -r requirements.txt

REM Check if Docling is installed
python -c "import docling" 2>nul
if errorlevel 1 (
    echo ⚠️  Warning: Docling may not be installed correctly
    echo    Run: pip install docling
)

REM Start the service
echo ✅ Starting service on http://localhost:8000
echo    Health check: http://localhost:8000/health
echo.
python main.py


