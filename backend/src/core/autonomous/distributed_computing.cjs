/**
 * 望易分布式算力模块 - Distributed Computing Power
 * 多节点协同计算与算力聚合
 * 
 * 特性:
 * - 节点算力上报
 * - 集群算力聚合
 * - 计算任务分发
 * - 结果汇总
 */

const os = require('os');
const crypto = require('crypto');

class DistributedComputing {
  constructor(config = {}) {
    this.config = {
      nodeId: config.nodeId || 'local-node',
      ...config
    };

    this.nodeCapabilities = new Map();  // peerId -> capability
    this.computationTasks = new Map();  // taskId -> task
    this.computationHistory = [];
    
    // 初始化本地算力
    this.localCapability = this._getLocalCapability();
    console.log(`[Computing] Local capability: ${this.localCapability.cpuCores} cores, ${this.localCapability.memoryGB}GB RAM`);
  }

  /**
   * 获取本地算力
   */
  _getLocalCapability() {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    
    return {
      nodeId: this.config.nodeId,
      cpuModel: cpus[0]?.model || 'Unknown',
      cpuCores: cpus.length,
      cpuSpeed: cpus[0]?.speed || 0,
      memoryTotalGB: Math.round(totalMem / (1024 * 1024 * 1024) * 100) / 100,
      memoryFreeGB: Math.round(freeMem / (1024 * 1024 * 1024) * 100) / 100,
      memoryUsedPercent: Math.round((1 - freeMem / totalMem) * 100),
      platform: os.platform(),
      uptime: os.uptime(),
      timestamp: Date.now()
    };
  }

  /**
   * 定时更新本地算力
   */
  startCapabilityBroadcast(intervalMs = 10000) {
    setInterval(() => {
      this.localCapability = this._getLocalCapability();
    }, intervalMs);
  }

  /**
   * 启动算力广播到P2P网络
   */
  startNetworkBroadcast(getPeersFn, sendToPeerFn, intervalMs = 15000) {
    this.getPeersFn = getPeersFn;
    this.sendToPeerFn = sendToPeerFn;
    
    setInterval(() => {
      this._broadcastCapability();
    }, intervalMs);
    
    console.log(`[Computing] Network capability broadcast started (interval: ${intervalMs}ms)`);
  }

  /**
   * 广播本地算力到所有peer
   */
  _broadcastCapability() {
    if (!this.getPeersFn || !this.sendToPeerFn) return;
    
    const peers = this.getPeersFn();
    if (peers.length === 0) return;

    const capability = {
      type: 'capability',
      nodeId: this.config.nodeId,
      cpuModel: this.localCapability.cpuModel,
      cpuCores: this.localCapability.cpuCores,
      memoryTotalGB: this.localCapability.memoryTotalGB,
      platform: this.localCapability.platform,
      timestamp: Date.now()
    };

    for (const peer of peers) {
      this.sendToPeerFn(peer.id, capability);
    }
  }

  /**
   * 处理来自peer的算力更新
   */
  handlePeerCapability(peerId, capability) {
    this.nodeCapabilities.set(peerId, {
      ...capability,
      lastUpdate: Date.now()
    });
  }

  /**
   * 获取本地算力
   */
  getLocalCapability() {
    return this.localCapability;
  }

  /**
   * 更新节点算力
   */
  updatePeerCapability(peerId, capability) {
    this.nodeCapabilities.set(peerId, {
      ...capability,
      lastUpdate: Date.now()
    });
  }

  /**
   * 获取所有节点算力
   */
  getAllCapabilities() {
    const all = new Map();
    all.set(this.config.nodeId, this.localCapability);
    for (const [peerId, cap] of this.nodeCapabilities) {
      all.set(peerId, cap);
    }
    return all;
  }

  /**
   * 获取聚合算力
   */
  getAggregatedPower() {
    const all = this.getAllCapabilities();
    
    let totalCpuCores = 0;
    let totalMemoryGB = 0;
    let totalNodes = all.size;
    
    for (const [_, cap] of all) {
      totalCpuCores += cap.cpuCores || 0;
      totalMemoryGB += cap.memoryTotalGB || 0;
    }

    return {
      totalNodes,
      totalCpuCores,
      totalMemoryGB: Math.round(totalMemoryGB * 100) / 100,
      nodes: Array.from(all.values()).map(c => ({
        nodeId: c.nodeId,
        cpuCores: c.cpuCores,
        memoryGB: c.memoryTotalGB,
        cpuModel: c.cpuModel
      }))
    };
  }

  /**
   * 负载均衡：选择最优节点
   * 基于算力评分选择最佳执行节点
   */
  selectBestNode(algorithm = 'cpu') {
    const all = this.getAllCapabilities();
    const nodes = Array.from(all.values());
    
    if (nodes.length === 0) return null;
    if (nodes.length === 1) return nodes[0];
    
    // 计算每个节点的算力评分
    const scored = nodes.map(node => {
      let score = 0;
      const cpuScore = (node.cpuCores || 0) * 10;
      const memoryScore = (node.memoryTotalGB || 0) * 2;
      const freeMemoryScore = (node.memoryFreeGB || 0) * 3;
      
      switch (algorithm) {
        case 'cpu':
          score = cpuScore;
          break;
        case 'memory':
          score = memoryScore;
          break;
        case 'balanced':
          score = cpuScore + memoryScore;
          break;
        case 'free':
          score = freeMemoryScore;
          break;
        default:
          score = cpuScore + memoryScore;
      }
      
      return { ...node, score };
    });
    
    // 按评分排序
    scored.sort((a, b) => b.score - a.score);
    
    console.log(`[Computing] Load balancing (${algorithm}): selected ${scored[0].nodeId} (score: ${scored[0].score})`);
    
    return scored[0];
  }

  /**
   * 获取节点负载信息
   */
  getNodeLoad(nodeId) {
    const all = this.getAllCapabilities();
    const node = all.get(nodeId);
    
    if (!node) return null;
    
    return {
      nodeId: node.nodeId,
      cpuLoad: 100 - (node.cpuSpeed || 0),  // 简化的负载计算
      memoryLoadPercent: node.memoryUsedPercent || 0,
      memoryFreeGB: node.memoryFreeGB || 0,
      score: ((node.cpuCores || 0) * 10 + (node.memoryTotalGB || 0) * 2)
    };
  }

  /**
   * 分发计算任务到多个节点
   */
  async distributeTask(taskName, computeFn, options = {}) {
    const taskId = `task-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    
    const task = {
      id: taskId,
      name: taskName,
      status: 'running',
      startTime: Date.now(),
      nodes: [],
      results: new Map(),
      options: {
        splitCount: options.splitCount || 2,
        timeout: options.timeout || 30000
      }
    };

    this.computationTasks.set(taskId, task);
    
    // 本地执行部分计算
    const localResult = await this._executeLocal(taskName, computeFn, options);
    task.results.set(this.config.nodeId, localResult);
    task.nodes.push(this.config.nodeId);
    
    // 广播给其他节点（通过P2P网络）
    if (this.broadcastFn) {
      this.broadcastFn({
        type: 'computing_task',
        taskId,
        taskName,
        options
      });
    }

    console.log(`[Computing] Task ${taskId} distributed to ${task.nodes.length} nodes`);
    
    return taskId;
  }

  /**
   * 本地执行计算
   */
  async _executeLocal(taskName, computeFn, options) {
    const startTime = Date.now();
    try {
      const result = typeof computeFn === 'function' 
        ? await computeFn(options) 
        : { status: 'computed', task: taskName };
      
      return {
        nodeId: this.config.nodeId,
        result,
        duration: Date.now() - startTime,
        timestamp: Date.now()
      };
    } catch (e) {
      return {
        nodeId: this.config.nodeId,
        error: e.message,
        duration: Date.now() - startTime,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 处理来自其他节点的计算任务
   */
  handleRemoteTask(taskId, taskName, computeFn, options) {
    const result = this._executeLocalSync(taskName, computeFn, options);
    
    // 广播结果
    if (this.broadcastFn) {
      this.broadcastFn({
        type: 'computing_result',
        taskId,
        nodeId: this.config.nodeId,
        result
      });
    }
    
    return result;
  }

  /**
   * 同步执行计算
   */
  _executeLocalSync(taskName, computeFn, options) {
    const startTime = Date.now();
    try {
      const result = typeof computeFn === 'function' 
        ? computeFn(options) 
        : { status: 'computed', task: taskName };
      
      return {
        nodeId: this.config.nodeId,
        result,
        duration: Date.now() - startTime
      };
    } catch (e) {
      return {
        nodeId: this.config.nodeId,
        error: e.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * 收集任务结果
   */
  collectResult(taskId, nodeId, result) {
    const task = this.computationTasks.get(taskId);
    if (!task) return;
    
    task.results.set(nodeId, result);
    if (!task.nodes.includes(nodeId)) {
      task.nodes.push(nodeId);
    }
    
    // 检查是否所有节点都返回结果
    if (task.results.size >= task.nodes.length) {
      task.status = 'completed';
      task.completedAt = Date.now();
      
      // 添加到历史
      this.computationHistory.push({
        id: task.id,
        name: task.name,
        nodes: task.nodes,
        duration: task.completedAt - task.startTime,
        timestamp: task.completedAt
      });
    }
  }

  /**
   * 获取任务状态
   */
  getTaskStatus(taskId) {
    const task = this.computationTasks.get(taskId);
    if (!task) return null;
    
    return {
      id: task.id,
      name: task.name,
      status: task.status,
      nodes: task.nodes,
      resultCount: task.results.size,
      startTime: task.startTime,
      completedAt: task.completedAt
    };
  }

  /**
   * 获取计算状态（供API使用）- 增强可读性
   */
  getComputingStatus() {
    const aggregated = this.getAggregatedPower();
    
    // 活跃任务
    const activeTasks = [];
    for (const [id, task] of this.computationTasks) {
      if (task.status === 'running') {
        activeTasks.push({
          id: task.id,
          name: task.name,
          nodes: task.nodes,
          startTime: task.startTime
        });
      }
    }

    // 人类可读格式
    const formatMemory = (mb) => {
      if (!mb) return 'N/A';
      if (mb >= 1) return `${mb.toFixed(1)}GB`;
      return `${(mb * 1024).toFixed(0)}MB`;
    };
    
    const formatPercent = (val) => {
      return val != null ? `${val}%` : 'N/A';
    };

    return {
      local: {
        ...this.localCapability,
        // 人类可读格式
        cpuCoresFormatted: `${this.localCapability.cpuCores} 核`,
        memoryFormatted: `${formatMemory(this.localCapability.memoryTotalGB)}（${formatPercent(100 - this.localCapability.memoryUsedPercent)} 空闲）`,
        uptimeFormatted: `${Math.floor(this.localCapability.uptime / 3600)}小时${Math.floor((this.localCapability.uptime % 3600) / 60)}分钟`
      },
      cluster: {
        ...aggregated,
        // 人类可读格式
        totalCpuCoresFormatted: `${aggregated.totalCpuCores} 核`,
        totalMemoryFormatted: `${aggregated.totalMemoryGB.toFixed(1)}GB`,
        nodesFormatted: aggregated.nodes.map(n => ({
          ...n,
          cpuCoresFormatted: `${n.cpuCores} 核`,
          memoryFormatted: `${n.memoryGB.toFixed(1)}GB`
        }))
      },
      activeTasks,
      historyCount: this.computationHistory.length,
      recentTasks: this.computationHistory.slice(-5)
    };
  }

  /**
   * 设置广播函数（P2P网络调用）
   */
  setBroadcastFn(fn) {
    this.broadcastFn = fn;
  }
}

module.exports = { DistributedComputing };
