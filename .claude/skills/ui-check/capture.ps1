# Memo 界面测试：在 Windows 侧启动一个「调试实例」，按指定时间点截取窗口，再只关掉这个实例。
# 由 ui-check.sh 调用；也可以单独运行：
#   powershell -NoProfile -ExecutionPolicy Bypass -File capture.ps1 -Project D:\...\desktop-todo -DataDir ...\.testdata -Out ...\shots -Shots 5
param(
    [Parameter(Mandatory)] [string] $Project,
    [Parameter(Mandatory)] [string] $DataDir,
    [Parameter(Mandatory)] [string] $Out,
    [string] $Eval = '',
    [string] $Shots = '5',      # 逗号分隔的秒数（从启动算起），如 "4,14"
    [double] $Scale = 0.5       # 截图缩放（高 DPI 屏原图很大，默认缩一半）
)
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class W32 {
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@
[W32]::SetProcessDPIAware() | Out-Null   # 拿物理像素坐标，和 CopyFromScreen 一致

$electron = Join-Path $Project 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path $electron)) { throw "electron.exe not found: $electron (先在 Windows 侧 npm install)" }
New-Item -ItemType Directory -Force -Path $Out | Out-Null

$fgBefore = [W32]::GetForegroundWindow()
$t0 = Get-Date
$env:TODO_DATA_DIR = $DataDir
$env:TODO_DEBUG_EVAL = $Eval
$proc = Start-Process -FilePath $electron -ArgumentList "`"$Project`"" -PassThru

function Get-TestInstances {
    # 只认本项目、且在本次启动之后创建的 electron 进程 —— 绝不误伤正在用的真实 Memo
    Get-Process electron -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -like "$Project*" -and $_.StartTime -ge $t0.AddSeconds(-1) }
}

try {
    $times = $Shots.Split(',') | ForEach-Object { [double]$_.Trim() } | Sort-Object
    $i = 0
    $script:main = $null
    foreach ($t in $times) {
        $i++
        $wait = $t - ((Get-Date) - $t0).TotalSeconds
        if ($wait -gt 0) { Start-Sleep -Milliseconds ([int]($wait * 1000)) }

        # 主窗口句柄只认一次：MainWindowHandle 可能漂到 tooltip 之类的小窗口上
        if (-not $script:main) {
            $cands = @($proc) + @(Get-TestInstances)
            foreach ($p in $cands) {
                $p.Refresh(); $hc = $p.MainWindowHandle
                if ($hc -eq [IntPtr]::Zero) { continue }
                $rc = New-Object W32+RECT
                [W32]::GetWindowRect($hc, [ref]$rc) | Out-Null
                if (($rc.R - $rc.L) -ge 200) { $script:main = $hc; break }
            }
        }
        if (-not $script:main) { Write-Output "SHOT $i FAIL: window not found at ${t}s"; continue }

        $r = New-Object W32+RECT
        [W32]::GetWindowRect($script:main, [ref]$r) | Out-Null
        $w = $r.R - $r.L; $hh = $r.B - $r.T
        $bmp = New-Object System.Drawing.Bitmap $w, $hh
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.CopyFromScreen($r.L, $r.T, 0, 0, $bmp.Size)
        $outBmp = New-Object System.Drawing.Bitmap $bmp, ([int]($w * $Scale)), ([int]($hh * $Scale))
        $file = Join-Path $Out ("shot{0}.png" -f $i)
        $outBmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
        $g.Dispose(); $bmp.Dispose(); $outBmp.Dispose()
        Write-Output "SHOT $i OK ${t}s $file"
    }
    $fgAfter = [W32]::GetForegroundWindow()
    Write-Output ("FOCUS " + $(if ($fgAfter -eq $fgBefore) { 'unchanged' } else { 'CHANGED (test window may have taken keyboard focus)' }))
}
finally {
    Get-TestInstances | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Output "CLEANUP test instance stopped"
}
