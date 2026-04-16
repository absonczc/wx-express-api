# Windows Server 初始化脚本 - 简化版
# 以管理员身份运行 PowerShell 后执行此脚本

param(
    [string]$ProjectDir = "C:\Users\Administrator\miniapp-express-api",
    [string]$DbName = "miniapp_db",
    [string]$DbUser = "postgresql",
    [string]$DbPassword = "123888"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================"
Write-Host "  Windows Server 初始化脚本"
Write-Host "========================================"
Write-Host ""

# 检查管理员权限
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "请以管理员身份运行此脚本！"
    exit 1
}

# 设置执行策略
Write-Host "[1/8] 设置 PowerShell 执行策略..."
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
Write-Host "      执行策略已设置" -ForegroundColor Green

# 安装 Chocolatey
Write-Host "[2/8] 检查并安装 Chocolatey..."
try {
    $choco = Get-Command choco -ErrorAction Stop
    Write-Host "      Chocolatey 已安装" -ForegroundColor Green
} catch {
    Write-Host "      正在安装 Chocolatey..."
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath"
    Write-Host "      Chocolatey 安装完成" -ForegroundColor Green
}

# 安装必要软件
Write-Host "[3/8] 安装必要软件..."

$packages = @("git", "nodejs-lts", "postgresql", "nginx")
foreach ($pkg in $packages) {
    Write-Host "      正在安装 $pkg..."
    choco install -y $pkg --no-progress
}

$machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
$userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
$env:Path = "$machinePath;$userPath"
Write-Host "      软件安装完成" -ForegroundColor Green

# 验证安装
Write-Host "      验证安装..."
node -v
npm -v
git --version

# 安装 PM2
Write-Host "[4/8] 安装 PM2..."
npm install -g pm2
Write-Host "      PM2 安装完成" -ForegroundColor Green

# 配置 PostgreSQL
Write-Host "[5/8] 配置 PostgreSQL..."

$pgService = Get-Service | Where-Object { $_.Name -like "postgresql*" } | Select-Object -First 1
if ($pgService) {
    Write-Host "      启动 PostgreSQL 服务..."
    Start-Service $pgService.Name
    Set-Service $pgService.Name -StartupType Automatic
    Write-Host "      PostgreSQL 服务已启动" -ForegroundColor Green
} else {
    Write-Warning "      未找到 PostgreSQL 服务，请手动检查安装"
}

Start-Sleep -Seconds 3

$psqlPath = Get-ChildItem -Path "C:\Program Files\PostgreSQL" -Recurse -Filter "psql.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($psqlPath) {
    $psql = $psqlPath.FullName
    Write-Host "      找到 psql: $psql"
    Write-Host "      创建数据库和用户..."
    
    $env:PGPASSWORD = "postgres"
    
    & $psql -U postgres -c "CREATE DATABASE $DbName;" 2>$null
    Write-Host "      数据库 $DbName 已创建或已存在" -ForegroundColor Green
    
    & $psql -U postgres -c "CREATE USER $DbUser WITH PASSWORD '$DbPassword';" 2>$null
    Write-Host "      用户 $DbUser 已创建或已存在" -ForegroundColor Green
    
    & $psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DbName TO $DbUser;"
    Write-Host "      权限已授予" -ForegroundColor Green
} else {
    Write-Warning "      未找到 psql.exe，请手动配置 PostgreSQL"
}

# 创建项目目录
Write-Host "[6/8] 创建项目目录..."
New-Item -ItemType Directory -Force -Path $ProjectDir | Out-Null
Write-Host "      项目目录已创建: $ProjectDir" -ForegroundColor Green

# 配置防火墙
Write-Host "[7/8] 配置防火墙规则..."

$rules = @(
    @("Node.js App", 9080),
    @("HTTP", 80),
    @("HTTPS", 443),
    @("SSH", 22)
)

foreach ($rule in $rules) {
    $ruleName = $rule[0]
    $rulePort = $rule[1]
    $existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    if (-not $existingRule) {
        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $rulePort -Action Allow | Out-Null
        Write-Host "      防火墙规则 '$ruleName' (端口 $rulePort) 已创建" -ForegroundColor Green
    } else {
        Write-Host "      防火墙规则 '$ruleName' 已存在" -ForegroundColor Green
    }
}

# 启用 OpenSSH
Write-Host "[8/8] 启用 OpenSSH 服务..."
$sshCapability = Get-WindowsCapability -Online | Where-Object { $_.Name -like "OpenSSH.Server*" }
if ($sshCapability -and $sshCapability.State -ne "Installed") {
    Add-WindowsCapability -Online -Name $sshCapability.Name
    Write-Host "      OpenSSH 服务器已安装" -ForegroundColor Green
}

$sshService = Get-Service -Name sshd -ErrorAction SilentlyContinue
if ($sshService) {
    Start-Service sshd
    Set-Service -Name sshd -StartupType Automatic
    
    $sshRule = Get-NetFirewallRule -Name "OpenSSH-Server-In-TCP" -ErrorAction SilentlyContinue
    if (-not $sshRule) {
        New-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -DisplayName 'OpenSSH Server (sshd)' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22 | Out-Null
    }
    Write-Host "      OpenSSH 服务已启动" -ForegroundColor Green
} else {
    Write-Warning "      未找到 SSH 服务，请手动检查"
}

# 完成
Write-Host ""
Write-Host "========================================"
Write-Host "  初始化完成！"
Write-Host "========================================"
Write-Host ""
Write-Host "后续步骤:"
Write-Host "  1. 克隆项目到 $ProjectDir"
Write-Host "  2. 配置 .env 文件"
Write-Host "  3. 安装依赖并构建项目"
Write-Host "  4. 配置 Nginx"
Write-Host "  5. 配置 GitHub Secrets"
Write-Host ""
Write-Host "数据库连接字符串:"
Write-Host "  postgresql://$DbUser`:$DbPassword@localhost:5432/$DbName`?schema=public"
Write-Host ""
Write-Host "详细说明请参考 DEPLOY.md"
