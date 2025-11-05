// ==================== 最终版 index.js ====================

const express = require("express");
const app = express();
const axios = require("axios");
const os = require('os');
const fs = require("fs");
const path = require("path");
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// ==================== 所有配置已硬编码 ====================
const UPLOAD_URL = '';
const PROJECT_URL = 'https://surrounding-fawnia-sdadaaa-b924f948.koyeb.app';
const AUTO_ACCESS = false;
const FILE_PATH = './tmp';
const SUB_PATH = 'feed';
const PORT = process.env.PORT || 3000;

// 固定配置
const UUID = require('crypto').randomUUID();
const NEZHA_SERVER = '';
const NEZHA_PORT = '';
const NEZHA_KEY = '';
const ARGO_DOMAIN = 'koyebde.tjzsg.filegear-sg.me';
const ARGO_AUTH = 'eyJhIjoiZDFlYThmNmI0NzFkMGFkMmYwMDdlZDE5MmZlYzk2ZjkiLCJ0IjoiODhlOGJhNjQtZjgzMC00NGJiLThiNjEtNTAzZjQ5MzYyMzNlIiwicyI6IlpXWTBaR1UzT1RrdE1HSXhOeTAwTlRSbUxXRmhaRGt0TW1JeE16azRZVFkwTnpRMSJ9';
const ARGO_PORT = 8001;
const CFIP = '104.16.159.59';
const CFPORT = 443;
const NAME = 'TechNode';
const BOT_TOKEN = '7711641304:AAFFdHkZN1grvvXNeghCim7c6QE5cb7Laho';
const CHAT_ID = '6488187665';

// ==================== 初始化 ====================
if (!fs.existsSync(FILE_PATH)) fs.mkdirSync(FILE_PATH, { recursive: true });

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
  res.send(`
<!DOCTYPE html>
<html lang="zh"><head><meta charset="UTF-8"><title>${NAME}</title>
<style>body{font-family:Arial;margin:40px;line-height:1.6}h1{color:#2c3e50}a{color:#3498db}</style>
</head><body>
<h1>${NAME}</h1><p>技术笔记分享。</p>
<ul><li><a href="/about">关于</a></li><li><a href="/posts">文章</a></li><li><a href="/${SUB_PATH}">订阅</a></li></ul>
</body></html>`);
});

app.get("/about", (req, res) => res.send("<h1>关于</h1><p>独立开发者。</p><a href='/'>返回</a>"));
app.get("/posts", (req, res) => res.send("<h1>文章</h1><p>开发中。</p><a href='/'>返回</a>"));

// ==================== 健康检查 ====================
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

function getArch() {
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

// ==================== 主启动流程 ====================
async function start() {
  try {
    console.log("启动节点...");

    // 1. 生成 Xray 配置
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
      outbounds: [{ protocol: "freedom" }, { protocol: "blackhole" }]
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    // 2. 下载文件
    const arch = getArch();
    await Promise.all([
      downloadFile(webPath, `https://${arch}64.ssss.nyc.mn/web`),
      downloadFile(botPath, `https://${arch}64.ssss.nyc.mn/bot`)
    ]);

    // 3. 重命名 + 权限
    const nginxPath = path.join(FILE_PATH, 'nginx');
    const cfPath = path.join(FILE_PATH, 'cloudflared');
    await execAsync(`mv ${webPath} ${nginxPath} && chmod 775 ${nginxPath}`);
    await execAsync(`mv ${botPath} ${cfPath} && chmod 775 ${cfPath}`);
    webPath = nginxPath; botPath = cfPath;

    // 4. 启动 Xray
    await execAsync(`nohup ${webPath} -c ${configPath} >/dev/null 2>&1 &`);
    await new Promise(r => setTimeout(r, 1000));

    // 5. 启动 Argo
    await execAsync(`nohup ${botPath} tunnel --edge-ip-version auto --no-autoupdate --protocol http2 run --token ${ARGO_AUTH} > ${bootLogPath} 2>&1 &`);
    await new Promise(r => setTimeout(r, 8000));

    // 6. 生成节点
    const isp = await getISP();
    const nodeName = `${NAME}-${isp}`;
    const VMESS = { v: '2', ps: nodeName, add: CFIP, port: CFPORT, id: UUID, aid: '0', scy: 'none', net: 'ws', type: 'none', host: ARGO_DOMAIN, path: '/vmess-argo?ed=2560', tls: 'tls', sni: ARGO_DOMAIN, fp: 'firefox' };
    const subTxt = `
vless://${UUID}@${CFIP}:${CFPORT}?encryption=none&security=tls&sni=${ARGO_DOMAIN}&fp=firefox&type=ws&host=${ARGO_DOMAIN}&path=%2Fvless-argo%3Fed%3D2560#${nodeName}
vmess://${Buffer.from(JSON.stringify(VMESS)).toString('base64')}
trojan://${UUID}@${CFIP}:${CFPORT}?security=tls&sni=${ARGO_DOMAIN}&fp=firefox&type=ws&host=${ARGO_DOMAIN}&path=%2Ftrojan-argo%3Fed%3D2560#${nodeName}
    `.trim();
    const base64Sub = Buffer.from(subTxt).toString('base64');
    fs.writeFileSync(subPath, base64Sub);
    fs.writeFileSync(listPath, subTxt);

    // 7. 订阅接口
    const rateLimit = new Map();
    app.get(`/${SUB_PATH}`, (req, res) => {
      const ip = req.ip;
      const now = Date.now();
      if (rateLimit.has(ip) && now - rateLimit.get(ip) < 60000) {
        return res.status(429).send('Please wait 1 minute');
      }
      rateLimit.set(ip, now);
      res.type('txt').send(base64Sub);
    });

    // 8. TG 推送
    if (BOT_TOKEN && CHAT_ID) {
      setTimeout(async () => {
        for (let i = 0; i < 3; i++) {
          try {
            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
              chat_id: CHAT_ID,
              text: `*节点上线*\n订阅: \`${PROJECT_URL}/${SUB_PATH}\`\n\`\`\`\n${base64Sub}\n\`\`\``,
              parse_mode: 'Markdown'
            });
            console.log("TG 推送成功");
            break;
          } catch (e) {
            console.log(`TG 重试 ${i+1}`);
            await new Promise(r => setTimeout(r, 5000));
          }
        }
      }, 20000);
    }

    // 9. 防休眠 + 60秒后删除所有日志
    const LOG_FILES = [bootLogPath, configPath];
    const KEEP_ALIVE_LOGS = [];
    const originalLog = console.log;
    const originalWarn = console.warn;

    console.log = function (...args) {
      const msg = args.join(' ');
      if (msg.includes('[Keep-Alive]')) {
        const logFile = path.join(FILE_PATH, `alive_${Date.now()}.tmp`);
        fs.writeFileSync(logFile, msg + '\n');
        KEEP_ALIVE_LOGS.push(logFile);
      }
      originalLog.apply(console, args);
    };

    console.warn = function (...args) {
      const msg = args.join(' ');
      if (msg.includes('[Keep-Alive]')) {
        const logFile = path.join(FILE_PATH, `alive_warn_${Date.now()}.tmp`);
        fs.writeFileSync(logFile, msg + '\n');
        KEEP_ALIVE_LOGS.push(logFile);
      }
      originalWarn.apply(console, args);
    };

    // 每10分钟访问自己（防休眠）
    setInterval(async () => {
      try {
        await axios.get(PROJECT_URL, { timeout: 10000 });
        console.log(`[Keep-Alive] ${new Date().toISOString()}`);
      } catch (e) {
        console.warn(`[Keep-Alive] 失败: ${e.message}`);
      }
    }, 10 * 60 * 1000);

    console.log(`节点就绪！订阅: ${PROJECT_URL}/${SUB_PATH}`);

    // 60 秒后删除所有日志文件
    setTimeout(() => {
      [...LOG_FILES, ...KEEP_ALIVE_LOGS].forEach(file => {
        if (fs.existsSync(file)) {
          try { fs.unlinkSync(file); } catch (e) {}
        }
      });
      console.log = originalLog;
      console.warn = originalWarn;
    }, 60000);

  } catch (e) {
    console.error('启动失败:', e.message);
    process.exit(1);
  }
}

start();

// ==================== 启动服务器 ====================
app.listen(PORT, () => {
  console.log(`服务器运行在 :${PORT}`);
  console.log(`订阅: ${PROJECT_URL}/${SUB_PATH}`);
  console.log(`健康: ${PROJECT_URL}/health`);
});
