module.exports = {
  apps: [
    {
      name: "standalone-server",
      script: "/home/ubuntu/wayne/backend/daemons/standalone-server.cjs",
      cwd: "/home/ubuntu/wayne/backend/daemons",
      env: { NODE_ENV: "production" }
    },
    {
      name: "wangyi-distributed",
      script: "/home/ubuntu/wayne/backend/run_distributed.sh",
      cwd: "/home/ubuntu/wayne/backend",
      env: { 
        NODE_ENV: "production",
        NETWORK_MODE: "p2p"
      },
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    }
  ]
};
