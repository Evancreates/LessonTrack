# LessonTrack 部署到 lessontrack.haiyne.cn

目标地址：

```text
https://lessontrack.haiyne.cn/login
```

我检查到当前官网 `www.haiyne.cn` 的响应头是 `server: cloudflare`，DNS 解析到：

```text
haiyne-homepage.pages.dev
```

这说明你的主站大概率是“GitHub 存代码，Cloudflare Pages 自动部署”。所以 LessonTrack 最推荐也走同样方式：GitHub 仓库 + Cloudflare Pages + 腾讯云 DNS。

云解析 DNS 只负责解析域名，不负责存放网页文件。真正托管网页的是 Cloudflare Pages。

## 本项目已准备好的文件

生产构建命令：

```bash
npm run build
```

构建输出目录：

```text
dist
```

Cloudflare Pages 单页应用回退规则：

```text
public/_redirects
```

内容是：

```text
/* /index.html 200
```

这个文件会在构建时复制到 `dist/_redirects`，用于保证刷新 `/login`、`/courses` 等路径时不会 404。

## 方案 A：Cloudflare Pages 连接 GitHub 自动部署

这是推荐方案。以后你改代码并推送到 GitHub，Cloudflare Pages 会自动重新部署。

### 1. 在 GitHub 创建仓库

1. 打开 GitHub：`https://github.com`
2. 登录你的账号。
3. 右上角点击 `+`。
4. 点击 `New repository`。
5. Repository name 填：

```text
LessonTrack
```

6. Visibility 选择：
   `Private` 或 `Public` 都可以。建议先用 `Private`。
7. 不要勾选 `Add a README file`。
8. 不要勾选 `.gitignore`。
9. 不要选择 License。
10. 点击 `Create repository`。

### 2. 把本地项目推送到 GitHub

在本项目目录运行：

```bash
git init
git add .
git commit -m "Initial LessonTrack deployment"
git branch -M main
git remote add origin git@github.com:你的GitHub用户名/LessonTrack.git
git push -u origin main
```

如果你 GitHub 没配置 SSH，用 GitHub 页面给出的 HTTPS 地址替换 remote：

```bash
git remote add origin https://github.com/你的GitHub用户名/LessonTrack.git
git push -u origin main
```

注意：如果 GitHub 提示没有权限，需要先在本机登录 GitHub CLI 或配置 SSH key。

### 3. 在 Cloudflare Pages 创建项目

1. 打开 Cloudflare 控制台：`https://dash.cloudflare.com/`
2. 登录你的 Cloudflare 账号。
3. 左侧菜单点击 `Workers & Pages`。
4. 点击 `Pages`。
5. 点击 `Create a project`。
6. 选择 `Connect to Git`。
7. 选择 GitHub。
8. 如果是第一次连接，点击 `Authorize Cloudflare`。
9. 选择仓库：

```text
LessonTrack
```

10. 点击 `Begin setup`。

### 4. 设置构建参数

在 Cloudflare Pages 的构建配置页这样填：

```text
Project name: lessontrack
Production branch: main
Framework preset: Vite
Build command: npm run build
Build output directory: dist
Root directory: 留空
```

环境变量不用填。

点击：

```text
Save and Deploy
```

等待部署完成。Cloudflare 会生成一个临时域名，通常类似：

```text
lessontrack.pages.dev
```

或者：

```text
lessontrack-xxx.pages.dev
```

先打开 Cloudflare 给你的 `.pages.dev` 地址，确认能看到登录页。

### 5. 绑定自定义域名

1. 在 Cloudflare Pages 项目里进入 `Custom domains`。
2. 点击 `Set up a custom domain`。
3. 输入：

```text
lessontrack.haiyne.cn
```

4. 点击 `Continue`。
5. Cloudflare 会提示你添加一条 CNAME 记录。
6. 复制 Cloudflare 给出的目标值。

目标值通常是：

```text
lessontrack.pages.dev
```

以 Cloudflare 控制台实际显示为准。

### 6. 在腾讯云 DNS 添加解析

因为你的域名在腾讯云，DNS 记录要在腾讯云加。

1. 打开腾讯云控制台：`https://console.cloud.tencent.com/`
2. 顶部搜索框输入：

```text
云解析 DNS
```

3. 进入 `云解析 DNS` 或 `DNSPod`。
4. 在域名列表找到：

```text
haiyne.cn
```

5. 点击右侧 `解析`。
6. 点击 `添加记录`。
7. 按下面填写：

```text
主机记录：lessontrack
记录类型：CNAME
线路类型：默认
记录值：Cloudflare Pages 给你的 pages.dev 地址
TTL：600 或默认
```

8. 点击 `保存`。

如果提示记录冲突，说明已经有 `lessontrack` 的 A、AAAA、CNAME 或 URL 转发记录。这个主机记录保留一条 CNAME 即可。

### 7. 等待 Cloudflare 验证域名

1. 回到 Cloudflare Pages 的 `Custom domains` 页面。
2. 等待 `lessontrack.haiyne.cn` 状态变成 `Active`。
3. Cloudflare 会自动签发 HTTPS 证书。
4. 这个过程通常几分钟，慢的时候可能更久。

### 8. 访问后台

打开：

```text
https://lessontrack.haiyne.cn/login
```

默认管理员账号：

```text
账号：admin
密码：123456
```

登录后第一件事：左下角 `修改密码`，改掉默认密码。

## 方案 B：Cloudflare Pages 手动上传

如果你暂时不想推 GitHub，也可以手动上传构建包。但后续每次改代码都要手动重新上传。

### 1. 本地构建

```bash
npm run build
```

### 2. 打包 dist

项目里已经生成过：

```text
LessonTrack-admin-dist.zip
```

如果要重新生成：

```bash
cd dist
zip -qr ../LessonTrack-admin-dist.zip .
```

### 3. Cloudflare Pages 手动上传

1. 打开 Cloudflare 控制台：`https://dash.cloudflare.com/`
2. 左侧点击 `Workers & Pages`。
3. 点击 `Pages`。
4. 点击 `Create a project`。
5. 选择 `Upload assets`。
6. Project name 填：

```text
lessontrack
```

7. 上传 `LessonTrack-admin-dist.zip`。
8. 部署完成后，在 `Custom domains` 里绑定 `lessontrack.haiyne.cn`。
9. 回到腾讯云 DNS 添加 CNAME，步骤同上。

## 官网入口

在现有官网导航或产品入口里添加：

```html
<a href="https://lessontrack.haiyne.cn/login">登录后台</a>
```

你的官网目前是静态页面，入口大概率在 GitHub 仓库的 `index.html` 或导航组件里。找到主导航 `<div class="nav-links">`，加一行即可：

```html
<a href="https://lessontrack.haiyne.cn/login">登录后台</a>
```

## 验证清单

1. `https://lessontrack.haiyne.cn/login` 能打开登录页。
2. 刷新 `https://lessontrack.haiyne.cn/login` 不会 404。
3. 登录 `admin / 123456` 后能进入数据中心。
4. 退出登录后回到登录页。
5. 修改密码后，新密码能登录。
6. 官网有进入后台的链接。

## 安全提醒

当前系统是纯前端本地登录和本地数据，适合演示或内部原型。正式存放真实学生信息时，需要后端鉴权、数据库和服务端权限校验。Cloudflare Pages 只能托管静态前端，不能单独解决真实数据安全。
