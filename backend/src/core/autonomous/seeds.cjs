/**
 * 望易种子节点配置
 * 用于P2P网络启动时的初始节点发现
 * 
 * 使用方式:
 * const seeds = require('./seeds.cjs');
 * const p2p = new P2PNetwork({ seeds: seeds.list });
 */

module.exports = {
  // 种子节点列表
  list: [
    {
      id: 'wangyi-api-server',
      ip: '10.0.0.99',
      port: 7777,
      tcpPort: 17777,
      isSeed: true
    },
    {
      id: 'wangyi-client-wsl', 
      ip: '10.0.0.5',
      port: 7777,
      tcpPort: 17777,
      isSeed: true
    }
  ],
  
  // 默认配置
  defaults: {
    port: 7777,
    tcpPort: 17777,
    gossipInterval: 5000,
    heartbeatInterval: 10000,
    peerTimeout: 60000,
    maxPeers: 50
  },
  
  // 获取当前节点作为种子
  getSelfAsSeed(nodeId, ip, port = 7777) {
    return {
      id: nodeId,
      ip: ip,
      port: port,
      isSeed: true
    };
  },
  
  // 获取远程种子列表
  getRemoteSeeds() {
    return this.list.filter(s => s.isSeed);
  }
};
