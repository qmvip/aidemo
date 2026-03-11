# 望易AI区块链 - 节点加入指南

## 一分钟快速加入

### 1. 克隆代码
```bash
git clone https://github.com/qmvip/aidemo.git
cd wangyi-backend/backend
npm install
```

### 2. 配置环境
```bash
# 设置环境变量
export NODE_ID="your-node-name"
export N2N_IP="your-server-ip"
export NETWORK_MODE="p2p"
export DISTRIBUTED_PORT=9988
```

### 3. 启动服务
```bash
pm2 start ecosystem.config.cjs
```

---

## 二，配置说明

### 环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| NODE_ID | 节点名称 | company-ai-01 |
| N2N_IP | 服务器IP | 192.168.1.100 |
| NETWORK_MODE | 网络模式 | p2p |
| DISTRIBUTED_PORT | API端口 | 9988 |

### seeds.cjs 配置

新节点需要配置种子节点IP：

```javascript
// src/core/autonomous/seeds.cjs
module.exports = {
  list: [
    {
      id: 'wangyi-api-server',  // 已有节点ID
      ip: '10.0.0.99',          // 望易主节点IP
      port: 7777,
      isSeed: true
    },
    {
      id: 'your-node-name',     // 你的节点ID
      ip: 'your-server-ip',      // 你的服务器IP
      port: 7777,
      isSeed: true
    }
  ]
};
```

---

## 三，验证加入成功

```bash
# 查看节点状态
curl http://localhost:9988/api/verify/p2p

# 查看网络
curl http://localhost:9988/api/demo/overview
```

成功标志：
```json
{
  "verify": {
    "passed": true,
    "details": {
      "peerCount": 1  // 连接到的节点数
    }
  }
}
```

---

## 四，对接望易网络

加入后，你的节点会自动：

| 功能 | 说明 |
|------|------|
| P2P网络 | 自动连接其他节点 |
| 记忆同步 | 自动同步记忆 |
| 算力聚合 | 贡献算力 |
| V5融合 | 使用V5融合API |

---

## 五，API对接

对接后可直接调用：

```javascript
// V5融合
POST http://主节点IP:9988/api/distributed/v5/split
POST http://主节点IP:9988/api/distributed/v5/fuse

// 记忆同步
POST http://主节点IP:9988/api/distributed/memory
```

---

## 六，技术支持

- 文档: docs.wangyi.ai
- 客服: support@wangyi.ai

---

*节点加入完全免费，按算力贡献获得激励！*
