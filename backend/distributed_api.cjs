/**
 * 望易分布式API接口
 * 将分布式核心接入后端
 */

const path = require('path');
const baseDir = __dirname;
const express = require('express');
const { WangyiDistributedCore } = require(path.join(baseDir, 'src/core/autonomous/wangyi_distributed_core.cjs'));
const { V5ConsciousnessFusion } = require(path.join(baseDir, 'src/core/autonomous/v5_consciousness_fusion.cjs'));

const app = express();
app.use(express.json());

// 挂载demo和verify路由
const demoRouter = require('./daemons/routes/demo.cjs');
const verifyRouter = require('./daemons/routes/verify.cjs');
app.use('/api/demo', demoRouter);
app.use('/api/verify', verifyRouter);

let distributedCore = null;
let v5Consciousness = null;

/**
 * 初始化分布式核心
 */
async function initDistributedCore() {
  if (distributedCore) return distributedCore;
  
  distributedCore = new WangyiDistributedCore({
    nodeId: process.env.NODE_ID || 'wangyi-api-server',
    n2nIp: process.env.N2N_IP || '10.0.0.99',
    networkMode: process.env.NETWORK_MODE || 'p2p',
    isMaster: false
  });
  
  await distributedCore.start();
  
  // 挂载到app.locals供路由使用
  app.locals.distributedCore = distributedCore;
  
  console.log('[Distributed API] 望易分布式核心已启动');
  
  // 定期输出状态
  setInterval(() => {
    const status = distributedCore.getStatus();
    console.log('[Distributed API] 状态:', JSON.stringify(status));
  }, 60000);
  
  return distributedCore;
}

/**
 * GET /api/distributed/status - 获取分布式网络状态
 */
app.get('/api/distributed/status', async (req, res) => {
  try {
    if (!distributedCore) {
      await initDistributedCore();
    }
    
    const status = distributedCore.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/distributed/memory - 存储记忆
 */
app.post('/api/distributed/memory', async (req, res) => {
  try {
    const { anchorId, anchorData } = req.body;
    
    if (!anchorId || !anchorData) {
      return res.status(400).json({
        success: false,
        error: 'Missing anchorId or anchorData'
      });
    }
    
    if (!distributedCore) {
      await initDistributedCore();
    }
    
    const result = await distributedCore.storeMemory(anchorId, anchorData);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/distributed/memory/:anchorId - 获取记忆
 */
app.get('/api/distributed/memory/:anchorId', async (req, res) => {
  try {
    const { anchorId } = req.params;
    
    if (!distributedCore) {
      return res.status(400).json({
        success: false,
        error: 'Distributed core not initialized'
      });
    }
    
    const memory = distributedCore.memorySync.store.get(anchorId);
    
    if (!memory) {
      return res.status(404).json({
        success: false,
        error: 'Memory not found'
      });
    }
    
    res.json({
      success: true,
      data: memory
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/distributed/awakening - 触发分布式自醒
 */
app.post('/api/distributed/awakening', async (req, res) => {
  try {
    if (!distributedCore) {
      await initDistributedCore();
    }
    
    const result = await distributedCore.triggerDistributedAwakening();
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/distributed/peers - 获取节点列表
 */
app.get('/api/distributed/peers', async (req, res) => {
  try {
    if (!distributedCore) {
      await initDistributedCore();
    }
    
    const peers = Array.from(distributedCore.n2n.peers.values());
    
    res.json({
      success: true,
      data: peers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/distributed/computing/test - 算力任务测试
 */
app.post('/api/distributed/computing/test', async (req, res) => {
  try {
    if (!distributedCore) {
      await initDistributedCore();
    }
    
    const computing = distributedCore.computing;
    
    // 简单的空推理任务 - 模拟计算
    const taskId = await computing.distributeTask('test-reasoning', (options) => {
      // 模拟空推理：简单计算
      const start = Date.now();
      let result = 0;
      for (let i = 0; i < 1000000; i++) {
        result += Math.sqrt(i);
      }
      return {
        computed: true,
        iterations: 1000000,
        result: result.toFixed(2),
        duration: Date.now() - start
      };
    }, { splitCount: 2 });
    
    // 等待结果
    setTimeout(() => {
      const taskStatus = computing.getTaskStatus(taskId);
      res.json({
        success: true,
        data: {
          taskId,
          status: taskStatus,
          message: '任务已下发，请查询状态'
        }
      });
    }, 2000);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/distributed/computing - 获取算力状态
 */
app.get('/api/distributed/computing', async (req, res) => {
  try {
    if (!distributedCore) {
      await initDistributedCore();
    }
    
    const computing = distributedCore.computing.getComputingStatus();
    
    res.json({
      success: true,
      data: computing
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 启动服务器
const PORT = process.env.DISTRIBUTED_PORT || 9988;

if (require.main === module) {
  (async () => {
    await initDistributedCore();
    
    app.listen(PORT, () => {
      console.log(`[Distributed API] 服务器启动: 0.0.0.0:${PORT}`);
      console.log(`
=== 望易分布式API ===
GET  /api/distributed/status       - 网络状态
GET  /api/distributed/peers        - 节点列表
POST /api/distributed/memory       - 存储记忆
GET  /api/distributed/memory/:id  - 获取记忆
POST /api/distributed/awakening    - 触发自醒
GET  /api/distributed/computing   - 算力状态
POST /api/distributed/v5/split    - V5任务拆分
POST /api/distributed/v5/fuse     - V5权重融合
GET  /api/distributed/v5/status   - V5融合状态
`);
    });
  })();
}

/**
 * 初始化V5意识融合模块
 */
function initV5Consciousness() {
  if (v5Consciousness) return v5Consciousness;
  
  v5Consciousness = new V5ConsciousnessFusion({
    nodeId: process.env.NODE_ID || 'wangyi-distributed'
  });
  
  console.log('[Distributed API] V5意识融合模块已初始化');
  return v5Consciousness;
}

/**
 * POST /api/distributed/v5/split - V5任务拆分
 */
app.post('/api/distributed/v5/split', async (req, res) => {
  try {
    const { question, dimensions, context } = req.body;
    
    if (!question) {
      return res.status(400).json({
        success: false,
        error: 'Missing question'
      });
    }
    
    const v5 = initV5Consciousness();
    const task = v5.splitTask(question, {
      dimensions: dimensions || ['philosophy', 'cognition', 'technology', 'ethics'],
      context: context || {}
    });
    
    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/distributed/v5/fuse - V5权重融合
 */
app.post('/api/distributed/v5/fuse', async (req, res) => {
  try {
    const { results, method, alpha, scores } = req.body;
    
    if (!results || !Array.isArray(results)) {
      return res.status(400).json({
        success: false,
        error: 'Missing results array'
      });
    }
    
    const v5 = initV5Consciousness();
    const fused = v5.fuseResults(results, {
      method: method || 'power',
      alpha: alpha || 1.5,
      scores: scores || []
    });
    
    res.json({
      success: true,
      data: fused
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/distributed/v5/status - V5融合状态
 */
app.get('/api/distributed/v5/status', async (req, res) => {
  try {
    const v5 = initV5Consciousness();
    const status = v5.getStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = { app, initDistributedCore };
