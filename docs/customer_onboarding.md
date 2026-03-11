# 望易AI区块链 - 客户对接指南

## 一、快速开始

### 1. 基础验证
```bash
# 查看网络状态
curl http://82.156.189.26:9988/api/demo/overview

# 运行完整验证
curl http://82.156.189.26:9988/api/verify/all
```

### 2. 核心API清单

| API | 方法 | 说明 |
|-----|------|------|
| `/api/distributed/status` | GET | 完整状态 |
| `/api/distributed/memory` | POST | 创建记忆 |
| `/api/distributed/v5/split` | POST | V5任务拆分 |
| `/api/distributed/v5/fuse` | POST | V5融合 |
| `/api/demo/overview` | GET | 演示总览 |
| `/api/verify/all` | GET | 验证报告 |

---

## 二、对接示例

### 1. Python SDK示例
```python
import requests

BASE_URL = "http://82.156.189.26:9988"

class WangyiClient:
    def __init__(self, base_url):
        self.base = base_url
    
    def get_status(self):
        return requests.get(f"{self.base}/api/distributed/status").json()
    
    def v5_split(self, question):
        return requests.post(
            f"{self.base}/api/distributed/v5/split",
            json={"question": question}
        ).json()
    
    def v5_fuse(self, results, scores, method="power", alpha=1.5):
        return requests.post(
            f"{self.base}/api/distributed/v5/fuse",
            json={"results": results, "scores": scores, "method": method, "alpha": alpha}
        ).json()

# 使用
client = WangyiClient("http://your-server:9988")
print(client.get_status())
```

### 2. Node.js SDK示例
```javascript
const axios = require('axios');
const BASE = 'http://your-server:9988';

const wangyi = {
  async status() {
    return (await axios.get(`${BASE}/api/distributed/status`)).data;
  },
  
  async v5Split(question) {
    return (await axios.post(`${BASE}/api/distributed/v5/split`, { question })).data;
  },
  
  async v5Fuse(results, scores, method = 'power', alpha = 1.5) {
    return (await axios.post(`${BASE}/api/distributed/v5/fuse`, { 
      results, scores, method, alpha 
    })).data;
  }
};

const result = await wangyi.v5Split("什么是真正的理解？");
console.log(result);
```

---

## 三、典型对接流程

### 场景1：单次V5融合
```
1. 调用 /api/distributed/v5/split 拆分问题
   ↓
2. 将子问题发送给不同AI处理
   ↓
3. 收集AI回答，调用 /api/distributed/v5/fuse
   ↓
4. 获得融合结果
```

### 场景2：分布式记忆
```
1. 创建记忆 /api/distributed/memory
   ↓
2. 自动同步到其他节点
   ↓
3. 查询 /api/distributed/memory/:id
```

---

## 四、参数说明

### V5拆分参数
```javascript
{
  "question": "问题内容",
  "dimensions": ["philosophy", "cognition", "technology", "ethics"],  // 可选
  "context": { "type": "academic" }  // 可选: academic, creative
}
```

### V5融合参数
```javascript
{
  "results": ["AI回答1", "AI回答2", "AI回答3"],
  "scores": [0.9, 0.8, 0.85],  // 各回答质量评分 0-1
  "method": "power",  // linear, exponential, power
  "alpha": 1.5  // 幂律指数，仅power方法有效
}
```

---

## 五、错误码

| 错误 | 说明 |
|------|------|
| 400 | 参数错误 |
| 500 | 服务内部错误 |
| success: false | 操作失败 |

---

## 六、联系支持

- 技术支持: twcosmos@foxmail.com
- 商务咨询: twcosmos@foxmail.com
- 文档: twcosmos@foxmail.com

---

*文档版本: 1.0*
