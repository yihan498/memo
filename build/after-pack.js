// Mac 包免费的「临时签名」（ad-hoc，不需要苹果开发者账号）。
// 没有任何签名的 Apple 芯片 App 会被系统直接报「已损坏」；临时签名后只是「无法验证开发者」，
// 用户在「系统设置 → 隐私与安全性 → 仍要打开」放行一次即可。
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
};
