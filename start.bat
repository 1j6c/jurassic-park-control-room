@echo off
REM Jurassic Park System Control — Windows launcher: local server + Chrome/Edge in kiosk mode.
setlocal
cd /d "%~dp0"
set PORT=8765
where python >nul 2>&1 || (echo Python 3 is required ^(https://www.python.org/downloads/^) & pause & exit /b 1)
start "jp-server" /min python -m http.server %PORT% --bind 127.0.0.1
timeout /t 1 /nobreak >nul
set PROFILE=%TEMP%\jp-control-room-profile
set FLAGS=--user-data-dir="%PROFILE%" --no-first-run --no-default-browser-check --kiosk --autoplay-policy=no-user-gesture-required http://localhost:%PORT%/
for %%B in ("%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%LocalAppData%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe") do (
  if exist %%B ( %%B %FLAGS% & goto :done )
)
echo No Chrome/Edge found - opening in the default browser. Full screen: Toolchest ^> System ^> Full screen.
start http://localhost:%PORT%/
pause
:done
taskkill /fi "WINDOWTITLE eq jp-server*" >nul 2>&1
endlocal
