$ErrorActionPreference='Stop'
$widgetExe=Join-Path (Get-Location) 'release-local\wled-desk-widget.exe'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class WidgetWindows {
 public delegate bool EnumProc(IntPtr hwnd,IntPtr param);
 [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc callback,IntPtr param);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd,out uint processId);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hwnd,StringBuilder text,int size);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
 [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hwnd);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hwnd,uint message,IntPtr w,IntPtr l);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hwnd,int command);
 [DllImport("user32.dll",EntryPoint="GetWindowLongW")] public static extern int GetWindowLong(IntPtr hwnd,int index);
 [DllImport("user32.dll",EntryPoint="SetWindowLongW")] public static extern int SetWindowLong(IntPtr hwnd,int index,int value);
 [DllImport("user32.dll",SetLastError=true)] public static extern IntPtr SendMessageTimeout(IntPtr hwnd,uint message,IntPtr w,IntPtr l,uint flags,uint timeout,out IntPtr result);
 public static IntPtr Find(uint id){IntPtr found=IntPtr.Zero;EnumWindows((hwnd,p)=>{uint owner;GetWindowThreadProcessId(hwnd,out owner);var title=new StringBuilder(256);GetWindowText(hwnd,title,256);if(owner==id&&title.ToString()=="WLED Desk | Widget"){found=hwnd;return false;}return true;},IntPtr.Zero);return found;}
}
'@
function Wait-Until([scriptblock]$Condition,[string]$Description){for($i=0;$i -lt 150;$i++){if(& $Condition){return};Start-Sleep -Milliseconds 100};throw "Timed out: $Description"}
function Instances {@(Get-Process -Name wled-desk-widget -ErrorAction SilentlyContinue | Where-Object {$_.Path -eq $widgetExe})}
function Assert-Frame {
 $windowHandle=[WidgetWindows]::Find((Instances)[0].Id)
 $messageResult=[IntPtr]::Zero
 if([WidgetWindows]::SendMessageTimeout($windowHandle,0,[IntPtr]::Zero,[IntPtr]::Zero,2,3000,[ref]$messageResult) -eq [IntPtr]::Zero){throw 'Widget window stopped responding'}
 if(([WidgetWindows]::GetWindowLong($windowHandle,-16) -band 0x00c40000) -ne 0){throw 'Native caption/resize frame returned'}
 if(([WidgetWindows]::GetWindowLong($windowHandle,-20) -band 0x00020301) -ne 0){throw 'Native window edge returned'}
}
function Relaunch { $secondary=Start-Process -FilePath $widgetExe -PassThru -WindowStyle Hidden; if(-not $secondary.WaitForExit(15000)){throw 'Second launch did not exit'};if(@(Instances).Count -ne 1){throw 'Multiple widget processes remain'}; Start-Sleep -Milliseconds 200; Assert-Frame }
if(@(Instances).Count -eq 0){Start-Process -FilePath $widgetExe}
Wait-Until { @(Instances).Count -eq 1 } 'first instance'
$first=(Instances)[0];$firstId=$first.Id
Wait-Until { [WidgetWindows]::Find($firstId) -ne [IntPtr]::Zero } 'main window'
$handle=[WidgetWindows]::Find($firstId)
if(-not [WidgetWindows]::IsWindowVisible($handle)){Relaunch}
Wait-Until { [WidgetWindows]::IsWindowVisible($handle) } 'visible main window'
Assert-Frame
Relaunch
if((Instances)[0].Id -ne $firstId){throw 'First instance was replaced'}
[void][WidgetWindows]::PostMessage($handle,0x10,[IntPtr]::Zero,[IntPtr]::Zero)
Wait-Until { -not [WidgetWindows]::IsWindowVisible($handle) } 'close hides in tray'
Relaunch
Wait-Until { [WidgetWindows]::IsWindowVisible($handle) } 'relaunch restores hidden window'
[void][WidgetWindows]::ShowWindow($handle,6)
Wait-Until { [WidgetWindows]::IsIconic($handle) } 'minimized window'
Relaunch
Wait-Until { -not [WidgetWindows]::IsIconic($handle) -and [WidgetWindows]::IsWindowVisible($handle) } 'relaunch restores minimized window'
$launches=@(1..3 | ForEach-Object {Start-Process -FilePath $widgetExe -PassThru -WindowStyle Hidden})
foreach($secondary in $launches){if(-not $secondary.WaitForExit(15000)){throw 'Burst launch did not exit'}}
Wait-Until { @(Instances).Count -eq 1 } 'one process after burst'
if((Instances)[0].Id -ne $firstId){throw 'Burst replaced the first instance'}
Assert-Frame
# Tao can rebuild the native styles during a restore/pin operation. Verify the
# guard rejects those decoration bits before Windows applies them.
[void][WidgetWindows]::SetWindowLong($handle,-16,([WidgetWindows]::GetWindowLong($handle,-16) -bor 0x00c40000))
[void][WidgetWindows]::SetWindowLong($handle,-20,([WidgetWindows]::GetWindowLong($handle,-20) -bor 0x00020301))
Assert-Frame
Write-Output 'Single instance and frame guard passed: duplicate exit, same process retained, hidden and minimized window restored, three simultaneous launches leave one widget.'
