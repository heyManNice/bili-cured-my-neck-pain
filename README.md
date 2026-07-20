<div align="center">
    <img width="180" src="config/assets/bcmnp-logo.png" alt="bcmnp-logo">
</div>

<br>
<h1 align="center" style="border:none;font-size:2.5rem;margin:0px">
    <b>B站治好了我的颈椎病</b>
</h1>

<p align="center">
    给B站PC网页版添加视频旋转与缩放功能，喜欢的话点点小星星哟😘
</p>

<br><br>

## 功能

将鼠标悬停在播放器控制栏右侧的旋转按钮上，弹出控制面板：

### 视频旋转
- **滑条** 0°–360° 任意角度，无步进限制
- **输入框** 直接键入任意角度（clamp 到 0–360）
- **快捷预设** 0° / 90° / 180° / 270°

旋转时自动补偿 16:9 宽高比，视频始终占满播放区域，无黑边。

### 视频缩放
- **滑条** 10%–1000%，无步进限制
- **输入框** 直接键入（clamp 到 ≥10%）
- **快捷预设** 100% / 170% / 240% / 320%

高倍缩放时自动启用平移功能。

### 缩略图导航
- 160×90 缩略图始终以轴对齐 16:9 显示
- 高倍缩放（>100%）时视口框缩小，**拖拽视口框**即可平移画面
- 缩放改变后平移自动归零，视口回到中心

## 安装

点击 [这里](https://bcmnp.ydcdgo.com) 选择你的安装方式。

支持：Chrome / Edge / Firefox 浏览器扩展，或 Tampermonkey 油猴脚本。

## 开发

```bash
git clone https://github.com/heyManNice/bili-cured-my-neck-pain.git
cd bili-cured-my-neck-pain
bun install
bun run build          # 输出到 dist/
```

| 源文件 | 行数 | 说明 |
|--------|------|------|
| `src/scripts/ctrl-rotate.ts` | 466 | 核心控制器 |
| `src/scripts/animates.ts` | 103 | 按钮动画关键帧 |
| `src/utils.ts` | 94 | 工具函数 |
| `src/main.ts` | 23 | 入口 |
| `src/styles/main.css` | 137 | 面板样式 |
| `src/htmls/ctrl-rotate.html` | 50 | UI 模板 |
| **合计** | **873** | |

VS Code 中按 `F5` 启动调试浏览器。

## 反馈

[提交 Issue](https://github.com/heyManNice/bili-cured-my-neck-pain/issues/new)
