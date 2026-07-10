@echo off
setlocal
cd /d "%~dp0"
echo.
echo Handover App for iPhone
echo -----------------------
echo Keep this window open while using the app on your iPhone.
echo.
echo Your iPhone and this PC must be on the same Wi-Fi.
echo Open Safari on iPhone and use the Wi-Fi IPv4 URL shown below:
echo.
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /C:"IPv4 Address"') do (
  for /f "tokens=* delims= " %%B in ("%%A") do echo http://%%B:4175
)
echo.
echo If Windows asks about network access, allow Private networks.
echo.
"C:\Users\Guy Nguyen\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -m http.server 4175 --bind 0.0.0.0
pause
