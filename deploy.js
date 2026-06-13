// 绕过中文用户名问题的部署脚本
const { execSync } = require('child_process');
const os = require('os');

// 修补 os.userInfo，把中文用户名替换掉
const origUserInfo = os.userInfo;
os.userInfo = function(options) {
  const info = origUserInfo.call(os, options);
  info.username = 'user';
  return info;
};

// 修补 process.env 中的用户名
process.env.USER = 'user';
process.env.USERNAME = 'user';

console.log('🚀 开始部署到 Vercel...\n');

try {
  execSync('npx vercel --prod', {
    stdio: 'inherit',
    cwd: __dirname,
    env: {
      ...process.env,
      USER: 'user',
      USERNAME: 'user',
    }
  });
  console.log('\n✅ 部署完成！');
} catch (e) {
  console.error('\n❌ 部署失败:', e.message);
}
