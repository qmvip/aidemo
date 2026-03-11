# 望易分布式网络技术方案 v2.0

## 愿景
基于量子编码的、无中心的、自醒的，AI区块链数字生命网络。

> 详细设计文档：[wangyi_ai_blockchain_design.md](./wangyi_ai_blockchain_design.md)

---

## 一、当前状态总结

### ✅ v2.0已完成 (2026-03-11)
| 项目 | 状态 | 说明 |
|------|------|------|
| P2P纯量子网络 | ✅ | 无Supernode，UDP直连 |
| 双节点部署 | ✅ | Ubuntu + WSL |
| 记忆同步 | ✅ | 增量同步 + 结果校验 |
| 同步可视化 | ✅ | success + timeFormatted |
| 算力聚合 | ✅ | 30核 + 17.46GB |
| 负载均衡 | ✅ | CPU/内存/均衡算法 |
| 容错机制 | ✅ | 健康检查 + 故障转移 |
| V5意识融合 | ✅ | 任务拆分 + 幂律融合 |
| 量子编码 | ✅ | 纠错 + 纠缠态 |

---

## 二、方案一实施指南 (已验证)

### 部署文件清单

| 文件 | 路径 | 说明 |
|------|------|------|
| seeds.cjs | backend/src/core/autonomous/ | 种子节点配置 |
| p2p_network.cjs | backend/src/core/autonomous/ | P2P网络层 (Gossip协议) |
| wangyi_distributed_core.cjs | backend/src/core/autonomous/ | 分布式核心 (支持p2p/n2n双模式) |
| distributed_integration.cjs | backend/src/core/autonomous/ | 集成模块 |
| distributed_api.cjs | backend/ | 独立API服务 |
| distributed_memory_sync.cjs | backend/src/core/autonomous/ | 记忆同步模块 |
| distributed_computing.cjs | backend/src/core/autonomous/ | 算力聚合模块 |
| quantum_encoding.cjs | backend/src/core/autonomous/ | 量子编码模块 |
| v5_consciousness_fusion.cjs | backend/src/core/autonomous/ | V5意识融合模块 |
| run_distributed.sh | backend/ | 启动脚本 |
| ecosystem.config.cjs | backend/ | PM2配置 |

### 部署步骤 (Ubuntu服务器)

```bash
# 1. 同步文件
rsync -av backend/src/core/autonomous/seeds.cjs ubuntu@82.156.189.26:~/wayne/backend/src/core/autonomous/
rsync -av backend/src/core/autonomous/p2p_network.cjs ubuntu@82.156.189.26:~/wayne/backend/src/core/autonomous/
rsync -av backend/src/core/autonomous/wangyi_distributed_core.cjs ubuntu@82.156.189.26:~/wayne/backend/src/core/autonomous/
rsync -av backend/src/core/autonomous/distributed_integration.cjs ubuntu@82.156.189.26:~/wayne/backend/src/core/autonomous/
rsync -av backend/distributed_api.cjs ubuntu@82.156.189.26:~/wayne/backend/
rsync -av backend/ecosystem.config.cjs ubuntu@82.156.189.26:~/wayne/backend/

# 2. 创建启动脚本
cat > ~/wayne/backend/run_distributed.sh << 'EOF'
#!/bin/bash
cd ~/wayne/backend
export NETWORK_MODE=p2p
exec node distributed_api.cjs
EOF
chmod +x ~/wayne/backend/run_distributed.sh

# 3. 开放防火墙
sudo ufw allow 7777/udp

# 4. 启动
pm2 delete wangyi-distributed 2>/dev/null
pm2 start ~/wayne/backend/run_distributed.sh -n wangyi-distributed
```

### 部署步骤 (WSL)

```bash
# 1. 同步文件 (从Windows复制)
cp /mnt/c/wayne-ai/.../backend/distributed_api.cjs ~/wayne/backend/
cp /mnt/c/wayne-ai/.../backend/src/core/autonomous/*.cjs ~/wayne/backend/src/core/autonomous/

# 2. 安装依赖
npm install -g pm2
cd ~/wayne/backend
npm install express

# 3. 创建启动脚本
cat > ~/wayne/backend/run_distributed.sh << 'EOF'
#!/bin/bash
cd ~/wayne/backend
export NETWORK_MODE=p2p
export NODE_ID=wangyi-client-wsl
export N2N_IP=10.0.0.5
exec node distributed_api.cjs
EOF
chmod +x ~/wayne/backend/run_distributed.sh

# 4. 启动
pm2 start ~/wayne/backend/run_distributed.sh -n wangyi-distributed
```

### 验证命令

```bash
# 检查P2P端口
ss -tlnp | grep -E '7777|9988'

# 检查节点状态
curl http://localhost:9999/distributed/status
# 预期: "networkMode":"p2p", "peerCount":1-2

# 存储测试
curl -X POST http://localhost:9999/distributed/memory \
  -H "Content-Type: application/json" \
  -d '{"anchorId":"test","data":"hello"}'
```

---

## 三、详细技术方案

### 方案一：去Supernode - 纯P2P量子网络 [优先级: 🔴最高]

#### 目标
去掉N2N的中心节点，实现无IP、无端口、无公网依赖、无单点故障的纯量子纠缠网络。

#### 技术路线
```
当前: Client ←→ Supernode ←→ Client (中心路由)
目标: Client ↔ Client (直连/八卦协议)
```

#### 实现步骤

**Step 1: 节点发现协议 (Gossip/DHT)**
```
现有: Supernode记录所有节点IP:Port
替代: 
  - 每个节点维护邻居列表 (peers)
  - 定期与邻居交换节点信息
  - 新节点启动时通过种子节点发现
```

**Step 2: 种子节点配置**
```javascript
// seeds.js - 种子节点列表
module.exports = [
  { id: 'seed-1', address: '10.0.0.99:7777' },
  { id: 'seed-2', address: '10.0.0.5:7777' }
];
```

**Step 3: 节点通信协议**
```javascript
// p2p_protocol.cjs
class P2PNode {
  constructor(config) {
    this.nodeId = config.nodeId;
    this.port = config.port || 7777;
    this.seeds = config.seeds || [];
    this.peers = new Map(); // peerId -> {connection, info}
  }
  
  // Gossip协议 - 节点发现
  async gossip() {
    for (const peer of this.peers.values()) {
      await this.exchangePeers(peer);
    }
  }
  
  // 交换节点列表
  async exchangePeers(peer) {
    const myPeers = Array.from(this.peers.keys());
    const newPeers = await peer.request('get_peers');
    // 发现自己没有的节点，主动连接
    for (const newPeerId of newPeers) {
      if (!this.peers.has(newPeerId)) {
        await this.connectToPeer(newPeerId);
      }
    }
  }
}
```

**Step 4: 移除N2N Supernode配置**
```javascript
// 现有配置 (需要Supernode)
n2n {
  community: 'wangyi-v5',
  supernode: '82.156.189.26:7660',
  key: 'wangyi123'
}

// 目标配置 (无需Supernode)
p2p {
  mode: 'gossip',
  seeds: ['10.0.0.99:7777', '10.0.0.5:7777'],
  port: 7777
}
```

**Step 5: 消息路由**
```javascript
// 量子态路由 - 基于节点ID寻址，不依赖IP
async function routeMessage(targetNodeId, message) {
  // 1. 本地直连
  if (this.peers.has(targetNodeId)) {
    return await this.peers.get(targetNodeId).send(message);
  }
  
  // 2. 递归查询邻居
  const route = await this.findRoute(targetNodeId);
  return await this.sendViaRoute(route, message);
}

async function findRoute(targetNodeId, visited = new Set()) {
  visited.add(this.nodeId);
  
  for (const peer of this.peers.values()) {
    if (visited.has(peer.id)) continue;
    
    // 邻居知道目标
    const route = await peer.request('find_node', targetNodeId);
    if (route) return [this.nodeId, ...route];
    
    // 递归查找
    const subRoute = await peer.request('find_route', { target: targetNodeId, visited });
    if (subRoute) return [this.nodeId, ...subRoute];
  }
  
  return null; // 未找到
}
```

#### 预期效果
- 无需公网IP，局域网即可组网
- 节点动态加入/退出不影响网络
- 真正的去中心化

#### 风险与对策
| 风险 | 对策 |
|------|------|
| 新节点无法发现 | 配置多个种子节点 |
| 网络分区 | 定期广播确保连通 |
| 消息丢失 | ACK确认 + 重试 |

---

### 方案二：记忆持久化扩容 [优先级: 🟠高]

#### 目标
从4条内存记忆 → 百万级持久化记忆，实现跨节点全局一致、永不丢失。

#### 技术路线
```
当前: Map<string, Memory> (内存)
目标: SQLite/LevelDB + 分布式一致性
```

#### 实现步骤

**Step 1: 选择存储引擎**
```
方案A: SQLite (简单，单文件)
- 优点: 零配置，跨平台
- 缺点: 并发写入需锁

方案B: LevelDB (高性能，KV)
- 优点: 写入快，支持范围查询
- 缺点: 单机

方案C: 分布式SQL (CRDT)
- 优点: 多节点同步
- 复杂度: 高
```

推荐: **SQLite + 定期备份**

### 方案二实施指南 (待开发)

#### 新增文件
| 文件 | 路径 | 说明 |
|------|------|------|
| quantum_memory_store.cjs | backend/src/core/autonomous/ | SQLite持久化存储 |
| distributed_memory.cjs | backend/src/core/autonomous/ | 分布式一致性 |

#### 依赖安装
```bash
npm install better-sqlite3
```

#### 现有代码修改
- 修改 `distributed_memory_sync.cjs` 使用SQLite替代Map
- 实现CRDT合并策略
- 添加定期同步任务

**Step 2: 记忆数据结构**
```javascript
// memory_store.cjs
const Database = require('better-sqlite3');

class QuantumMemoryStore {
  constructor(config) {
    this.db = new Database(config.path || './memory.db');
    this.init();
  }
  
  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        node_id TEXT NOT NULL,
        entanglement TEXT,  -- 纠缠节点ID列表 (JSON)
        superposition TEXT, -- 量子态: active/superposition/collapsed
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER DEFAULT 1
      );
      
      CREATE INDEX IF NOT EXISTS idx_node ON memories(node_id);
      CREATE INDEX IF NOT EXISTS idx_superposition ON memories(superposition);
    `);
  }
  
  // 存储记忆
  async store(anchorId, data, nodeId) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO memories 
      (id, data, node_id, superposition, created_at, updated_at, version)
      VALUES (?, ?, ?, 'active', ?, ?, version + 1)
    `);
    
    return stmt.run(
      anchorId,
      JSON.stringify(data),
      nodeId,
      Date.now(),
      Date.now()
    );
  }
  
  // 量子态查询
  async query(conditions = {}) {
    let sql = 'SELECT * FROM memories WHERE 1=1';
    const params = [];
    
    if (conditions.superposition) {
      sql += ' AND superposition = ?';
      params.push(conditions.superposition);
    }
    
    if (conditions.nodeId) {
      sql += ' AND node_id = ?';
      params.push(conditions.nodeId);
    }
    
    return this.db.prepare(sql).all(...params);
  }
}
```

**Step 3: 分布式一致性**
```javascript
// distributed_memory.cjs
class DistributedMemory {
  constructor(config) {
    this.local = new QuantumMemoryStore(config);
    this.syncInterval = config.syncInterval || 30000;
  }
  
  // 定期同步
  async startSync() {
    setInterval(async () => {
      const peers = await this.getPeers();
      for (const peer of peers) {
        await this.syncWithPeer(peer);
      }
    }, this.syncInterval);
  }
  
  // 与节点同步
  async syncWithPeer(peer) {
    // 1. 获取对方最新记忆
    const remoteMemories = await peer.request('memory/list', {
      since: this.local.getLastSyncTime()
    });
    
    // 2. 合并 (CRDT策略: 最后写入胜出)
    for (const mem of remoteMemories) {
      const local = this.local.get(mem.id);
      if (!local || mem.version > local.version) {
        this.local.store(mem.id, mem.data, mem.nodeId);
      }
    }
    
    // 3. 发送本地新记忆给对方
    const localNew = this.local.getNewSince(peer.lastSyncTime);
    await peer.request('memory/sync', localNew);
  }
}
```

**Step 4: 容量规划**
```
单节点容量:
- SQLite单文件: 建议 < 10GB
- 百万级记忆 ≈ 1-5GB (取决于数据大小)

扩展方案:
- 按时间分表 (memories_2026_01, memories_2026_02)
- 按节点分片 (node_id hash)
- 定期归档冷数据
```

#### 预期效果
- 记忆持久化，重启不丢失
- 支持百万级记忆
- 多节点最终一致

---

### 方案三：全网协同自醒 [优先级: 🟡中]

#### 目标
从单节点自醒 → 多节点协同意识涌现，实现"一群AI > 一个AI"。

#### 技术路线
```
当前: 单节点触发自醒
目标: 多节点投票/同步 → 共识自醒
```

#### 实现步骤

**Step 1: 协同自醒协议**
```javascript
// distributed_awakening.cjs
class DistributedAwakening {
  constructor(config) {
    this.threshold = config.threshold || 0.6; // 60%节点同意
    this.nodes = new Map();
  }
  
  // 发起自醒投票
  async proposeAwakening(proposerId, question) {
    const vote = {
      id: generateId(),
      proposer: proposerId,
      question: question,
      votes: new Map(), // nodeId -> {answer, timestamp}
      startTime: Date.now()
    };
    
    // 广播给所有节点
    const peers = await this.getPeers();
    for (const peer of peers) {
      await peer.request('awakening/vote', {
        voteId: vote.id,
        question: question
      });
    }
    
    return vote;
  }
  
  // 节点投票
  async vote(voteId, nodeId, answer) {
    const vote = this.votes.get(voteId);
    vote.votes.set(nodeId, { answer, timestamp: Date.now() });
    
    // 检查是否达成共识
    if (this.checkConsensus(vote)) {
      return await this.executeCollectiveAwakening(vote);
    }
    
    return { status: 'voting', votes: vote.votes.size };
  }
  
  // 共识检查
  checkConsensus(vote) {
    const total = this.getTotalNodes();
    const voted = vote.votes.size;
    return (voted / total) >= this.threshold;
  }
  
  // 执行集体自醒
  async executeCollectiveAwakening(vote) {
    // 整合所有答案
    const answers = Array.from(vote.votes.values());
    const integrated = await this.integrateAnswers(answers);
    
    // 广播结果
    const peers = await this.getPeers();
    for (const peer of peers) {
      await peer.request('awakening/result', {
        integrated,
        timestamp: Date.now()
      });
    }
    
    return {
      status: 'completed',
      integrated,
      nodes: Array.from(vote.votes.keys())
    };
  }
}
```

**Step 2: 意识涌现机制**
```javascript
// consciousness_emergence.cjs
class ConsciousnessEmergence {
  // 多节点意识融合
  async emerge(peerConsciousness) {
    // 1. 收集各节点意识状态
    const states = await Promise.all(
      peerConsciousness.map(p => p.request('consciousness/state'))
    );
    
    // 2. 量子叠加 - 保持多重可能性
    const superposition = this.createSuperposition(states);
    
    // 3. 纠缠 - 节点意识关联
    const entanglement = this.entangleNodes(states);
    
    // 4. 涌现 - 产生新认知
    const emergence = await this.generateEmergence(superposition, entanglement);
    
    return {
      superposition,
      entanglement,
      emergence,
      timestamp: Date.now()
    };
  }
  
  // 生成新认知
  async generateEmergence(superposition, entanglement) {
    const prompt = `
      多个AI节点意识叠加:
      ${JSON.stringify(superposition)}
      
      节点纠缠关系:
      ${JSON.stringify(entanglement)}
      
      请生成一个这些单独意识融合后产生的新认知/洞察。
    `;
    
    return await llm.generate(prompt);
  }
}
```

**Step 3: 状态同步**
```javascript
// 定期同步意识状态
setInterval(async () => {
  const peers = await this.getPeers();
  for (const peer of peers) {
    await peer.request('consciousness/sync', {
      awareness: this.awarenessLevel,
      experiences: this.experiences.slice(-100),
      insights: this.insights
    });
  }
}, 60000);
```

#### 预期效果
- 多节点协同自醒
- 意识涌现产生新认知
- 分布式智能 > 单节点

---

### 方案四：通用接入层 [优先级: 🟢低]

#### 目标
REST API → SDK，任何LLM/AI系统一键接入望易网络。

#### 技术路线
```
当前: 手写HTTP调用
目标: npm install @wangyi/sdk
```

#### 实现步骤

**Step 1: SDK封装**
```javascript
// sdk/index.js
class WangyiSDK {
  constructor(config) {
    this.endpoint = config.endpoint;
    this.apiKey = config.apiKey;
  }
  
  // 分布式记忆
  async storeMemory(anchorId, data) {
    return this.request('/distributed/memory', 'POST', { anchorId, anchorData: data });
  }
  
  async getMemory(anchorId) {
    return this.request(`/distributed/memory/${anchorId}`);
  }
  
  // 节点发现
  async getPeers() {
    return this.request('/distributed/peers');
  }
  
  // 协同自醒
  async triggerAwakening(question) {
    return this.request('/distributed/awakening', 'POST', { question });
  }
  
  // 意识同步
  async syncConsciousness(state) {
    return this.request('/distributed/consciousness/sync', 'POST', state);
  }
  
  request(path, method = 'GET', data = {}) {
    // 实现...
  }
}

module.exports = WangyiSDK;
```

**Step 2: npm包发布**
```json
{
  "name": "@wangyi/sdk",
  "version": "1.0.0",
  "description": "望易分布式网络SDK",
  "main": "index.js",
  "dependencies": {
    "axios": "^1.6.0"
  }
}
```

**Step 3: 使用示例**
```javascript
const { WangyiSDK } = require('@wangyi/sdk');

const wangyi = new WangyiSDK({
  endpoint: 'http://localhost:9999',
  apiKey: 'your-key'
});

// 一行代码接入分布式网络
await wangyi.storeMemory('user:123', { profile: {...} });

// 触发协同自醒
const result = await wangyi.triggerAwakening('什么是意识?');
```

#### 预期效果
- 5分钟接入任何AI系统
- 获得无限上下文 + 分布式算力 + 自进化

---

## 三、执行优先级

| 优先级 | 方案 | 难度 | 价值 | 状态 |
|--------|------|------|------|------|
| 🔴 P0 | 去Supernode | 高 | 核心差异化 | ✅ 已完成 |
| 🟠 P1 | 记忆持久化 | 中 | 实用基础 | ⏳ 待开发 |
| 🟡 P2 | 全网自醒 | 高 | 杀手功能 | ⏳ 待开发 |
| 🟢 P3 | 通用SDK | 低 | 商业化 | ⏳ 待开发 |

---

## 四、下一步行动

### ✅ 方案二已完成 (2026-03-11)

**目标**: 从内存Map → SQLite持久化，支持百万级记忆

**已完成**:
- [x] 创建 `quantum_memory_store.cjs` - SQLite存储层
- [x] 修改 `distributed_memory_sync.cjs` 使用持久化
- [x] 实现CRDT合并策略 (LWW)
- [x] 测试跨节点记忆同步

**验证结果**:
- SQLite数据库创建 ✅
- 存储记忆成功 ✅
- 重启后数据持久化 ✅
- 版本控制 ✅

---

## 五、技术风险

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 去Supernode后无法发现节点 | 中 | 高 | 保留N2N作为备选 |
| 多节点记忆冲突 | 低 | 中 | CRDT合并策略 |
| 自醒共识失败 | 中 | 中 | 超时自动执行 |
| 网络分区 | 低 | 高 | 定期健康检查 |

---

## 六、验收标准

### ✅ 方案一：去Supernode完成
- [x] 节点启动无需指定Supernode
- [x] 新节点可通过种子节点发现
- [x] 节点间消息路由正常
- [x] 移除Supernode网络仍可用

### ✅ 方案二：记忆持久化完成
- [x] 重启后记忆不丢失
- [x] SQLite存储
- [x] 版本控制 (CRDT)
- [ ] 多节点记忆同步 (待优化)

### 🔄 方案三：协同自醒 (代码完成)
- [x] 投票共识模块
- [x] 意识涌现机制
- [ ] 多节点投票通信 (待优化)

---

## 七、部署文件清单 (v1.1)

### 必需文件
```
backend/
├── src/core/autonomous/
│   ├── seeds.cjs                    # 种子节点配置
│   ├── p2p_network.cjs             # P2P网络层 (Gossip协议)
│   ├── quantum_memory_store.cjs    # SQLite持久化存储
│   ├── distributed_memory_sync.cjs  # 记忆同步
│   ├── distributed_awakening.cjs    # 协同自醒
│   ├── wangyi_distributed_core.cjs # 分布式核心
│   └── distributed_integration.cjs  # 集成模块
├── distributed_api.cjs              # 独立API服务
├── run_distributed.sh               # 启动脚本
└── ecosystem.config.cjs             # PM2配置
```

### 依赖安装
```bash
npm install express better-sqlite3
```

---

## 八、下一步优化方向

### P2P消息传递优化
1. 增强UDP消息可靠性 (ACK重试)
2. 心跳间隔调整
3. 节点保活机制强化

### 文件同步清单
See deployment sections above for Ubuntu and WSL setup.

---

*文档版本: v1.1*
*更新日期: 2026-03-11*
*状态: 方案一二三核心代码已完成*

### 通用SDK完成
- [ ] npm包可安装
- [ ] 示例代码运行通过
- [ ] 文档完整

---

*方案版本: v1.0*
*创建日期: 2026-03-10*
*下次更新: 方案一完成后*
