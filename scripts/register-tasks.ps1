# Задания Планировщика Windows для сборщиков почты и новостей.
# Запуск: pwsh -File scripts\register-tasks.ps1 (повторный запуск перезаписывает задания).
# Окно консоли не появляется: команды идут через conhost --headless.
# Двоеточие в имени задания Windows не допускает, поэтому имена через тире.

$root = Split-Path -Parent $PSScriptRoot
New-Item -ItemType Directory -Force (Join-Path $root 'logs') | Out-Null

# Пропущенный из-за сна запуск выполнится при пробуждении; второй экземпляр не стартует, пока идёт первый.
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 20) -MultipleInstances IgnoreNew

$jobs = @(
  @{ Name = 'Органайзер — почта'; Script = 'mail'; Minutes = 30; Desc = 'Сбор писем по IMAP в Supabase. Журнал: logs\mail.log' },
  @{ Name = 'Органайзер — новости'; Script = 'news'; Minutes = 120; Desc = 'Сбор новостей по RSS в Supabase. Журнал: logs\news.log' }
)

foreach ($job in $jobs) {
  $command = "cd /d `"$root`" && npm run $($job.Script) >> logs\$($job.Script).log 2>&1"
  $action = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument "--headless cmd.exe /c `"$command`"" -WorkingDirectory $root
  $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes $job.Minutes)
  Register-ScheduledTask -TaskName $job.Name -Action $action -Trigger $trigger -Settings $settings -Description $job.Desc -Force | Out-Null
  Write-Output "$($job.Name): каждые $($job.Minutes) мин"
}
