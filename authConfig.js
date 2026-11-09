// 第三方登录配置（留空 = 对应的登录按钮不显示）。这两个值是公开的“应用 ID”，不是密钥，可以放在前端。
//  googleClientId : Google Cloud 控制台 -> API 和服务 -> 凭据 -> OAuth 客户端 ID（网页应用），例如 123456-abc.apps.googleusercontent.com
//  facebookAppId  : Meta for Developers -> 你的应用 -> 应用 ID（一串数字）
// 后端（Render 环境变量）也要填同样的值：GOOGLE_CLIENT_ID、FB_APP_ID。
export const AUTH = {
  googleClientId: '',
  facebookAppId: '',
};
