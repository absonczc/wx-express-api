# 自动化部署指南（Windows Server）

本指南说明如何配置 GitHub Actions 自动部署项目到 **Windows Server** 云服务器。

## 部署架构

```
GitHub Repository
       │
       │ push to main/master
       ▼
GitHub Actions
       │
       │ SSH 连接
       ▼
Windows Server
       │
       ├── PM2 进程管理
       ├── Nginx 反向代理
       └── PostgreSQL 数据库
```

## 1. 服务器初始化

### 1.1 连接服务器

使用腾讯云 OrcaTerm 或远程桌面连接到您的 Windows Server：
- 访问：https://orcaterm.cloud.tencent.com/terminal?type=lighthouse&instanceId=lhins-cij8jf47&region=ap-guangzhou&from=lh_console_login_btn

### 1.2 运行初始化脚本

**以管理员身份运行 PowerShell**，然后执行：

```powershell
# 设置执行策略（首次运行需要）
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser

# 下载并运行初始化脚本
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/<your-username>/miniapp-express-api/main/scripts/setup-server.ps1" -OutFile "setup-server.ps1"
.\setup-server.ps1
```

### 1.3 手动初始化（如果脚本执行失败）

#### 安装 Chocolatey

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
```

#### 安装必要软件

```powershell
# 安装 Git、Node.js、PostgreSQL、Nginx
choco install -y git
choco install -y nodejs-lts
choco install -y postgresql
choco install -y nginx

# 刷新环境变量
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

# 验证安装
node -v
npm -v
git --version
```

#### 安装 PM2

```powershell
npm install -g pm2
```

#### 配置 PostgreSQL

```powershell
# 启动 PostgreSQL 服务
Start-Service postgresql-x64-15
Set-Service postgresql-x64-15 -StartupType Automatic

# 创建数据库（使用 psql）
$env:PGPASSWORD = "postgres"
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -c "CREATE DATABASE miniapp_db;"
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -c "CREATE USER admin WITH PASSWORD 'your_password';"
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE miniapp_db TO admin;"
```

#### 配置防火墙

```powershell
# 开放端口
New-NetFirewallRule -DisplayName "Node.js App" -Direction Inbound -Protocol TCP -LocalPort 9080 -Action Allow
New-NetFirewallRule -DisplayName "HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

## 2. 项目部署

### 2.1 克隆项目

```powershell
# 创建项目目录
New-Item -ItemType Directory -Force -Path "C:\apps\miniapp-express-api"
cd C:\apps\miniapp-express-api

# 克隆项目（替换为你的仓库地址）
git clone https://github.com/<your-username>/miniapp-express-api.git .
```

### 2.2 配置环境变量

```powershell
# 复制环境变量模板
copy .env.example .env

# 编辑 .env 文件（使用记事本或 VS Code）
notepad .env
```

配置示例：
```env
NODE_ENV=production
PORT=9080
DATABASE_URL="postgresql://admin:your_password@localhost:5432/miniapp_db?schema=public"
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
WECHAT_APPID="your-wechat-appid"
WECHAT_SECRET="your-wechat-secret"
CORS_ORIGIN=""
```

### 2.3 安装依赖并构建

```powershell
# 安装依赖
npm ci

# 生成 Prisma Client
npx prisma generate

# 执行数据库迁移
npx prisma migrate deploy

# 构建项目
npm run build
```

### 2.4 启动服务

```powershell
# 使用 PM2 启动
pm2 start dist\server.js --name miniapp-api

# 设置开机自启
pm2 startup
pm2 save

# 查看状态
pm2 status
pm2 logs miniapp-api
```

## 3. 配置 Nginx

### 3.1 复制配置文件

```powershell
# 复制 Nginx 配置
copy scripts\nginx-windows.conf C:\nginx\conf\sites\miniapp-api.conf

# 编辑配置（修改 server_name 和端口）
notepad C:\nginx\conf\sites\miniapp-api.conf
```

### 3.2 启用配置

编辑 `C:\nginx\conf\nginx.conf`，在 `http` 块中添加：

```nginx
include sites/*.conf;
```

### 3.3 启动 Nginx

```powershell
# 测试配置
cd C:\nginx
nginx -t

# 启动 Nginx
start nginx

# 或者重启
nginx -s reload
```

### 3.4 将 Nginx 设置为 Windows 服务（可选）

```powershell
# 使用 NSSM 将 Nginx 设置为服务
choco install -y nssm
nssm install Nginx C:\nginx\nginx.exe
nssm start Nginx
```

## 4. 配置 GitHub Secrets

在 GitHub 仓库的 Settings → Secrets and variables → Actions 中添加以下 secrets：

| Secret Name | 说明 | 示例 |
|------------|------|------|
| `SERVER_IP` | 服务器 IP 地址 | `119.29.94.128` |
| `SERVER_USERNAME` | 服务器用户名 | `Administrator` |
| `SERVER_PASSWORD` | 服务器密码 | `YourPassword123` |
| `SERVER_PORT` | SSH 端口（可选） | `22` 或 `3389` |

### 4.1 Windows Server 启用 SSH（如果未启用）

```powershell
# 安装 OpenSSH 服务器（Windows Server 2019/2022）
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0

# 启动 SSH 服务
Start-Service sshd
Set-Service -Name sshd -StartupType 'Automatic'

# 确认防火墙规则已配置
if (!(Get-NetFirewallRule -Name "OpenSSH-Server-In-TCP" -ErrorAction SilentlyContinue | Select-Object Name, Enabled)) {
    Write-Output "Firewall Rule 'OpenSSH-Server-In-TCP' does not exist, creating it..."
    New-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -DisplayName 'OpenSSH Server (sshd)' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22
} else {
    Write-Output "Firewall rule 'OpenSSH-Server-In-TCP' has been created and exists."
}
```

## 5. 自动化部署流程

配置完成后，每次推送到 `main` 或 `master` 分支时，GitHub Actions 会自动：

1. 检出代码
2. 安装依赖并构建
3. 通过 SSH 连接到 Windows Server
4. 拉取最新代码
5. 安装生产依赖
6. 生成 Prisma Client
7. 执行数据库迁移
8. 重新构建项目
9. 使用 PM2 重启应用

## 6. 手动触发部署

如果需要手动触发部署：

```
在 GitHub 仓库页面
Actions → Deploy to Windows Server → Run workflow
```

## 7. 监控和日志

### 7.1 查看应用日志

```powershell
# PM2 日志
pm2 logs miniapp-api

# Nginx 日志（在 PowerShell 中）
Get-Content C:\nginx\logs\miniapp-api-error.log -Tail 50 -Wait
Get-Content C:\nginx\logs\miniapp-api-access.log -Tail 50 -Wait
```

### 7.2 查看服务状态

```powershell
# PM2 状态
pm2 status

# Nginx 进程
Get-Process nginx -ErrorAction SilentlyContinue

# PostgreSQL 服务
Get-Service postgresql*
```

## 8. 更新项目

### 8.1 自动更新

推送代码到 GitHub，自动触发部署：

```bash
git add .
git commit -m "更新功能"
git push origin main
```

### 8.2 手动更新

```powershell
cd C:\apps\miniapp-express-api
git pull origin main
npm ci --production
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 reload miniapp-api
```

## 9. 故障排查

### 9.1 部署失败

1. 检查 GitHub Actions 日志
2. 验证 Secrets 配置是否正确
3. 检查服务器 SSH 服务是否运行：`Get-Service sshd`

### 9.2 应用无法启动

```powershell
# 检查端口占用
Get-NetTCPConnection -LocalPort 9080

# 检查环境变量
cat .env

# 查看详细错误
pm2 logs miniapp-api --lines 100
```

### 9.3 数据库连接失败

```powershell
# 检查 PostgreSQL 服务
Get-Service postgresql*

# 测试连接
$env:PGPASSWORD = "your_password"
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U admin -d miniapp_db -c "SELECT 1;"
```

### 9.4 PM2 无法启动

```powershell
# 检查 PM2 状态
pm2 status

# 删除并重新创建
pm2 delete miniapp-api
pm2 start dist\server.js --name miniapp-api
pm2 save
```

## 10. 安全建议

1. **修改默认密码**：数据库密码、JWT 密钥、Windows 管理员密码
2. **配置防火墙**：只开放必要的端口（80, 443, 22）
3. **定期更新**：系统和依赖包
4. **备份数据**：定期备份数据库
5. **使用 HTTPS**：生产环境必须配置 SSL 证书
6. **限制远程访问**：配置安全组，只允许特定 IP 访问 RDP 和 SSH

## 11. 常用命令速查

```powershell
# 进程管理
pm2 start dist\server.js --name miniapp-api    # 启动
pm2 stop miniapp-api                            # 停止
pm2 restart miniapp-api                         # 重启
pm2 reload miniapp-api                          # 平滑重启
pm2 delete miniapp-api                          # 删除
pm2 logs miniapp-api                            # 查看日志
pm2 monit                                       # 监控面板

# Nginx
cd C:\nginx
nginx -t                                        # 测试配置
start nginx                                     # 启动
nginx -s stop                                   # 停止
nginx -s reload                                 # 重载配置

# PostgreSQL
Start-Service postgresql-x64-15                 # 启动
Stop-Service postgresql-x64-15                  # 停止
Restart-Service postgresql-x64-15               # 重启
```

---

如有问题，请检查 GitHub Actions 日志或服务器事件查看器进行排查。
