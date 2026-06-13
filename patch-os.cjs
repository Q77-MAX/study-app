// 修复：把中文 Windows 用户名替换为英文，绕过 Vercel CLI 的 HTTP header 验证
const os = require('os');

// 修补 hostname（Vercel 用它构造 User-Agent: hostname @ vercel x.x.x node-v...）
const origHostname = os.hostname.bind(os);
os.hostname = function () { return 'qingpingguo-pc'; };

// 修补 userInfo
const origUserInfo = os.userInfo.bind(os);
os.userInfo = function (options) {
  const info = origUserInfo(options);
  return { ...info, username: 'user' };
};

// 环境变量也一起改
process.env.USER = 'user';
process.env.USERNAME = 'user';
process.env.USERDOMAIN = '';
