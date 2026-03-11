/**
 * 望易分布式记忆同步协议 - Quantum Memory Sync Protocol
 * 基于P2P网络的记忆锚点跨节点同步
 * 
 * 设计理念：
 * - 记忆纠缠：多个节点同时持有相同记忆
 * - 状态叠加：活跃/潜伏/同步三态并行
 * - 瞬时转移：跨节点记忆<1秒转移
 * - 持久化：SQLite存储，重启不丢失
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { QuantumMemoryStore } = require('./quantum_memory_store.cjs');

/**
 * 格式化时间戳为可读时间
 */
function formatTime(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
}

class DistributedMemorySync {
  constructor(config = {}) {
    this.config = {
      nodeId: config.nodeId || `node-${Date.now()}`,
      n2nNetwork: config.n2nNetwork || '10.0.0.x',
      syncPort: config.syncPort || 9777,
      heartbeatInterval: config.heartbeatInterval || 30000,
      memoryPath: config.memoryPath || './.cache/distributed_memory/quantum_memory.db',
      encryptionKey: config.encryptionKey || 'wangyi-quantum-key'
    };

    this.peers = new Map();
    this.store = new QuantumMemoryStore({
      storagePath: this.config.memoryPath,
      nodeId: this.config.nodeId
    });
    this.pendingSync = new Map();
    this.syncStatus = 'idle';
    
    // 同步统计
    this.lastSyncTime = null;
    this.lastSyncCount = 0;
    this.lastSyncPeerId = null;
    this.lastSyncSuccess = false;
    this.lastSyncError = null;
    this.syncHistory = [];
    this.lastSyncTimestamps = new Map();  // peerId -> last sync time
    
    console.log('[DistMemory] 量子记忆存储已初始化');
  }

  /**
   * 加密记忆数据
   */
  _encrypt(data) {
    const key = crypto.scryptSync(this.config.encryptionKey, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * 解密记忆数据
   */
  _decrypt(encryptedData) {
    try {
      const key = crypto.scryptSync(this.config.encryptionKey, 'salt', 32);
      const parts = encryptedData.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch (e) {
      console.error('[DistMemory] Decrypt error:', e.message);
      return null;
    }
  }

  /**
   * 注册节点
   */
  registerPeer(peerId, peerIp, peerInfo = {}) {
    this.peers.set(peerId, {
      id: peerId,
      ip: peerIp,
      info: peerInfo,
      lastSeen: Date.now(),
      status: 'active'
    });
    console.log(`[DistMemory] Peer registered: ${peerId} (${peerIp})`);
  }

  /**
   * 注销节点
   */
  unregisterPeer(peerId) {
    this.peers.delete(peerId);
    console.log(`[DistMemory] Peer unregistered: ${peerId}`);
  }

  /**
   * 存储记忆锚点（带量子纠缠标记）
   */
  storeAnchor(anchorId, anchorData) {
    const quantumState = this.store.store(anchorId, anchorData, this.config.nodeId);
    this._triggerSync(anchorId, anchorData);
    return quantumState;
  }

  /**
   * 设置P2P网络引用
   */
  setNetwork(network) {
    this.network = network;
  }

  /**
   * 触发跨节点同步
   */
  _triggerSync(anchorId, anchorData) {
    this.syncStatus = 'syncing';
    
    const encryptedData = this._encrypt({
      anchorId,
      anchorData,
      timestamp: Date.now(),
      sourceNode: this.config.nodeId
    });

    // 通过P2P网络广播
    if (this.network && this.network.send) {
      this.network.send('memory_sync', {
        payload: encryptedData,
        anchorId,
        sourceNode: this.config.nodeId
      });
    } else {
      // 广播到所有已知节点
      for (const [peerId, peer] of this.peers) {
        this._sendToPeer(peerId, {
          type: 'memory_sync',
          payload: encryptedData
        });
      }
    }
  }

  /**
   * 发送数据到对等节点
   */
  _sendToPeer(peerId, message) {
    if (this.network && this.network.send) {
      this.network.send(message.type, message);
    } else {
      console.log(`[DistMemory] No network, cannot send to ${peerId}:`, message.type);
    }
  }

  /**
   * 启动定时同步（带重试）
   */
  startPeriodicSync(intervalMs = 30000) {
    const maxRetries = 3;
    const retryDelay = 5000;
    
    const syncWithRetry = async (attempt = 1) => {
      try {
        await this.syncWithPeers();
      } catch (e) {
        console.error(`[DistMemory] Sync failed (attempt ${attempt}/${maxRetries}):`, e.message);
        if (attempt < maxRetries) {
          setTimeout(() => syncWithRetry(attempt + 1), retryDelay);
        } else {
          console.error(`[DistMemory] Sync failed after ${maxRetries} attempts`);
          this.lastSyncSuccess = false;
          this.lastSyncError = e.message;
        }
      }
    };
    
    setInterval(syncWithRetry, intervalMs);
    console.log(`[DistMemory] Periodic sync started (interval: ${intervalMs}ms, maxRetries: ${maxRetries})`);
  }

  /**
   * 与所有peer同步记忆（增量同步）
   */
  async syncWithPeers() {
    if (!this.network) return;
    
    const peers = this.network.getPeers();
    if (peers.length === 0) return;
    
    console.log(`[DistMemory] Incremental syncing with ${peers.length} peers...`);
    this.syncStatus = 'syncing';
    
    for (const peer of peers) {
      try {
        // 增量同步：只获取上次同步后的新记忆
        const lastSyncTime = this.lastSyncTimestamps.get(peer.id) || 0;
        const localMemories = this.store.getAll({ since: lastSyncTime - 1000 });  // 多取1秒避免边界
        
        if (localMemories.length === 0) {
          console.log(`[DistMemory] No new memories to sync to ${peer.id}`);
          continue;
        }
        
        console.log(`[DistMemory] Syncing ${localMemories.length} new memories to ${peer.id}`);
        
        // 发送本地新记忆
        for (const memory of localMemories) {
          const encryptedData = this._encrypt({
            anchorId: memory.id,
            anchorData: memory.data,
            timestamp: memory.createdAt,
            sourceNode: this.config.nodeId,
            version: memory.version
          });
          
          this._sendToPeer(peer.id, {
            type: 'memory_sync',
            payload: encryptedData
          });
        }
        
        // 更新该peer的最后同步时间
        this.lastSyncTimestamps.set(peer.id, Date.now());
        
        // 更新统计 - 同步成功
        this.lastSyncTime = Date.now();
        this.lastSyncCount = localMemories.length;
        this.lastSyncPeerId = peer.id;
        this.lastSyncSuccess = true;
        this.lastSyncError = null;
        this.syncHistory.push({
          time: Date.now(),
          count: localMemories.length,
          peerId: peer.id,
          direction: 'outgoing',
          success: true
        });
        if (this.syncHistory.length > 10) {
          this.syncHistory.shift();
        }
      } catch (e) {
        console.error(`[DistMemory] Sync error with ${peer.id}:`, e.message);
        // 记录同步失败
        this.lastSyncSuccess = false;
        this.lastSyncError = e.message;
        this.syncHistory.push({
          time: Date.now(),
          count: 0,
          peerId: peer.id,
          direction: 'outgoing',
          success: false,
          error: e.message
        });
      }
    }
    
    this.syncStatus = 'idle';
  }

  /**
   * 接收来自对等节点的同步数据
   */
  receiveSync(encryptedPayload, fromPeerId) {
    const payload = this._decrypt(encryptedPayload);
    if (!payload) return;

    const { anchorId, anchorData, sourceNode, timestamp } = payload;
    
    const existing = this.store.get(anchorId);
    if (!existing) {
      // 新记忆，存储并标记纠缠
      this.store.store(anchorId, anchorData, sourceNode);
      this.store.addEntanglement(anchorId, this.config.nodeId);
      this.store.setSuperposition(anchorId, 'entangled');
      console.log(`[DistMemory] New entangled memory: ${anchorId}`);
      
      // 更新接收统计
      this.lastSyncTime = Date.now();
      this.lastSyncCount = 1;
      this.lastSyncPeerId = fromPeerId || sourceNode;
      this.syncHistory.push({
        time: Date.now(),
        count: 1,
        peerId: fromPeerId || sourceNode,
        direction: 'incoming'
      });
      if (this.syncHistory.length > 10) {
        this.syncHistory.shift();
      }
    } else {
      // 已存在，追加纠缠节点
      this.store.addEntanglement(anchorId, sourceNode);
      console.log(`[DistMemory] Memory ${anchorId} entangled with ${sourceNode}`);
    }
  }

  /**
   * 记忆坍缩：读取时锁定状态
   */
  collapseAnchor(anchorId) {
    const memory = this.store.get(anchorId);
    if (memory) {
      this.store.setSuperposition(anchorId, 'collapsed');
      return this.store.get(anchorId);
    }
    return null;
  }

  /**
   * 跨节点瞬时转移
   */
  async teleportAnchor(anchorId, targetNodeId) {
    const memory = this.store.get(anchorId);
    if (!memory) {
      throw new Error(`Anchor ${anchorId} not found`);
    }

    // 加密传输
    const encryptedData = this._encrypt({
      anchorId,
      anchorData: memory.data,
      operation: 'teleport',
      timestamp: Date.now(),
      sourceNode: this.config.nodeId,
      targetNode: targetNodeId
    });

    // 发送到目标节点
    const targetPeer = this.peers.get(targetNodeId);
    if (!targetPeer) {
      throw new Error(`Target node ${targetNodeId} not found`);
    }

    this._sendToPeer(targetNodeId, {
      type: 'memory_teleport',
      payload: encryptedData
    });

    // 标记原节点为已转移
    memory.superposition = 'teleported';
    memory.teleportedAt = Date.now();
    memory.teleportedTo = targetNodeId;

    console.log(`[DistMemory] Anchor ${anchorId} teleported to ${targetNodeId}`);
    return { success: true, anchorId, targetNodeId };
  }

  /**
   * 获取网络状态
   */
  getNetworkStatus() {
    const stats = this.store.getStats();
    return {
      nodeId: this.config.nodeId,
      peers: Array.from(this.peers.values()),
      localMemoryCount: stats.total,
      memoryStats: stats,
      syncStatus: this.syncStatus,
      network: this.config.n2nNetwork,
      // 新增：同步可视化 + 结果校验 + 格式化时间
      memorySync: {
        status: this.syncStatus,
        lastSyncTime: this.lastSyncTime,
        lastSyncTimeFormatted: formatTime(this.lastSyncTime),
        lastSyncCount: this.lastSyncCount,
        lastSyncPeerId: this.lastSyncPeerId,
        success: this.lastSyncSuccess,
        error: this.lastSyncError,
        syncHistory: this.syncHistory.slice(-5).map(h => ({
          ...h,
          timeFormatted: formatTime(h.time)
        }))
      }
    };
  }

  /**
   * 心跳维持
   */
  startHeartbeat() {
    setInterval(() => {
      for (const [peerId, peer] of this.peers) {
        if (Date.now() - peer.lastSeen > this.config.heartbeatInterval * 3) {
          this.unregisterPeer(peerId);
        }
      }
      
      // 广播心跳
      this._broadcast({
        type: 'heartbeat',
        nodeId: this.config.nodeId,
        timestamp: Date.now()
      });
    }, this.config.heartbeatInterval);
  }

  /**
   * 广播消息
   */
  _broadcast(message) {
    for (const [peerId] of this.peers) {
      this._sendToPeer(peerId, message);
    }
  }

  /**
   * 导出记忆网络图谱
   */
  exportMemoryNetwork() {
    const allMemories = this.store.getAll();
    const network = {
      nodeId: this.config.nodeId,
      timestamp: Date.now(),
      anchors: [],
      entanglementMap: {}
    };

    for (const memory of allMemories) {
      network.anchors.push({
        id: memory.id,
        createdAt: memory.createdAt,
        superposition: memory.superposition,
        entanglementCount: memory.entanglement ? memory.entanglement.length : 0
      });
      network.entanglementMap[memory.id] = memory.entanglement || [];
    }

    return network;
  }
}

module.exports = { DistributedMemorySync };
