$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'single-instance-smoke.ps1')
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class WidgetMotion {
 [DllImport("gdi32.dll")] public static extern IntPtr CreateRectRgn(int left,int top,int right,int bottom);
 [DllImport("user32.dll")] public static extern int GetWindowRgn(IntPtr hwnd,IntPtr region);
 [DllImport("gdi32.dll")] public static extern bool PtInRegion(IntPtr region,int x,int y);
 [DllImport("gdi32.dll")] public static extern bool DeleteObject(IntPtr value);

 [StructLayout(LayoutKind.Sequential)] public struct Rect {public int Left,Top,Right,Bottom;}
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd,out Rect rect);
 [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hwnd,IntPtr after,int x,int y,int width,int height,uint flags);
 [DllImport("user32.dll",EntryPoint="GetWindowLongW")] public static extern int GetWindowLong(IntPtr hwnd,int index);
}
'@
$widgetExe=Join-Path (Get-Location) 'release-local\wled-desk-widget.exe'
$owner=Get-Process -Name wled-desk-widget | Where-Object {$_.Path -eq $widgetExe} | Select-Object -First 1
$handle=[WidgetWindows]::Find($owner.Id)
$rect=New-Object WidgetMotion+Rect
[void][WidgetMotion]::GetWindowRect($handle,[ref]$rect)
$style=[WidgetMotion]::GetWindowLong($handle,-16)
if(($style -band 0x00c00000) -ne 0 -or ($style -band 0x00040000) -ne 0){throw 'Native title bar or resize border returned'}
$region=[WidgetMotion]::CreateRectRgn(0,0,0,0)
try {
 if([WidgetMotion]::GetWindowRgn($handle,$region) -le 0){throw 'Native rounded region missing'}
 if([WidgetMotion]::PtInRegion($region,0,0)){throw 'Native corner is not clipped'}
 if(-not [WidgetMotion]::PtInRegion($region,40,40)){throw 'Native region clips the widget body'}
}finally{[void][WidgetMotion]::DeleteObject($region)}
$watch=[Diagnostics.Stopwatch]::StartNew()
try{
 for($index=0;$index -lt 40;$index++){
  if(-not [WidgetMotion]::SetWindowPos($handle,[IntPtr]::Zero,($rect.Left+($index%2)*6),($rect.Top+($index%2)*4),0,0,0x15)){throw 'Window move failed'}
 }
 $watch.Stop()
 Wait-Until {
  $positionValue=Get-Content -LiteralPath (Join-Path $env:APPDATA 'io.wleddesk.app\window-position.json') -Raw | ConvertFrom-Json
  $positionRect=New-Object WidgetMotion+Rect
  [void][WidgetMotion]::GetWindowRect($handle,[ref]$positionRect)
  $positionValue.x -eq $positionRect.Left -and $positionValue.y -eq $positionRect.Top
 } 'position persisted after final move'
 $saved=Get-Content -LiteralPath (Join-Path $env:APPDATA 'io.wleddesk.app\window-position.json') -Raw | ConvertFrom-Json
 $current=New-Object WidgetMotion+Rect
 [void][WidgetMotion]::GetWindowRect($handle,[ref]$current)
 if($saved.x -ne $current.Left -or $saved.y -ne $current.Top){throw 'Final position was not saved after moving'}
 Write-Output ('Window motion passed: no caption/resize border, 40 moves in '+$watch.ElapsedMilliseconds+' ms, final position persisted.')
}finally{
 [void][WidgetMotion]::SetWindowPos($handle,[IntPtr]::Zero,$rect.Left,$rect.Top,0,0,0x15)
}
