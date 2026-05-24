import { execFile } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export function getAccessInfo(config) {
  const urls = getLanAddresses().map((address) => `http://${address}:${config.port}`);
  return {
    primaryUrl: urls[0] || `http://localhost:${config.port}`,
    urls,
    setupUrl: `http://localhost:${config.port}/setup`
  };
}

export async function pickFolder() {
  if (process.platform !== 'win32') {
    const error = new Error('当前系统暂不支持弹出文件夹选择器，请手动填写文件夹路径。');
    error.status = 501;
    throw error;
  }

  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
    "$dialog.Description = '选择要在手机上播放的媒体文件夹'",
    '$dialog.ShowNewFolderButton = $false',
    'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {',
    '  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    '  Write-Output $dialog.SelectedPath',
    '}'
  ].join('; ');

  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { windowsHide: false, timeout: 1000 * 60 * 5 }
  );
  const selected = stdout.trim();
  if (!selected) {
    const error = new Error('没有选择文件夹');
    error.status = 400;
    throw error;
  }
  return selected;
}

function getLanAddresses() {
  const interfaces = os.networkInterfaces();
  return Object.values(interfaces)
    .flat()
    .filter((item) => item && item.family === 'IPv4' && !item.internal)
    .map((item) => item.address);
}
