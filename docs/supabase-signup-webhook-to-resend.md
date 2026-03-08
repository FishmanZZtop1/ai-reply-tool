# Supabase 注册用户邮箱捕获（DB Webhook -> Edge Function -> Resend）

这个方案不影响现有网站运行，因为它只新增一个独立 Edge Function。

## 已实现的函数
- 函数名：`supabase-signup-webhook`
- 路径：`supabase/functions/supabase-signup-webhook/index.ts`
- 访问 URL（生产）：
  `https://xlkibhktnsorttppzdby.supabase.co/functions/v1/supabase-signup-webhook`

函数逻辑：
1. 校验 `x-supabase-webhook-secret` 是否等于 `WEBHOOK_SHARED_SECRET`
2. 读取 `record.email`
3. 调用 Resend Audience API 写入联系人
4. 可选：若 payload 带 `record.id`，会同时 upsert 到 `marketing_contacts` 并记录 `marketing_events`

## 你需要在 Supabase Secrets 设置
在项目根目录执行（已登录并 link 项目后）：

```bash
supabase secrets set \
  WEBHOOK_SHARED_SECRET='你的随机长密钥' \
  RESEND_API_KEY='你的resend key' \
  RESEND_AUDIENCE_ID='你的audience id'
```

> `WEBHOOK_SHARED_SECRET` 建议 32+ 位随机字符串。

## 部署函数
```bash
supabase functions deploy supabase-signup-webhook --no-verify-jwt
```

## 创建 Database Webhook（Supabase 控制台）
推荐监听：`auth.users` 的 `INSERT`

- Table: `auth.users`
- Events: `INSERT`
- Method: `POST`
- URL: `https://xlkibhktnsorttppzdby.supabase.co/functions/v1/supabase-signup-webhook`
- Headers:
  - `x-supabase-webhook-secret: <与你 WEBHOOK_SHARED_SECRET 相同>`

## 快速测试
```bash
curl -X POST 'https://xlkibhktnsorttppzdby.supabase.co/functions/v1/supabase-signup-webhook' \
  -H 'Content-Type: application/json' \
  -H 'x-supabase-webhook-secret: 你的随机长密钥' \
  -d '{"type":"INSERT","schema":"auth","table":"users","record":{"id":"00000000-0000-0000-0000-000000000000","email":"test@example.com"}}'
```

预期响应：
```json
{"success":true,"message":"Email captured and synced."}
```

## 注意
- 你仓库里还保留了 Next.js 版本示例路由：`src/app/api/webhooks/supabase/route.ts`。
- 当前项目生产架构是 Vite + Supabase Edge Functions，实际可用的是本文件对应的 Edge Function 方案。
