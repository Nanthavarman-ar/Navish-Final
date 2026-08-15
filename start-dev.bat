@echo off
echo Starting Naviz Development Environment...
echo.

REM Start the signaling server in background
echo Starting Socket.io signaling server on port 3001...
start "Naviz Server" cmd /k "cd /d server && npm start"

REM Wait a moment for server to start
timeout /t 3 /nobreak > nul

REM Start the frontend development server
echo Starting Vite development server on port 3000...
echo.
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:3001
echo.
npm run dev