# 使用轻量 Node.js 镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package.json ./

# 安装依赖
RUN npm install --production

# 复制代码
COPY index.js ./

# 创建运行目录
RUN mkdir -p /app/tmp

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["npm", "start"]
