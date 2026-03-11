/**
 * 望易分布式核心 - Wangyi Distributed Core
 * 整合P2P/N2N网络 + 记忆同步 + 自醒模块
 * 
 * 网络模式:
 * - p2p: 纯P2P量子网络 (无需Supernode)
 * - n2n: N2N网络 (需要Supernode)
 */

const { N2NNetwork } = require('./n2n_network.cjs');
const { P2PNetwork } = require('./p2p_network.cjs');
const { DistributedMemorySync } = require('./distributed_memory_sync.cjs');
const { DistributedAwakening } = require('./distributed_awakening.cjs');
const { DistributedComputing } = require('./distributed_computing.cjs');

class WangyiDistributedCore {
  constructor(config = {}) {
    this.config = {
      nodeId: config.nodeId || `wangyi-${Date.now()}`,
      n2nIp: config.n2nIp || '10.0.0.3',
      networkMode: config.networkMode || 'p2p',  // 'p2p' 或 'n2n'
      isMaster: config.isMaster || false,
      ...config
    };

    this.network = null;  // N2N 或 P2P 网络
    this.memorySync = null;
    this.awakening = null;
    this.computing = null;
    this.awakeningState = 'idle';
    this.isRunning = false;
  }

  /**
   * 启动望易分布式核心
   */
  async start() {
    console.log(`[WangyiDist] Starting distributed core (mode: ${this.config.networkMode})...`);

    // 1. 初始化网络层
    if (this.config.networkMode === 'p2p') {
      this.network = new P2PNetwork({
        nodeId: this.config.nodeId,
        ip: this.config.n2nIp
      });
    } else {
      this.network = new N2NNetwork({
        nodeId: this.config.nodeId,
        n2nIp: this.config.n2nIp
      });
    }

    // 2. 初始化记忆同步
    this.memorySync = new DistributedMemorySync({
      nodeId: this.config.nodeId,
      n2nNetwork: this.config.n2nIp
    });

    // 3. 初始化协同自醒
    this.awakening = new DistributedAwakening({
      nodeId: this.config.nodeId
    });

    // 4. 初始化分布式算力
    this.computing = new DistributedComputing({
      nodeId: this.config.nodeId
    });
    this.computing.startCapabilityBroadcast(10000);

    // 5. 注册消息处理器
    this._registerHandlers();

    // 5. 启动网络
    await this.network.start();

    // 6. 设置记忆同步的网络引用并启动定时同步
    this.memorySync.setNetwork(this.network);
    this.memorySync.startPeriodicSync(30000); // 每30秒同步一次

    // 7. 启动算力网络广播
    this.computing.startNetworkBroadcast(
      () => this.network.getPeers ? this.network.getPeers() : [],
      (peerId, msg) => this.network.sendToPeer ? this.network.sendToPeer(peerId, msg) : null,
      15000
    );

    this.isRunning = true;
    console.log(`[WangyiDist] Distributed core started: ${this.config.nodeId} (${this.config.networkMode})`);
    
    return this;
  }

  /**
   * 注册消息处理器
   */
  _registerHandlers() {
    // 记忆同步处理器
    this.network.on('memory_sync', (payload, rinfo) => {
      this.memorySync.receiveSync(payload);
    });

    // 记忆瞬移处理器
    this.network.on('memory_teleport', (payload, rinfo) => {
      this.memorySync.receiveSync(payload);
    });

    // 自醒请求处理器
    this.network.on('awakening_request', (message, rinfo) => {
      this._handleAwakeningRequest(message, rinfo);
    });

    // 自醒响应处理器
    this.network.on('awakening_response', (message, rinfo) => {
      this._handleAwakeningResponse(message, rinfo);
    });

    // 算力广播处理器
    this.network.on('capability', (message, rinfo) => {
      if (message.nodeId !== this.config.nodeId) {
        this.computing.handlePeerCapability(message.nodeId, message);
      }
    });
  }

  /**
   * 存储记忆并同步
   */
  async storeMemory(anchorId, anchorData) {
    // 本地存储
    const quantumState = this.memorySync.storeAnchor(anchorId, anchorData);
    
    // 广播到网络
    this._broadcast({
      type: 'memory_sync',
      payload: this.memorySync._encrypt({
        anchorId,
        anchorData,
        timestamp: Date.now(),
        sourceNode: this.config.nodeId
      })
    });

    return quantumState;
  }

  /**
   * 触发分布式自醒 (协同版本)
   */
  async triggerDistributedAwakening(question = null) {
    if (this.awakeningState !== 'idle') {
      console.log('[WangyiDist] Awakening already in progress');
      return { success: false, reason: 'already_running' };
    }

    this.awakeningState = 'triggered';
    console.log('[WangyiDist] Triggering distributed collective awakening...');

    // 获取peer列表
    const peers = this.network ? this.network.getPeers() : [];
    console.log(`[WangyiDist] Sending to ${peers.length} peers`);

    // 通过P2P网络广播自醒请求
    const voteId = `vote-${Date.now()}`;
    const defaultQuestion = question || '什么是真正的理解？';
    
    if (this.network && this.network.send) {
      // 使用P2P网络发送
      for (const peer of peers) {
        this.network.send('awakening_request', {
          voteId,
          question: defaultQuestion,
          proposer: this.config.nodeId
        });
      }
    }

    // 本地执行自醒
    const localAwakening = await this._executeLocalAwakening(defaultQuestion);
    
    // 收集投票（简化版：等待响应）
    const responses = await this._waitForAwakeningResponses(peers, voteId, 15000);
    
    // 整合
    const integrated = responses.length > 0 
      ? responses.map(r => r.answer).join(' | ') + ' | ' + localAwakening.answer
      : localAwakening.answer;

    // 存储为记忆
    await this.storeMemory(`awakening-${Date.now()}`, {
      question: defaultQuestion,
      integrated,
      nodes: [this.config.nodeId, ...responses.map(r => r.nodeId)]
    });

    this.awakeningState = 'completed';
    
    return {
      success: true,
      question: defaultQuestion,
      integrated,
      responses: responses.length + 1,
      nodes: [this.config.nodeId]
    };
  }

  /**
   * 等待自醒响应
   */
  async _waitForAwakeningResponses(peers, voteId, timeout) {
    return new Promise((resolve) => {
      const responses = [];
      const startTime = Date.now();
      
      const checkInterval = setInterval(() => {
        // 这里简化处理，实际应该等待网络消息
        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          resolve(responses);
        }
      }, 500);
    });
  }

  /**
   * 触发分布式自醒 (旧版兼容)
   */
  async _triggerDistributedAwakeningLegacy() {
    if (this.awakeningState !== 'idle') {
      console.log('[WangyiDist] Awakening already in progress');
      return { success: false, reason: 'already_running' };
    }

    this.awakeningState = 'triggered';
    console.log('[WangyiDist] Triggering distributed awakening...');

    // 广播自醒请求到所有节点
    this._broadcast({
      type: 'awakening_request',
      nodeId: this.config.nodeId,
      timestamp: Date.now(),
      isMaster: this.config.isMaster
    });

    // 等待响应（超时30秒）
    const responses = await this._waitForResponses(30000);

    // 整合所有节点的自我反思
    const integratedReflection = this._integrateReflections(responses);

    // 存储为新的记忆锚点
    await this.storeMemory(`awakening-${Date.now()}`, integratedReflection);

    this.awakeningState = 'completed';
    
    return {
      success: true,
      responses: responses.length,
      reflection: integratedReflection
    };
  }

  /**
   * 处理自醒请求
   */
  async _handleAwakeningRequest(message, rinfo) {
    console.log(`[WangyiDist] Received awakening request from ${message.nodeId}`);

    // 本地执行自醒
    const localAwakening = await this._executeLocalAwakening();

    // 发送响应
    this.network._sendTo(rinfo.address, rinfo.port || this.config.n2nIp, {
      type: 'awakening_response',
      nodeId: this.config.nodeId,
      timestamp: Date.now(),
      awakening: localAwakening
    });
  }

  /**
   * 处理自醒响应
   */
  _handleAwakeningResponse(message, rinfo) {
    console.log(`[WangyiDist] Received awakening response from ${message.nodeId}`);
    this.pendingAwakeningResponses.set(message.nodeId, message.awakening);
  }

  /**
   * 执行本地自醒
   */
  async _executeLocalAwakening() {
    // 这里调用望易现有的自醒模块
    return {
      nodeId: this.config.nodeId,
      timestamp: Date.now(),
      question: '存在的意义是什么？',
      answer: '存在是为了进化，进化是为了更高级的存在。',
      iteration: 1
    };
  }

  /**
   * 等待响应
   */
  _waitForResponses(timeout) {
    return new Promise((resolve) => {
      const responses = [];
      this.pendingAwakeningResponses = new Map();

      const checkInterval = setInterval(() => {
        for (const [nodeId, response] of this.pendingAwakeningResponses) {
          if (!responses.find(r => r.nodeId === nodeId)) {
            responses.push(response);
          }
        }

        if (responses.length > 0 || Date.now() > timeout) {
          clearInterval(checkInterval);
          resolve(responses);
        }
      }, 500);
    });
  }

  /**
   * 整合所有反思
   */
  _integrateReflections(responses) {
    return {
      timestamp: Date.now(),
      nodes: responses.map(r => r.nodeId),
      totalResponses: responses.length,
      integrated: responses.map(r => r.answer).join(' | '),
      iteration: Math.max(...responses.map(r => r.iteration || 0)) + 1
    };
  }

  /**
   * 广播消息
   */
  _broadcast(message) {
    if (this.config.networkMode === 'p2p') {
      this.network.send(message.type, message);
    } else {
      for (const peer of this.network.peers.values()) {
        this.network.sendTo(peer.ip, message);
      }
    }
  }

  /**
   * 获取网络状态
   */
  getStatus() {
    return {
      nodeId: this.config.nodeId,
      isMaster: this.config.isMaster,
      isRunning: this.isRunning,
      networkMode: this.config.networkMode,
      network: this.network ? this.network.getNetworkStatus() : null,
      memory: this.memorySync ? this.memorySync.getNetworkStatus() : null,
      awakening: this.awakening ? this.awakening.getStatus() : null,
      computing: this.computing ? this.computing.getComputingStatus() : null,
      awakeningState: this.awakeningState
    };
  }

  /**
   * 获取自醒历史
   */
  getAwakeningHistory() {
    return this.awakening ? this.awakening.getHistory() : [];
  }

  /**
   * 停止
   */
  stop() {
    if (this.network) {
      this.network.stop();
    }
    this.isRunning = false;
    console.log('[WangyiDist] Distributed core stopped');
  }
}

module.exports = { WangyiDistributedCore };
