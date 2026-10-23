# SuHub · 素材库

自媒体素材本地管理工具（Windows 桌面应用）。只登记路径、不复制不移动，素材文件永远留在原位置。

## 功能

- **三类素材统一管理**：视频 / 图片 / 音频，缩略图网格浏览
- **软件内快速预览**：视频内置播放器（原生硬解）、图片大图（可切原始尺寸）、音频波形播放
- **导入**：单文件 / 多文件 / 整个文件夹（可选包含子文件夹），也支持把文件直接拖进窗口
- **右键操作**：打开所在文件夹（Explorer 定位选中）、用默认程序打开、复制路径
- **整理**：多标签、层级虚拟分类夹（不动真实文件）、按文件名/标签搜索
- **断链容错**：文件被移动或删除会标记"已丢失"，不删除记录；恢复后"重新校验"即可

## 快捷键

| 按键 | 作用 |
|------|------|
| 双击 / 空格 / Enter | 打开预览 |
| ← / → | 预览中切换上/下一个素材；空格播放暂停 |
| Ctrl / Shift + 点击 | 多选 / 范围选择 |
| Ctrl + A | 全选 |
| Delete | 从素材库移除所选（不动硬盘文件） |
| Ctrl + F | 聚焦搜索框 |
| Esc | 关闭预览 / 取消选择 |

## 开发

```bash
npm install          # 国内网络首次安装慢，见下方"镜像"说明
npm run dev          # 开发模式（热更新）
npm run build        # 编译产物（不打包）
npm run smoke        # 后端链路冒烟测试（ffmpeg 生成测试素材 → 导入 → 缩略图 → 查询）
npm run dist         # 打包 Windows 安装程序到 release/
```

### 国内网络镜像

本机网络访问 GitHub 较慢时，安装依赖与打包需要设置镜像环境变量：

```bash
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
export FFMPEG_BINARIES_URL=https://registry.npmmirror.com/-/binary/ffmpeg-static
export ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
npm install
```

另外本机 npm 11+ 默认拦截安装脚本，electron 的二进制需要手动放行：

```bash
npm install-scripts ls
npm install-scripts approve electron
node node_modules/electron/install.js   # 或直接手动执行其安装脚本
```

## 技术架构

```
Electron 45 + Vue 3 + TypeScript（electron-vite 构建，electron-builder 打包）
├─ electron/main        主进程
│   ├─ db.ts            better-sqlite3（N-API，自带预编译，无需本地编译）
│   ├─ protocol.ts      media:// 自定义协议（支持 Range 请求，视频拖动进度条流畅）
│   ├─ ipc.ts           全部 IPC 通道
│   └─ services/
│       ├─ ffmpeg.ts    ffmpeg 抽帧缩略图 + ffprobe 元数据（时长/分辨率）
│       ├─ importer.ts  文件/文件夹扫描导入（在 library.ts 中）
│       └─ library.ts   查询、后台处理队列、标签、分类夹
├─ electron/preload     contextBridge 安全暴露 window.api
├─ src                  渲染层（Vue 3 + Pinia + wavesurfer.js）
└─ electron-builder.yml 打包配置（ffmpeg/ffprobe 通过 extraResources 内置）
```

数据存储（用户 AppData 目录）：
- `sucai.db` —— 素材索引（路径、类型、标签、分类夹、元数据）
- `thumbs/` —— 缩略图缓存（480px JPG，按内容随机名，可整个删除无损）

## 说明

- "从素材库移除"只删除软件内记录和缩略图缓存，绝不删除硬盘上的原文件
- 视频预览依赖系统解码器，MP4/H.264、WebM 等常见格式原生硬解；MKV/AVI 等老格式如无法播放，请用"默认程序打开"
- 缩略图生成在导入后自动进行，右下角会显示处理进度
