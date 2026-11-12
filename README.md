# Lovia · 字体工作室

为 Readingo 笔记分享模板内置喜欢的字体。纯静态网页，所有文件仅在浏览器内处理。

## 使用方法

1. 导入包含 `meta.json` 和 HTML 入口的 Readingo 模板 ZIP。
2. 选择 TTF、OTF、WOFF 或 WOFF2 字体。
3. 预览效果，选择“全部文字”或“正文与想法”。
4. 下载生成的 ZIP，在 Readingo 中导入，无需解压。

出图修复版采用与用户实测成功的米金 ZIP 相同的包内字体结构：HTML 使用相对路径引用 `fonts/` 中的完整字体，不裁剪字库。浏览器支持 CompressionStream 时，将 TTF/OTF 无损压缩为 WOFF，保留全部字形与 OpenType 表；网站预览临时使用 data URL。

已知横线手札运行时恢复 Promise 返回尺寸的 `render()`、可调用的 `ready()`、导出准备和尺寸接口，并按 `posterWidth` 设置画布宽度。双动画帧等待保留计时器兜底。其他模板脚本保持原样，原字体名称通过 CSS 别名保留。

旧 ZIP 可以重新导入并自动识别内置字体，下载名称带“出图修复版”的 ZIP，再在 Readingo 中以新名称导入、选中新模板。旧文件不会自动升级。

## 部署

这是无需构建的静态网站。可直接通过 GitHub Pages 发布 `main` 分支的根目录，也可放到其他静态托管服务。

## 文件

- `index.html`、`style.css`：界面与排版。
- `app.js`：导入、预览与下载交互。
- `engine.js`：ZIP 处理、字体嵌入与导出校验。
- `zip-codec.js`：独立 ES 模块形式的 JSZip。
- `fonts/`、`assets/`：页面字体与 Lovia 标识。

## 限制

支持 version 1 的 `reader_share_template` 模板。ZIP 最大 90 MB，解压后最大 180 MB，字体最大 60 MB。暂不支持 TTC、加密 ZIP 及部分非标准压缩方式。

已使用示例模板验证浏览器预览和 ZIP 导出，Readingo 应用内的实际兼容性以导入结果为准。

第三方字体和库的授权说明随相应文件保留：`JSZip-LICENSE.md`、`fonts/SpecialElite-LICENSE.txt`、`fonts/HuiwenMincho-NOTICE.txt`。
