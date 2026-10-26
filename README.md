# A3 Brand Tools

最新版 AI 品牌内容工具。

- 在线页面：<https://sheehy11.github.io/a3-brand-tools/>
- AI 模型：`gpt-5.6-sol`
- 前端入口：`index.html`
- Cloudflare Pages 服务：`https://a3-brand-tools.pages.dev`
- 服务源码：`worker/src/index.js`
- 完整与实际调用知识库：`knowledge/`

## 发布结构

前端由 GitHub Pages 从 `main` 分支根目录发布。AI 请求由 Cloudflare Pages 服务转发；正式使用者只输入网页访问密码，不接触 A3 Key。协作稿件、需求与偏好、素材库、生成记录、标题历史、人工标注和工作状态按当前使用人保存到 D1，并保留浏览器本地缓存作为断网兜底。

部署细节见 [DEPLOY.md](DEPLOY.md)。
