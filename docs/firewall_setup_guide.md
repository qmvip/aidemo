# 望易AI区块链 - 防火墙配置指南

## 端口需求

| 端口 | 协议 | 用途 | 重要性 |
|------|------|------|--------|
| 7777 | UDP | P2P节点发现与通信 | 必须 |
| 17777 | TCP | P2P长连接 | 必须 |
| 9999 | TCP | 主API服务 | 必须 |
| 9988 | TCP | 分布式API服务 | 必须 |
| 22 | TCP | SSH远程管理 | 必须 |

## Ubuntu/Debian 配置

### 方法1: 使用UFW (推荐)

```bash
# 安装UFW
sudo apt update
sudo apt install ufw

# 开放必要端口
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 7777/udp     # P2P UDP
sudo ufw allow 17777/tcp    # P2P TCP
sudo ufw allow 9999/tcp     # API Main
sudo ufw allow 9988/tcp     # API Distributed

# 启用防火墙
sudo ufw enable

# 查看状态
sudo ufw status
```

### 方法2: 使用iptables

```bash
# P2P端口
sudo iptables -A INPUT -p udp --dport 7777 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 17777 -j ACCEPT

# API端口
sudo iptables -A INPUT -p tcp --dport 9999 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 9988 -j ACCEPT

# SSH
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# 保存规则
sudo iptables-save > /etc/iptables/rules.v4
```

## 云服务器安全组 (阿里云/腾讯云/AWS)

### 阿里云
1. 登录阿里云控制台
2. 进入ECS实例 → 安全组 → 配置规则
3. 添加规则:

| 协议 | 端口 | 源IP | 用途 |
|------|------|------|------|
| UDP | 7777 | 0.0.0.0/0 | P2P |
| TCP | 17777 | 0.0.0.0/0 | P2P |
| TCP | 9999 | 0.0.0.0/0 | API |
| TCP | 9988 | 0.0.0.0/0 | API |

### 腾讯云
类似阿里云，进入CVM → 安全组 → 添加规则

### AWS EC2
1. 进入EC2 → 安全组 → 编辑入站规则
2. 添加规则:

| 类型 | 协议 | 端口 | 来源 |
|------|------|------|------|
| 自定义UDP | UDP | 7777 | 0.0.0.0/0 |
| 自定义TCP | TCP | 17777 | 0.0.0.0/0 |
| 自定义TCP | TCP | 9999 | 0.0.0.0/0 |
| 自定义TCP | TCP | 9988 | 0.0.0.0/0 |

## 检查端口状态

```bash
# 检查端口是否开放
sudo netstat -tulpn | grep -E '7777|17777|9999|9988'

# 或者使用ss
sudo ss -tulpn | grep -E '7777|17777|9999|9988'

# 测试端口连通性 (从客户端)
nc -zv <服务器IP> 7777
nc -zv <服务器IP> 17777
nc -zv <服务器IP> 9999
nc -zv <服务器IP> 9988
```

## 常见问题

### Q: 端口已开放但无法连接?
1. 检查服务是否启动: `ps aux | grep node`
2. 检查防火墙: `sudo ufw status`
3. 检查云安全组是否配置
4. 检查端口是否被占用: `sudo lsof -i :7777`

### Q: 需要开放所有端口吗?
不建议，遵循最小权限原则，只开放必要端口。

### Q: 如何临时测试防火墙?
```bash
# 临时关闭防火墙 (测试用)
sudo ufw disable

# 测试后重新启用
sudo ufw enable
```
