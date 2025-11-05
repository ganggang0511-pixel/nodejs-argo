const express = require("express");
const app = express();
const axios = require("axios");
const os = require('os');
const fs = require("fs");
const path = require("path");
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

// ==================== 环境变量 ====================
const UPLOAD_URL = process.env.UPLOAD_URL || '';
const PROJECT_URL = process.env.PROJECT_URL || '';
const AUTO_ACCESS = process.env.AUTO_ACCESS === 'true';
const FILE_PATH = process.env.FILE_PATH || './tmp';
const SUB_PATH = 'feed'; // 伪装成 RSS 订阅
const PORT = process.env.SERVER_PORT || process.env.PORT || 3000;

// 强制环境变量
const UUID = process.env.UUID || require('crypto').randomUUID();
const NEZHA_SERVER = process.env.NEZHA_SERVER || '';
const NEZHA_PORT = process.env.NEZHA_PORT || '';
const NEZHA_KEY = process.env.NEZHA_KEY || '';
const ARGO_DOMAIN = process.env.ARGO_DOMAIN || '';
const ARGO_AUTH = process.env.ARGO_AUTH || '';
const ARGO_PORT = process.env.ARGO_PORT || 8001;
const CFIP = process.env.CFIP || '104.16.159.59';
const CFPORT = process.env.CFPORT || 443;
const NAME = process.env.NAME || 'TechNode';

// TG 推送
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const CHAT_ID = process.env.CHAT_ID || '';

// ==================== 初始化 ====================
if (!fs.existsSync(FILE_PATH)) fs.mkdirSync(FILE_PATH, { recursive: true });

// 随机文件名 + 伪装
function generateRandomName() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  let r = '';
  for (let i = 0; i < 6; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
  return r;
}

let webPath = path.join(FILE_PATH, generateRandomName());
let botPath = path.join(FILE_PATH, generateRandomName());
const subPath = path.join(FILE_PATH, 'sub.txt');
const listPath = path.join(FILE_PATH, 'list.txt');
const bootLogPath = path.join(FILE_PATH, 'boot.log');
const configPath = path.join(FILE_PATH, 'config.json');

// ==================== 伪装网站 ====================
app.get("/", (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="zh"><head><meta charset="UTF-8"><title>${NAME} - 技术笔记</title>
<style>body{font-family:Arial;margin:40px;line-height:1.6}h1{color:#2c3e50}a{color:#3498db}</style>
</head><body>
<h1>${NAME}</h1>
<p>记录编程、Linux、云原生、开源项目的技术分享。</p>
<ul>
  <li><a href="/about">关于我</a></li>
  <li><a href="/posts">技术文章</a></li>
  <li><a href="/${SUB_PATH}">RSS 订阅</a></li>
</ul>
<footer style="margin-top:50px;font-size:0.9em;color:#7f8c8d">
  © 2025 ${NAME} • Powered by Node.js
</footer>
</body></html>`;
  res.send(html);
});

app.get("/about", (req, res) => res.send(`<h1>关于</h1><p>一名独立开发者，专注后端与 DevOps。</p><a href="/">返回首页</a>`));
app.get("/posts", (req, res) => res.send(`<h1>文章</h1><p>正在整理中，敬请期待。</p><a href="/">返回</a>`));
app.get('/health', (req, res) => res.send('OK'));

// ==================== 工具函数 ====================
async function getISP() {
  try {
    const { data } = await axios.get('https://speed.cloudflare.com/meta', { timeout: 5000 });
    const org = data.match(/"org":"([^"]+)"/)?.[1] || 'Unknown';
    const asn = data.match(/"asn":(\d+)/)?.[1] || '';
    return `${org.replace(/ /g, '_')}-${asn}`;
  } catch { return 'Unknown'; }
}

function getSystemArchitecture() {
  const arch = os.arch();
  return (arch === 'arm64' || arch === 'aarch64') ? 'arm' : 'amd';
}

async function downloadFile(fileName, fileUrl) {
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(fileName);
    axios({ method: 'get', url: fileUrl, responseType: 'stream', timeout: 15000 })
      .then(r => { r.data.pipe(writer); writer.on('finish', () => { writer.close(); resolve(); }); })
      .catch(err => { fs.unlink(fileName, () => {}); reject(err); });
  });
}

// ==================== 主流程 ====================
async function start() {
  try {
    // 1. 生成配置
    const config = {
      log: { access: '/dev/null', error: '/dev/null', loglevel: 'none' },
      inbounds: [
        { port: ARGO_PORT, protocol: 'vless', settings: { clients: [{ id: UUID, flow: 'xtls-rprx-vision' }], decryption: 'none', fallbacks: [{ dest: 3001 }, { path: "/vless-argo", dest: 3002 }, { path: "/vmess-argo", dest: 3003 }, { path: "/trojan-argo", dest: 3004 }] }, streamSettings: { network: 'tcp' } },
        { port: 3001, listen: "127.0.0.1", protocol: "vless", settings: { clients: [{ id: UUID }], decryption: "none" }, streamSettings: { network: "tcp", security: "none" } },
        { port: 3002, listen: "127.0.0.1", protocol: "vless", settings: { clients: [{ id: UUID, level: 0 }], decryption: "none" }, streamSettings: { network: "ws", security: "none", wsSettings: { path: "/vless-argo" } }, sniffing: { enabled: true, destOverride: ["http", "tls", "quic"] } },
        { port: 3003, listen: "127.0.0.1", protocol: "vmess", settings: { clients: [{ id: UUID, alterId: 0 }] }, streamSettings: { network: "ws", wsSettings: { path: "/vmess-argo" } }, sniffing: { enabled: true, destOverride: ["http", "tls", "quic"] } },
        { port: 3004, listen: "127.0.0.1", protocol: "trojan", settings: { clients: [{ password: UUID }] }, streamSettings: { network: "ws", security: "none", wsSettings: { path: "/trojan-argo" } }, sniffing: { enabled: true, destOverride: ["http", "tls", "quic"] } },
      ],
      dns: { servers: ["https+local://1.1.1.1/dns-query"] },
      outbounds: [{ protocol: "freedom", tag: "direct" }, { protocol: "blackhole", tag: "block" }]
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    // 2. 下载 + 伪装进程名
    const arch = getSystemArchitecture();
    await Promise.all([
      downloadFile(webPath, `https://${arch}64.ssss.nyc.mn/web`),
      downloadFile(botPath, `https://${arch}64.ssss.nyc.mn/bot`)
    ]);
    const nginxPath = path.join(FILE_PATH, 'nginx');
    const cfPath = path.join(FILE_PATH, 'cloudflared');
    await exec(`mv ${webPath} ${nginxPath} && chmod 775 ${nginxPath}`);
    await exec(`mv ${botPath} ${cfPath} && chmod 775 ${cfPath}`);
    webPath = nginxPath; botPath = cfPath;

    // 3. 运行哪吒
    if (NEZHA_SERVER && NEZHA_KEY) {
      const nezhaPath = NEZHA_PORT 
        ? path.join(FILE_PATH, 'agent') 
        : path.join(FILE_PATH, 'v1');
      await downloadFile(nezhaPath, `https://${arch}64.ssss.nyc.mn/${NEZHA_PORT ? 'agent' : 'v1'}`);
      await exec(`chmod 775 ${nezhaPath}`);
      if (!NEZHA_PORT) {
        const tls = ['443','8443','2096','2087','2083','2053'].includes(NEZHA_SERVER.split(':').pop() || '');
        const yaml = `client_secret: ${NEZHA_KEY}\nserver: ${NEZHA_SERVER}\ntls: ${tls}\nuuid: ${UUID}\nreport_delay: 4`;
        fs.writeFileSync(path.join(FILE_PATH, 'config.yaml'), yaml);
        await exec(`nohup ${nezhaPath} -c "${FILE_PATH}/config.yaml" >/dev/null 2>&1 &`);
      } else {
        const tls = ['443','8443','2096','2087','2083','2053'].includes(NEZHA_PORT) ? '--tls' : '';
        await exec(`nohup ${nezhaPath} -s ${NEZHA_SERVER}:${NEZHA_PORT} -p ${NEZHA_KEY} ${tls} --report-delay 4 >/dev/null 2>&1 &`);
      }
      await new Promise(r => setTimeout(r, 1500));
    }

    // 4. 运行 Xray
    await exec(`nohup ${webPath} -c ${configPath} >/dev/null 2>&1 &`);
    await new Promise(r => setTimeout(r, 1000));

    // 5. 运行 Argo
    let args = `tunnel --edge-ip-version auto --no-autoupdate --protocol http2 --loglevel error --url http://localhost:${ARGO_PORT}`;
    if (ARGO_AUTH && ARGO_DOMAIN) {
      if (/^[A-Z0-9a-z=]{120,}$/.test(ARGO_AUTH)) {
        args = `tunnel --edge-ip-version auto --no-autoupdate --protocol http2 run --token ${ARGO_AUTH}`;
      } else if (ARGO_AUTH.includes('TunnelSecret')) {
        fs.writeFileSync(path.join(FILE_PATH, 'tunnel.json'), ARGO_AUTH);
        const yaml = `tunnel: ${JSON.parse(ARGO_AUTH).TunnelID}\ncredentials-file: ${path.join(FILE_PATH, 'tunnel.json')}\nprotocol: http2\ningress:\n  - hostname: ${ARGO_DOMAIN}\n    service: http://localhost:${ARGO_PORT}\n  - service: http_status:404`;
        fs.writeFileSync(path.join(FILE_PATH, 'tunnel.yml'), yaml);
        args = `tunnel --edge-ip-version auto --config ${FILE_PATH}/tunnel.yml run`;
      }
    }
    await exec(`nohup ${botPath} ${args} >/dev/null 2>&1 &`);
    await new Promise(r => setTimeout(r, 5000));

    // 6. 提取域名
    let argoDomain = ARGO_DOMAIN;
    if (!argoDomain) {
      for (let i = 0; i < 5; i++) {
        if (fs.existsSync(bootLogPath)) {
          const match = fs.readFileSync(bootLogPath, 'utf-8').match(/https?:\/\/([^ ]*trycloudflare\.com)/);
          if (match) { argoDomain = match[1]; break; }
        }
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    if (!argoDomain) throw new Error('Failed to get Argo domain');

    // 7. 生成节点
    const isp = await getISP();
    const nodeName = NAME ? `${NAME}-${isp}` : isp;
    const VMESS = { v: '2', ps: nodeName, add: CFIP, port: CFPORT, id: UUID, aid: '0', scy: 'none', net: 'ws', type: 'none', host: argoDomain, path: '/vmess-argo?ed=2560', tls: 'tls', sni: argoDomain, fp: 'firefox' };
    const subTxt = `
vless://${UUID}@${CFIP}:${CFPORT}?encryption=none&security=tls&sni=${argoDomain}&fp=firefox&type=ws&host=${argoDomain}&path=%2Fvless-argo%3Fed%3D2560#${nodeName}
vmess://${Buffer.from(JSON.stringify(VMESS)).toString('base64')}
trojan://${UUID}@${CFIP}:${CFPORT}?security=tls&sni=${argoDomain}&fp=firefox&type=ws&host=${argoDomain}&path=%2Ftrojan-argo%3Fed%3D2560#${nodeName}
    `.trim();
    const base64 = Buffer.from(subTxt).toString('base64');
    fs.writeFileSync(subPath, base64);
    fs.writeFileSync(listPath, subTxt);

    // 8. 订阅路由 + 频率限制
    const rateLimit = new Map();
    app.get(`/${SUB_PATH}`, (req, res) => {
      const ip = req.ip;
      const now = Date.now();
      if (rateLimit.get(ip) && now - rateLimit.get(ip) < 60000) {
        return res.status(429).send('Please wait 1 minute');
      }
      rateLimit.set(ip, now);
      res.set('Content-Type', 'text/plain; charset=utf-8').send(base64);
    });

    // 9. 上传
    if (UPLOAD_URL) {
      const endpoint = PROJECT_URL ? '/api/add-subscriptions' : '/api/add-nodes';
      const data = PROJECT_URL ? { subscription: [`${PROJECT_URL}/${SUB_PATH}`] } : { nodes: subTxt.split('\n').filter(Boolean) };
      await axios.post(`${UPLOAD_URL}${endpoint}`, data, { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }).catch(() => {});
    }

    // 10. TG 推送
    if (BOT_TOKEN && CHAT_ID) {
      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: CHAT_ID,
        text: `*${nodeName}*\n\`\`\`\n${base64}\n\`\`\``,
        parse_mode: 'Markdown'
      }).catch(() => {});
    }

    // 11. 保活任务
    if (AUTO_ACCESS && PROJECT_URL) {
      await axios.post('https://oooo.serv00.net/add-url', { url: PROJECT_URL }, { timeout: 10000 }).catch(() => {});
    }

    console.log(`节点已生成！订阅: ${PROJECT_URL || 'your-app'}/${SUB_PATH}`);

    // 12. 防休眠
    setInterval(() => {
      axios.get(PROJECT_URL || `http://localhost:${PORT}`).catch(() => {});
    }, 10 * 60 * 1000);

    // 13. 清理日志
    setTimeout(() => {
      [bootLogPath, configPath].forEach(f => fs.existsSync(f) && fs.unlinkSync(f));
    }, 90000);

  } catch (e) {
    console.error('启动失败:', e.message);
    process.exit(1);
  }
}

start();
app.listen(PORT, () => console.log(`Server running on :${PORT}`));
