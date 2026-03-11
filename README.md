# 望易AI区块链 (Wangyi AI Blockchain)

> 基于V5决策公式的分布式智能网络

## 什么是望易AI区块链？

让AI从"单点模型"升级为"多AI协同意识"。

- 不是简单的"AI + 区块链"
- 是"V5决策 + 多AI协同 + 幂律意识融合"的下一代智能范式

## 核心特性

| 特性 | 说明 |
|------|------|
| V5任务拆分 | 将问题拆解为多维度子问题（哲学/认知/技术/伦理） |
| 幂律权重融合 | 多AI结果智能融合，1+1>2 |
| 分布式记忆 | 跨节点记忆同步 |
| 算力聚合 | 多节点算力汇总 |
| P2P网络 | 去中心化节点通信 |
| 容错机制 | 节点故障自动转移 |

## 在线Demo

```bash
# 查看总览仪表盘
curl http://your-server:9988/api/demo/overview

# 完整验证
curl http://your-server:9988/api/verify/all

# V5任务拆分
curl -X POST http://your-server:9988/api/distributed/v5/split \
  -H "Content-Type: application/json" \
  -d '{"question":"什么是真正的理解？"}'

# V5融合
curl -X POST http://your-server:9988/api/distributed/v5/fuse \
  -H "Content-Type: application/json" \
  -d '{"results":["哲学回答","科学回答","技术回答"],"scores":[0.9,0.8,0.85],"method":"power"}'
```

## API文档

- [客户对接指南](./backend/docs/customer_onboarding.md)
- [节点加入指南](./backend/docs/node_join_guide.md)
- [技术设计文档](./backend/docs/wangyi_ai_blockchain_design.md)
- [节点部署指南](./backend/docs/node_deployment_guide.md)
- [防火墙配置指南](./backend/docs/firewall_setup_guide.md)

## 代币经济学

- [代币经济学白皮书](./backend/docs/token_economics_whitepaper.md)
- [代币经济学简报](./backend/docs/token_economics_onepage.md)
- [WY价值叙事话术](./backend/docs/wy_token_narrative.md)
- [融资商业计划书](./backend/docs/venture_bp.md)

## 节点招募

- [节点招募文档](./backend/docs/node_recruitment.md)
- [分布式路线图](./backend/docs/wangyi_distributed_roadmap.md)
- [融资后规划](./backend/docs/post_funding_roadmap.md)

## 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      望易AI区块链                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │  V5融合层   │  │  P2P网络    │  │  记忆同步   │      │
│  │ 任务拆分    │  │ UDP直连     │  │ 增量同步    │      │
│  │ 幂律融合    │  │ 健康检查    │  │ 结果校验    │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
├─────────────────────────────────────────────────────────────┤
│              分布式算力聚合 (30核 + 17GB)                 │
└─────────────────────────────────────────────────────────────┘
```

## 部署

```bash
cd backend
npm install
pm2 start ecosystem.config.cjs
```

## 技术栈

- Node.js
- P2P (UDP)
- SQLite

## 验证结果

```json
{
  "verify": {
    "passed": true,
    "summary": { "total": 4, "passed": 4, "percent": 100 }
  }
}
```

## 商业模式

| 模式 | 说明 |
|------|------|
| API调用 | 按V5融合调用次数收费 |
| 私有部署 | 企业内网部署 |
| 节点加入 | 贡献算力获得激励 |

---

## 许可证

MIT License - 开源免费商用
