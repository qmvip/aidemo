# 望易AI区块链 - 节点部署指南

## 支持的平台

| 平台 | 可行性 | 推荐配置 |
|------|--------|----------|
| PVE/VMware | ✅ 完美 | 2核+2GB |
| NAS (群晖/威联通) | ✅ Docker | 2核+2GB |
| 树莓派4/5 | ✅ 4GB+ | 4GB内存 |
| Linux服务器 | ✅ 完美 | 2核+2GB |
| OpenWRT | ❌ 不支持 | 资源不足 |

## 快速部署 (Docker 推荐)

### 1. 群晖NAS部署

```bash
# 1. 打开Docker -> 注册表 -> 搜索 wangyi
# 2. 或者使用docker-compose

version: '3.8'
services:
  wangyi-node:
    image: node:18-alpine
    container_name: wangyi-node
    restart: unless-stopped
    network_mode: host
    volumes:
      - ./wangyi-data:/home/ubuntu/wangyi
    environment:
      - NODE_ID=wangyi-nas-001
      - NETWORK_MODE=p2p
      - SEED_IP=82.156.189.26
    command: >
      sh -c "apk add --no-cache git &&
             cd /home/ubuntu &&
             git clone https://github.com/qmvip/aidemo.git wangyi &&
             cd wangyi/backend &&
             npm install &&
             node distributed_api.cjs"
```

### 2. 威联通NAS部署

同上，使用Container Station运行Docker

### 3. PVE虚拟机部署

```bash
# 创建Ubuntu 22.04虚拟机 (2核2GB)

# 登录后执行
sudo su -
apt update && apt install -y git nodejs npm

# 克隆项目
cd /home/ubuntu
git clone https://github.com/qmvip/aidemo.git wangyi

# 安装依赖
cd wangyi/backend
npm install

# 配置种子节点
# 修改 src/core/autonomous/seeds.cjs 添加你的节点

# 启动
node distributed_api.cjs
```

### 4. 树莓派部署

```bash
# 需要树莓派4/5 + 4GB以上内存
# 安装64位系统 (Ubuntu 22.04 64-bit)

sudo apt update
sudo apt install -y git nodejs npm

cd /home/ubuntu
git clone https://github.com/qmvip/aidemo.git wangyi
cd wangyi/backend
npm install
node distributed_api.cjs
```

### 5. Linux服务器部署

```bash
# Ubuntu 22.04
sudo apt update
sudo apt install -y git nodejs npm

cd /home/ubuntu
git clone https://github.com/qmvip/aidemo.git wangyi
cd wangyi/backend
npm install

# 使用PM2运行
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
```

## 节点配置

### 配置环境变量

```bash
# 节点ID (唯一标识)
export NODE_ID=wangyi-node-001

# 网络模式
export NETWORK_MODE=p2p

# 种子节点IP (望易官方节点)
export SEED_IP=82.156.189.26

# P2P端口
export P2P_PORT=7777
export TCP_PORT=17777
```

### 修改seeds.cjs

```javascript
// src/core/autonomous/seeds.cjs
module.exports = {
  list: [
    // 官方种子节点
    {
      id: 'wangyi-seed-1',
      ip: '82.156.189.26',
      port: 7777,
      tcpPort: 17777,
      isSeed: true
    },
    // 你的节点 (可选)
    {
      id: 'wangyi-nas-001',
      ip: '你的公网IP或局域网IP',
      port: 7777,
      tcpPort: 17777,
      isSeed: false
    }
  ],
  defaults: {
    port: 7777,
    tcpPort: 17777,
    maxPeers: 50
  }
};
```

## 防火墙配置

```bash
# Ubuntu/Debian
sudo ufw allow 7777/udp   # P2P发现
sudo ufw allow 17777/tcp  # P2P通信
sudo ufw allow 9988/tcp   # API
sudo ufw enable
```

## 验证节点运行

```bash
# 检查进程
pm2 status

# 查看日志
pm2 logs wangyi-distributed

# 测试API
curl http://localhost:9988/api/distributed/status

# 测试P2P连接
curl http://localhost:9988/api/distributed/status | grep peerCount
```

## 节点监控

### API返回的节点信息

```json
{
  "network": {
    "peerCount": 2,
    "peers": [
      {"id": "wangyi-api-server", "ip": "10.0.0.99"},
      {"id": "wangyi-client-wsl", "ip": "10.0.0.5"}
    ]
  },
  "computing": {
    "cluster": {
      "totalNodes": 2,
      "totalCpuCores": 30,
      "totalMemoryGB": 17.46
    }
  }
}
```

## 收益说明

### 计算节点 (最低5,000 WY质押)
- 年化收益: 8-12%
- 收益来源: 算力贡献

### 主节点 (最低50,000 WY质押)
- 年化收益: 15-20%
- 收益来源: 算力贡献 + 治理分红

## 常见问题

### Q: 需要公网IP吗？
A: 不需要，局域网也可以加入P2P网络

### Q: 需要GPU吗？
A: 计算节点推荐GPU，主节点不需要

### Q: 节点会暴露隐私吗？
A: 只暴露节点ID和IP地址，不暴露数据

### Q: 节点会一直运行吗？
A: 需要保持在线，离线会被惩罚

## 下一步

1. 选择部署平台
2. 准备硬件
3. 按照上述步骤部署
4. 加入Discord/Telegram社区

---

*有问题请联系: (待定)*
