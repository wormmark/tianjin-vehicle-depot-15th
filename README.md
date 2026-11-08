# 《十五载砺剑·一路向前》

天津车辆段建段十五周年主题数字纪念册。作品采用手机竖屏优先的电影化叙事，包含九幕内容、时间轴、发展板块、一线岗位热点、师徒传承、担当专题、寄语与完整分享交互。

项目是纯原生 HTML / CSS / JavaScript 静态站点，不需要数据库，不需要登录即可浏览。正式发布后，公开网址固定不变；维护者在私人控制台上传新图后，托管平台自动重新发布，同一网址显示新内容。

## 先看这里：如何得到公网网址

本项目已经配置好 **GitHub Pages 自动发布**。首次上线需要 GitHub 账号完成一次授权和建仓；之后换图、改文案都在网页里完成，不需要再生成新网址。

公开页与控制台的关系：

```text
https://你的用户名.github.io/仓库名/            公开纪念册（只读，任何人可访问）
https://你的用户名.github.io/仓库名/studio.html  维护控制台（需要自己的 GitHub Token 才能写入）
```

访客只能阅读，无法修改图片或文字。控制台的写入能力来自浏览器里保存的 GitHub Token，Token 不会写入网页、仓库或公开链接。

### 第一次上线（约 5 分钟）

1. 登录 GitHub，新建一个 **Public** 仓库，例如 `tj15`。默认分支使用 `main`。
2. 把本项目除 `dist/`、`_archive/`、`node_modules/` 外的文件上传到仓库。网页端可以直接打开仓库首页，选择 **Add file → Upload files**，把项目文件夹里的文件拖进去；也可以使用 Git 推送。
3. 进入仓库 **Settings → Pages → Build and deployment**，把 Source 设为 **GitHub Actions**。
4. 进入仓库 **Actions**，等待 `Deploy memorial site to GitHub Pages` 完成；首次也可以手动运行该工作流。
5. 公开网址按下面规则生成：

```text
仓库名不是“用户名.github.io”：
https://用户名.github.io/仓库名/

仓库名正好是“用户名.github.io”：
https://用户名.github.io/
```

6. 打开 `公开网址 + studio.html`，例如 `https://用户名.github.io/tj15/studio.html`。
7. 填写仓库所有者、仓库名、分支 `main` 和公开网址，然后创建并粘贴 GitHub Token（方法见下一节）。
8. 点击“连接并验证”。看到“已连接”后，就可以逐张上传照片。

> 当前制作环境无法访问外网，也没有你的 GitHub 账号授权，因此无法代替你创建真实公网链接。项目本身已经完成发布配置；按上述步骤建仓后即可获得固定网址。

### GitHub Token 怎么创建

1. 打开 GitHub 头像菜单：**Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**。
2. 只选择本作品对应的仓库。
3. Repository permissions 中把 **Contents** 设为 **Read and write**；其他权限不需要开启。
4. 生成后复制 `github_pat_...`，粘贴到 `studio.html` 的 Token 输入框。
5. 建议不要在公用电脑勾选“记住 Token”。使用完后可以随时在 GitHub 撤销该 Token。

### 换图后如何更新

1. 打开公开站点里的 `studio.html`。
2. 找到对应章节的图片卡片，点击“上传并发布”。
3. 浏览器会自动把图片转成 JPG、压缩到适合网页的大小，并提交到固定图片槽位。
4. GitHub Actions 自动重新构建。通常 30–90 秒后，刷新原公开网址即可看到新图；网址不会改变。
5. 微信或浏览器若仍显示旧图，可强制刷新或等待缓存更新。构建时会自动附加图片版本号。

23 个图片槽位均为固定文件名：

```text
assets/photos/01-hero-main.jpg
assets/photos/02-timeline-origin.jpg
assets/photos/03-timeline-foundation.jpg
assets/photos/04-timeline-growth.jpg
assets/photos/05-timeline-safety.jpg
assets/photos/06-timeline-today.jpg
assets/photos/07-development-safety.jpg
assets/photos/08-development-transport.jpg
assets/photos/09-development-repair.jpg
assets/photos/10-development-innovation.jpg
assets/photos/11-development-team.jpg
assets/photos/12-frontline-inspection.jpg
assets/photos/13-hotspot-hammer.jpg
assets/photos/14-hotspot-wheel.jpg
assets/photos/15-hotspot-worker.jpg
assets/photos/16-legacy-compare.jpg
assets/photos/17-duty-summer.jpg
assets/photos/18-duty-flood.jpg
assets/photos/19-duty-maintenance.jpg
assets/photos/20-future-dawn.jpg
assets/photos/21-tribute-group.jpg
assets/photos/22-message-background.jpg
assets/photos/23-share-cover.jpg
```

每张图对应的章节、用途、建议尺寸和构图位置，在控制台上均有中文标注；也可以直接查看 `assets/photos/image-slots.js` 与 `assets/photos/替换说明.txt`。

### 修改文字内容

时间轴、发展板块、岗位热点、担当专题等结构化文案集中在 `data.js`。可在 GitHub 网页中打开该文件，点击铅笔图标编辑并提交；提交后自动重新发布，公开网址保持不变。

固定章节标题、寄语区与落款等页面文案位于 `index.html`，同样可在 GitHub 网页中修改。正式发布前必须逐条核对真实性和文字。

## 本地预览与制作

```bash
cd /Users/zhanbo/tianjin-vehicle-depot-15th
npm start
```

浏览器打开 `http://127.0.0.1:4173`。本机图片替换入口为：

```text
http://127.0.0.1:4173/素材替换台.html
```

macOS 也可以双击 `打开素材替换台.command`。本地替换台支持选图、拖拽、自动转 JPEG、原图备份和“还原上一张”，写入接口只允许本机访问，不能也不应部署到公网。

本地替换台适合首次集中整理素材；上线后的日常换图使用公开站点的 `studio.html`。

## 构建与发布产物

```bash
npm run build
```

构建会生成只读静态站点 `dist/`，并完成：

- 复制九幕页面、样式、交互、23 张固定槽位图片、字体与纹理。
- 为照片引用自动附加版本号，避免换图后微信或浏览器缓存旧图。
- 写入 GitHub Pages 需要的 `.nojekyll` 与 `404.html`。
- 有 `PUBLIC_URL` 时写入 canonical、`og:url` 和绝对分享封面地址。
- 不复制本地写入服务与本地替换台，公网产物没有图片写入后端。

GitHub Actions 配置位于 `.github/workflows/deploy.yml`。推送到 `main` 或手动运行工作流，都会自动构建并部署 `dist/`。

## 发布前必须核对

当前项目没有天津车辆段真实历史资料、统计数据、职工姓名、人物事迹、荣誉和授权现场照片，因此页面保留了【请补充…】、“待核验”和“场景示意”等明确提示。不得把这些占位内容当作真实史实发布。

正式传播前请完成：

- 替换全部【请补充…】和“待核验”内容，核对建段年份、事件、数字与口径。
- 替换为天津车辆段授权实拍，确认肖像权、著作权与图片使用范围。
- 删除不再适用的“场景示意”提示及第三方素材署名（如已全部替换）。
- 在微信内置浏览器、iPhone、Android 和桌面端实测首屏、滚动、分享、图片与寄语。
- 检查公开站点不含 Token、个人隐私、内部文件或本机写入接口。

## 技术与文件结构

```text
index.html                    九幕公开页面与弹层
styles.css                    视觉系统、排版、动效与响应式
app.js                        滚动、章节、弹层、声音、分享与本地寄语
data.js                       时间轴、发展板块、岗位热点、担当专题
studio.html / studio.js       公网在线换图控制台
studio.css                    控制台样式
素材替换台.html               本机集中换图工具（不会进入公网构建）
server.mjs                    本机预览服务器与受限写入接口
scripts/build-public.mjs      生成公网只读站点 dist/
scripts/verify-assets.mjs     槽位、文件与页面引用校验
scripts/test-image-api.mjs    本机图片接口测试
.github/workflows/deploy.yml  GitHub Pages 自动构建与部署
assets/fonts/                 本地字体，无外部字体服务
assets/photos/                23 个固定图片槽位
assets/grain.svg              胶片颗粒纹理
```

## 校验命令

```bash
npm run build
npm run verify
npm run test:images
```

`npm run verify` 检查 23 个槽位、固定文件名、实际文件与页面引用是否一致；`npm run test:images` 验证本机上传、备份、还原和写入边界。公开站点没有写入 API，访客只能浏览。

## 分享与寄语说明

- 分享按钮优先调用系统分享，不支持时复制当前固定网址。
- 寄语仅保存在访客本机的 `localStorage`，不会伪装成“已提交审核”或“已公开展示”。
- 声音使用浏览器实时合成的铁路环境氛围声，默认关闭，需访客主动开启。
- 页面无第三方统计脚本、无外部 CDN、无登录依赖。
