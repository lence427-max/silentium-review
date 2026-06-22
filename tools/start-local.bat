@echo off
chcp 65001 >nul
setlocal

set "PROJECT_DIR=%~dp0.."
pushd "%PROJECT_DIR%"

echo.
echo Silentium Review / 静研录 本地启动
echo 项目目录：%CD%
echo.

if not exist "node_modules\" (
  echo 正在安装依赖，请稍等……
  npm.cmd install
  if errorlevel 1 (
    echo.
    echo 依赖安装失败，请检查 Node.js / npm 是否可用。
    pause
    popd
    exit /b 1
  )
  echo.
)

echo 正在启动本地开发服务器……
echo 默认会打开：http://127.0.0.1:5173/
echo 如果浏览器打不开，请看命令窗口里 Vite 显示的 Local 地址。
echo 关闭这个命令窗口即可停止本地服务。
echo.

start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:5173/'"
npm.cmd run dev -- --host 127.0.0.1

echo.
echo 本地服务已停止。
pause
popd
