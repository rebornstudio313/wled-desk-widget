$ErrorActionPreference='Stop'
& (Join-Path $PSScriptRoot 'single-instance-smoke.ps1')
$binary=Join-Path (Get-Location) 'release-local\wled-desk-widget.exe'
$startupFile=Join-Path $env:APPDATA 'io.wleddesk.app\startup.json'
$original=if(Test-Path -LiteralPath $startupFile){[IO.File]::ReadAllBytes($startupFile)}else{$null}
try{
 Get-Process -Name wled-desk-widget | Where-Object {$_.Path -eq $binary} | Stop-Process
 [IO.File]::WriteAllText($startupFile,'{"startHidden":true}')
 $process=Start-Process -FilePath $binary -ArgumentList '--autostart' -PassThru
 for($i=0;$i -lt 150;$i++){if([WidgetWindows]::Find($process.Id) -ne [IntPtr]::Zero){break};Start-Sleep -Milliseconds 100}
 $handle=[WidgetWindows]::Find($process.Id)
 if($handle -eq [IntPtr]::Zero){throw 'Autostart did not create its window'}
 Start-Sleep -Milliseconds 500
 if([WidgetWindows]::IsWindowVisible($handle)){throw 'Start-in-tray preference did not hide the window'}
 $second=Start-Process -FilePath $binary -PassThru -WindowStyle Hidden
 if(-not $second.WaitForExit(15000)){throw 'Second startup process did not exit'}
 for($i=0;$i -lt 50 -and -not [WidgetWindows]::IsWindowVisible($handle);$i++){Start-Sleep -Milliseconds 100}
 if(-not [WidgetWindows]::IsWindowVisible($handle)){throw 'Normal launch did not restore the autostart window'}
 Write-Output 'Startup passed: --autostart starts hidden when requested; regular relaunch shows the same process. No user registry setting changed.'
}finally{
 if($null -ne $original){[IO.File]::WriteAllBytes($startupFile,$original)}else{Remove-Item -LiteralPath $startupFile -ErrorAction SilentlyContinue}
}
