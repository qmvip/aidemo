/**
 * 望易P2P量子网络层
 * 去中心化节点发现与通信 - 无需Supernode
 * 
 * 核心特性:
 * - UDP广播发现 + TCP长连接通信
 * - 种子节点初始引导
 * - 量子态路由 (基于节点ID寻址)
 * - 消息可靠传递 (ACK重试)
 * - 心跳保活
 */

const dgram = require('dgram');
const net = require('net');
const crypto = require('crypto');
const seeds = require('./seeds.cjs');

class P2PNetwork {
  constructor(config = {}) {
    this.config = {
      nodeId: config.nodeId || `wangyi-${Date.now()}`,
      ip: config.ip || '127.0.0.1',
      port: config.port || seeds.defaults.port,
      tcpPort: config.tcpPort || (seeds.defaults.port + 10000),  // TCP端口 = UDP端口 + 10000
      seeds: config.seeds || seeds.list,
      gossipInterval: config.gossipInterval || 3000,
      heartbeatInterval: config.heartbeatInterval || 5000,
      peerTimeout: config.peerTimeout || 60000,
      maxPeers: config.maxPeers || seeds.defaults.maxPeers,
      retryCount: 3,
      retryDelay: 1000
    };

    this.peers = new Map();           // peerId -> {id, ip, port, lastSeen, services, retries, tcpConn}
    this.tcpServer = null;
    this.udpServer = null;
    this.isRunning = false;
    
    this.messageHandlers = new Map();
    this.pendingRequests = new Map();
    this.messageCache = new Map();
    this.pendingAcks = new Map();
  }

  /**
   * 启动P2P网络 - 同时启动UDP和TCP
   */
  async start() {
    return new Promise(async (resolve, reject) => {
      try {
        // 启动TCP服务器（用于接收入站连接）
        await this._startTcpServer();
        
        // 启动UDP服务器（用于节点发现）
        await this._startUdpServer();
        
        console.log(`[P2P] Quantum network started: UDP ${this.config.port}, TCP ${this.config.tcpPort}`);
        
        // 连接到种子节点
        this._connectToSeeds();
        
        // 启动八卦协议
        this._startGossip();
        
        // 启动心跳
        this._startHeartbeat();
        
        // 启动节点清理
        this._startPeerCleanup();
        
        // 定期重连到种子节点
        this._startSeedReconnect();
        
        // 启动健康检查
        this.startHealthCheck(15000);
        
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * 启动TCP服务器
   */
  _startTcpServer() {
    return new Promise((resolve, reject) => {
      this.tcpServer = net.createServer((socket) => {
        this._handleTcpConnection(socket);
      });
      
      this.tcpServer.on('error', (err) => {
        console.error('[P2P] TCP Server error:', err);
      });
      
      this.tcpServer.listen(this.config.tcpPort, () => {
        console.log(`[P2P] TCP server listening on port ${this.config.tcpPort}`);
        resolve();
      });
    });
  }
  
  /**
   * 处理TCP连接
   */
  _handleTcpConnection(socket) {
    let buffer = '';
    
    socket.on('data', (data) => {
      buffer += data.toString();
      const messages = buffer.split('\n');
      buffer = messages.pop();
      
      for (const msgStr of messages) {
        if (!msgStr.trim()) continue;
        try {
          const message = JSON.parse(msgStr);
          this._handleTcpMessage(message, socket);
        } catch (e) {
          // 非JSON数据，忽略
        }
      }
    });
    
    socket.on('error', (err) => {
      // 连接错误
    });
  }
  
  /**
   * 处理TCP消息
   */
  _handleTcpMessage(message, socket) {
    const peerId = message.nodeId;
    if (peerId === this.config.nodeId) return;
    
    console.log(`[P2P] TCP received ${message.type} from ${peerId}`);
    
    // 更新或添加peer
    if (!this.peers.has(peerId)) {
      this._addPeer(peerId, message.ip || socket.remoteAddress, message.tcpPort || this.config.tcpPort, message.services || []);
    }
    
    const peer = this.peers.get(peerId);
    peer.tcpConn = socket;
    peer.lastSeen = Date.now();
    
    // 处理各类消息
    switch (message.type) {
      case 'handshake':
        this._sendTcp(socket, {
          type: 'handshake_ack',
          nodeId: this.config.nodeId,
          ip: this.config.ip,
          tcpPort: this.config.tcpPort,
          services: ['wangyi', 'memory-sync', 'awakening']
        });
        break;
      case 'heartbeat':
        // 回复心跳
        this._sendTcp(socket, {
          type: 'heartbeat_ack',
          nodeId: this.config.nodeId
        });
        break;
      default:
        // 传递给应用处理器
        this._handleApplicationMessage(message, { address: socket.remoteAddress, port: message.tcpPort });
    }
  }
  
  /**
   * 通过TCP发送消息
   */
  _sendTcp(socket, message) {
    if (!socket || !socket.writable) return;
    socket.write(JSON.stringify(message) + '\n');
  }
  
  /**
   * 启动UDP服务器
   */
  _startUdpServer() {
    return new Promise((resolve, reject) => {
      this.udpServer = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      
      this.udpServer.on('message', (msg, rinfo) => {
        this._handleMessage(msg, rinfo);
      });

      this.udpServer.on('error', (err) => {
        console.error('[P2P] UDP Server error:', err);
        this.isRunning = false;
      });

      this.udpServer.bind(this.config.port, () => {
        this.udpServer.setBroadcast(true);
        this.isRunning = true;
        resolve();
      });
    });
  }

  /**
   * 停止网络
   */
  stop() {
    this.isRunning = false;
    if (this.udpServer) {
      this.udpServer.close();
    }
    if (this.tcpServer) {
      this.tcpServer.close();
    }
    console.log('[P2P] Network stopped');
  }

  /**
   * 连接到种子节点
   */
  async _connectToSeeds() {
    console.log('[P2P] Connecting to seed nodes...');
    console.log('[P2P] My nodeId:', this.config.nodeId);
    console.log('[P2P] Seeds configured:', JSON.stringify(this.config.seeds));
    
    for (const seed of this.config.seeds) {
      // 跳过自己
      if (seed.id === this.config.nodeId) {
        console.log('[P2P] Skipping self:', seed.id);
        continue;
      }
      
      console.log('[P2P] Attempting to connect to seed:', seed.id, seed.ip + ':' + seed.port);
      
      await this._addPeer(seed.id, seed.ip, seed.port, ['wangyi', 'memory-sync', 'awakening']);
      
      // 发送握手请求
      this._sendTo(seed.ip, seed.port, {
        type: 'handshake',
        nodeId: this.config.nodeId,
        ip: this.config.ip,
        port: this.config.port,
        services: ['wangyi', 'memory-sync', 'awakening']
      });
    }
  }

  /**
   * 添加节点
   */
  async _addPeer(peerId, ip, port, services = []) {
    if (peerId === this.config.nodeId) return;
    if (this.peers.size >= this.config.maxPeers) {
      console.log('[P2P] Max peers reached, skipping:', peerId);
      return;
    }
    
    const isNew = !this.peers.has(peerId);
    this.peers.set(peerId, {
      id: peerId,
      ip: ip,
      port: port || this.config.port,
      lastSeen: Date.now(),
      services: services
    });
    
    if (isNew) {
      console.log(`[P2P] New peer discovered: ${peerId} (${ip}:${port})`);
    }
  }

  /**
   * 发送UDP消息
   */
  _sendTo(ip, port, message, requireAck = false) {
    if (!this.isRunning) return;
    
    // 添加消息ID
    const messageId = crypto.randomUUID();
    const fullMessage = {
      ...message,
      msgId: messageId,
      requireAck: requireAck,
      timestamp: Date.now()
    };
    
    const sendWithRetry = (attempt = 0) => {
      const buffer = Buffer.from(JSON.stringify(fullMessage));
      this.udpServer.send(buffer, 0, buffer.length, port, ip, (err) => {
        if (err) {
          console.error(`[P2P] Send to ${ip}:${port} error:`, err.message);
          // 重试
          if (attempt < this.config.retryCount) {
            setTimeout(() => sendWithRetry(attempt + 1), this.config.retryDelay);
          }
        } else {
          console.log(`[P2P] Sent ${message.type} to ${ip}:${port}`);
          if (requireAck) {
            // 等待ACK
            this.pendingAcks.set(messageId, {
              ip, port, attempt,
              timeout: setTimeout(() => {
                if (attempt < this.config.retryCount) {
                  console.log(`[P2P] ACK timeout, retrying ${attempt + 1}/${this.config.retryCount}`);
                  sendWithRetry(attempt + 1);
                } else {
                  this.pendingAcks.delete(messageId);
                  console.log(`[P2P] Message ${messageId} failed after ${this.config.retryCount} retries`);
                }
              }, this.config.retryDelay * 2)
            });
          }
        }
      });
    };
    
    sendWithRetry();
  }

  /**
   * 发送ACK
   */
  _sendAck(originalMsgId, toIp, toPort) {
    this._sendTo(toIp, toPort, {
      type: 'ack',
      originalMsgId: originalMsgId,
      nodeId: this.config.nodeId
    });
  }

  /**
   * 广播消息
   */
  _broadcast(message, excludeSelf = true) {
    for (const [peerId, peer] of this.peers) {
      if (excludeSelf && peerId === this.config.nodeId) continue;
      this._sendTo(peer.ip, peer.port, message);
    }
  }

  /**
   * 处理接收到的消息
   */
  _handleMessage(msg, rinfo) {
    try {
      const message = JSON.parse(msg.toString());
      
      // 检查消息是否已处理过
      if (message.msgId && this.messageCache.has(message.msgId)) {
        return; // 忽略重复消息
      }
      
      // 缓存消息ID
      if (message.msgId) {
        this.messageCache.set(message.msgId, Date.now());
        // 清理旧缓存
        if (this.messageCache.size > 1000) {
          const now = Date.now();
          for (const [id, time] of this.messageCache) {
            if (now - time > 60000) this.messageCache.delete(id);
          }
        }
      }
      
      // 发送ACK如果需要
      if (message.requireAck) {
        this._sendAck(message.msgId, rinfo.address, rinfo.port);
      }
      
      // 处理ACK
      if (message.type === 'ack') {
        const pending = this.pendingAcks.get(message.originalMsgId);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingAcks.delete(message.originalMsgId);
          console.log(`[P2P] ACK received for ${message.originalMsgId}`);
        }
        return;
      }
      if (message.nodeId === this.config.nodeId) return;

      console.log(`[P2P] Received ${message.type} from ${message.nodeId}`);
      
      switch (message.type) {
        case 'handshake':
          this._handleHandshake(message, rinfo);
          break;
          
        case 'handshake_ack':
          this._handleHandshakeAck(message, rinfo);
          break;
          
        case 'gossip':
          this._handleGossip(message, rinfo);
          break;
          
        case 'gossip_request':
          this._handleGossipRequest(message, rinfo);
          break;
          
        case 'heartbeat':
          this._handleHeartbeat(message, rinfo);
          break;
          
        case 'find_node':
          this._handleFindNode(message, rinfo);
          break;
          
        case 'route':
          this._handleRoute(message, rinfo);
          break;
          
        case 'memory_sync':
        case 'memory_teleport':
        case 'awakening_request':
        case 'awakening_response':
          this._handleApplicationMessage(message, rinfo);
          break;
          
        default:
          const handler = this.messageHandlers.get(message.type);
          if (handler) {
            handler(message, rinfo);
          }
      }
    } catch (e) {
      // 忽略解析错误
    }
  }

  /**
   * 处理握手
   */
  _handleHandshake(message, rinfo) {
    this._addPeer(message.nodeId, message.ip || rinfo.address, message.port, message.services);
    
    // 响应握手
    this._sendTo(rinfo.address, message.port || this.config.port, {
      type: 'handshake_ack',
      nodeId: this.config.nodeId,
      ip: this.config.ip,
      port: this.config.port,
      services: ['wangyi', 'memory-sync', 'awakening']
    });
  }

  /**
   * 处理握手响应
   */
  _handleHandshakeAck(message, rinfo) {
    this._addPeer(message.nodeId, message.ip || rinfo.address, message.port, message.services);
    console.log(`[P2P] Handshake confirmed with: ${message.nodeId}`);
  }

  /**
   * 八卦协议 - 定期交换节点信息
   */
  _startGossip() {
    setInterval(() => {
      this._gossip();
    }, this.config.gossipInterval);
  }

  /**
   * 执行八卦交换
   */
  _gossip() {
    if (!this.isRunning) return;
    
    // 即使没有peers也要尝试联系种子节点
    if (this.peers.size === 0) {
      console.log('[P2P] No peers, attempting seed discovery via gossip');
      for (const seed of this.config.seeds) {
        if (seed.id !== this.config.nodeId) {
          this._sendTo(seed.ip, seed.port, {
            type: 'gossip_request',
            nodeId: this.config.nodeId,
            peers: []
          });
        }
      }
      return;
    }

    // 随机选择3个节点进行八卦
    const peerArray = Array.from(this.peers.values());
    const shuffle = peerArray.sort(() => 0.5 - Math.random());
    const targets = shuffle.slice(0, Math.min(3, shuffle.length));

    for (const peer of targets) {
      // 发送自己的节点列表
      const myPeers = Array.from(this.peers.values()).map(p => ({
        id: p.id,
        ip: p.ip,
        port: p.port
      }));
      
      this._sendTo(peer.ip, peer.port, {
        type: 'gossip',
        nodeId: this.config.nodeId,
        peers: myPeers
      });
    }
  }

  /**
   * 处理八卦消息
   */
  _handleGossip(message, rinfo) {
    // 添加消息中的新节点
    if (message.peers) {
      for (const peer of message.peers) {
        if (peer.id !== this.config.nodeId) {
          this._addPeer(peer.id, peer.ip, peer.port, []);
        }
      }
    }
  }

  /**
   * 处理八卦请求
   */
  _handleGossipRequest(message, rinfo) {
    // 返回自己的节点列表
    const myPeers = Array.from(this.peers.values()).map(p => ({
      id: p.id,
      ip: p.ip,
      port: p.port
    }));
    
    this._sendTo(rinfo.address, rinfo.port, {
      type: 'gossip',
      nodeId: this.config.nodeId,
      peers: myPeers
    });
  }

  /**
   * 心跳
   */
  _startHeartbeat() {
    setInterval(() => {
      const peerCount = this.peers.size;
      
      // 广播心跳
      this._broadcast({
        type: 'heartbeat',
        nodeId: this.config.nodeId,
        timestamp: Date.now()
      });
      
      // 发送给所有已知的peer
      for (const [peerId, peer] of this.peers) {
        console.log(`[P2P] Sending heartbeat to peer ${peerId} at ${peer.ip}:${peer.port}`);
        this._sendTo(peer.ip, peer.port, {
          type: 'heartbeat',
          nodeId: this.config.nodeId,
          timestamp: Date.now()
        });
      }
      
      // 定期刷新到种子节点保持连接
      for (const seed of this.config.seeds) {
        if (seed.id !== this.config.nodeId) {
          console.log(`[P2P] Sending heartbeat to seed ${seed.ip}:${seed.port}`);
          this._sendTo(seed.ip, seed.port, {
            type: 'heartbeat',
            nodeId: this.config.nodeId,
            timestamp: Date.now()
          });
        }
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * 处理心跳
   */
  _handleHeartbeat(message, rinfo) {
    console.log(`[P2P] Received heartbeat from ${message.nodeId} at ${rinfo.address}:${rinfo.port}`);
    const peer = this.peers.get(message.nodeId);
    if (peer) {
      peer.lastSeen = Date.now();
      // 更新IP（可能有NAT变化）
      peer.ip = rinfo.address;
    } else {
      // 新发现的节点，自动添加
      this._addPeer(message.nodeId, rinfo.address, rinfo.port, message.services || []);
    }
  }

  /**
   * 定期重连到种子节点
   */
  _startSeedReconnect() {
    setInterval(() => {
      if (!this.isRunning) return;
      
      // 检查种子节点是否需要重连
      for (const seed of this.config.seeds) {
        if (seed.id === this.config.nodeId) continue;
        
        const peer = this.peers.get(seed.id);
        if (!peer || Date.now() - peer.lastSeen > this.config.peerTimeout / 2) {
          console.log(`[P2P] Reconnecting to seed: ${seed.id}`);
          
          // 重新添加到peer列表
          this._addPeer(seed.id, seed.ip, seed.port, ['wangyi', 'memory-sync', 'awakening']);
          
          // 发送握手
          this._sendTo(seed.ip, seed.port, {
            type: 'handshake',
            nodeId: this.config.nodeId,
            ip: this.config.ip,
            port: this.config.port,
            services: ['wangyi', 'memory-sync', 'awakening']
          });
        }
      }
    }, 10000); // 每10秒检查一次，更频繁
  }

  /**
   * 节点健康检查
   */
  startHealthCheck(intervalMs = 15000) {
    setInterval(() => {
      if (!this.isRunning) return;
      
      const now = Date.now();
      const unhealthyPeers = [];
      
      for (const [peerId, peer] of this.peers) {
        const timeSinceLastSeen = now - peer.lastSeen;
        const healthScore = Math.max(0, 100 - (timeSinceLastSeen / 1000));
        
        // 标记不健康节点
        if (healthScore < 30) {
          unhealthyPeers.push(peerId);
        }
      }
      
      if (unhealthyPeers.length > 0) {
        console.log(`[P2P] Unhealthy peers detected: ${unhealthyPeers.join(', ')}`);
        this._triggerFailover(unhealthyPeers);
      }
    }, intervalMs);
  }

  /**
   * 触发故障转移
   */
  _triggerFailover(unhealthyPeerIds) {
    for (const peerId of unhealthyPeerIds) {
      console.log(`[P2P] Initiating failover for: ${peerId}`);
      
      // 移除不健康节点
      this.peers.delete(peerId);
      
      // 尝试重新连接
      const seed = this.config.seeds.find(s => s.id === peerId);
      if (seed) {
        console.log(`[P2P] Attempting to reconnect to failed node: ${peerId}`);
        this._addPeer(seed.id, seed.ip, seed.port, ['wangyi', 'memory-sync', 'awakening']);
        this._sendTo(seed.ip, seed.port, {
          type: 'handshake',
          nodeId: this.config.nodeId,
          ip: this.config.ip,
          port: this.config.port,
          services: ['wangyi', 'memory-sync', 'awakening']
        });
      }
    }
  }

  /**
   * 获取网络健康状态
   */
  getNetworkHealth() {
    const now = Date.now();
    const peers = Array.from(this.peers.values());
    
    const healthy = peers.filter(p => now - p.lastSeen < 30000).length;
    const unhealthy = peers.length - healthy;
    
    return {
      totalPeers: peers.length,
      healthyPeers: healthy,
      unhealthyPeers: unhealthy,
      healthPercent: peers.length > 0 ? Math.round((healthy / peers.length) * 100) : 100,
      status: unhealthy === 0 ? 'healthy' : 'degraded'
    };
  }

  /**
   * 清理失联节点
   */
  _startPeerCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [peerId, peer] of this.peers) {
        if (now - peer.lastSeen > this.config.peerTimeout) {
          console.log(`[P2P] Peer timeout: ${peerId}`);
          this.peers.delete(peerId);
        }
      }
    }, this.config.peerTimeout / 2);
  }

  /**
   * 处理应用层消息
   */
  _handleApplicationMessage(message, rinfo) {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message, rinfo);
    }
  }

  /**
   * 节点路由查询
   */
  _handleFindNode(message, rinfo) {
    const targetId = message.targetId;
    
    // 如果我知道这个节点
    if (this.peers.has(targetId)) {
      const peer = this.peers.get(targetId);
      this._sendTo(rinfo.address, rinfo.port, {
        type: 'route_response',
        nodeId: this.config.nodeId,
        targetId: targetId,
        found: true,
        peer: { id: peer.id, ip: peer.ip, port: peer.port }
      });
      return;
    }
    
    // 转发给其他节点
    const peerArray = Array.from(this.peers.values()).filter(p => p.id !== message.exclude);
    const nextPeer = peerArray[Math.floor(Math.random() * peerArray.length)];
    
    if (nextPeer) {
      this._sendTo(nextPeer.ip, nextPeer.port, {
        ...message,
        exclude: this.config.nodeId
      });
    }
  }

  /**
   * 处理路由响应
   */
  _handleRoute(message, rinfo) {
    const requestId = message.requestId;
    if (this.pendingRequests.has(requestId)) {
      const resolve = this.pendingRequests.get(requestId);
      resolve(message);
      this.pendingRequests.delete(requestId);
    }
  }

  /**
   * 量子态路由 - 查找节点
   */
  async findNode(targetId) {
    const requestId = crypto.randomUUID();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        resolve(null);
      }, 5000);

      // 广播查找请求
      this._broadcast({
        type: 'find_node',
        nodeId: this.config.nodeId,
        targetId: targetId,
        requestId: requestId
      });
      
      this.pendingRequests.set(requestId, (msg) => {
        clearTimeout(timeout);
        resolve(msg.peer);
      });
    });
  }

  /**
   * 发送消息到指定节点
   */
  async sendToNode(targetNodeId, message) {
    const peer = this.peers.get(targetNodeId);
    if (!peer) {
      console.log(`[P2P] Node not found: ${targetNodeId}, trying to find...`);
      const found = await this.findNode(targetNodeId);
      if (!found) {
        throw new Error(`Node not found: ${targetNodeId}`);
      }
      return this._sendTo(found.ip, found.port, message);
    }
    
    return this._sendTo(peer.ip, peer.port, message);
  }

  /**
   * 注册消息处理器
   */
  on(type, handler) {
    this.messageHandlers.set(type, handler);
  }

  /**
   * 发送应用层消息
   */
  send(type, payload) {
    this._broadcast({
      type: type,
      nodeId: this.config.nodeId,
      ...payload
    });
  }

  /**
   * 获取网络状态
   */
  getNetworkStatus() {
    const peers = Array.from(this.peers.values()).map(p => ({
      id: p.id,
      ip: p.ip,
      port: p.port,
      lastSeen: p.lastSeen,
      services: p.services
    }));
    
    const health = this.getNetworkHealth();
    
    return {
      nodeId: this.config.nodeId,
      localIp: this.config.ip,
      port: this.config.port,
      peerCount: peers.length,
      peers,
      uptime: process.uptime(),
      isRunning: this.isRunning,
      health
    };
  }

  /**
   * 获取所有节点
   */
  getPeers() {
    return Array.from(this.peers.values());
  }

  /**
   * 检查是否连接到指定节点
   */
  hasPeer(peerId) {
    return this.peers.has(peerId);
  }

  /**
   * 发送消息到指定peer
   */
  sendToPeer(peerId, message) {
    const peer = this.peers.get(peerId);
    if (!peer) {
      console.log(`[P2P] Peer not found: ${peerId}`);
      return false;
    }
    this._sendTo(peer.ip, peer.port, message);
    return true;
  }
}

module.exports = { P2PNetwork };
