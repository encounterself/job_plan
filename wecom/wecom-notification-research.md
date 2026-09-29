# 企业微信通知验证与接入方案

## 1. 结论

建议分两步落地：

1. **第一步：群机器人 Webhook**
   - 只需要一个测试群机器人 URL。
   - 适合先验证 Databricks 扫描任务到企业微信的网络、消息格式和失败重试。
2. **第二步：企业微信自建应用消息**
   - 按 Databricks 资产负责人发送个人消息。
   - 需要企业 ID、应用 ID、应用 Secret 和企业微信 `userid` 映射。

企业微信应用消息接口使用 `access_token` 调用 `/cgi-bin/message/send`，返回 `errcode`、`errmsg`、`msgid` 以及无效用户等字段；接口支持重复消息检查参数，适合实现告警去重。具体参数以目标企业的企业微信管理后台和官方接口为准。

## 2. 两种发送方式

### 2.1 群机器人 Webhook

请求地址形态：

```text
https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=<ROBOT_KEY>
```

Markdown 请求体：

```json
{
  "msgtype": "markdown",
  "markdown": {
    "content": "## Databricks 开发资产提醒\n> Job `demo_job` 超过 5 天未迁移生产。"
  }
}
```

测试命令模板：

```bash
curl --fail-with-body --request POST \
  --url "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=$WECOM_ROBOT_KEY" \
  --header 'Content-Type: application/json' \
  --data '{
    "msgtype": "markdown",
    "markdown": {
      "content": "## Databricks 测试消息\n> 这是一条受控测试消息。"
    }
  }'
```

优点：配置快、适合群日报。缺点：不适合根据实名负责人逐人发送，机器人 Secret 只能发到绑定的群。

### 2.2 企业微信自建应用消息

获取 Token：

```bash
curl --fail-with-body \
  "https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=$WECOM_CORP_ID&corpsecret=$WECOM_CORP_SECRET"
```

发送 Markdown 应用消息：

```bash
curl --fail-with-body --request POST \
  --url "https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=$WECOM_ACCESS_TOKEN" \
  --header 'Content-Type: application/json' \
  --data '{
    "touser": "test_userid",
    "msgtype": "markdown",
    "agentid": 100001,
    "markdown": {
      "content": "## Databricks 开发资产提醒\n> Job `demo_job` 超过 5 天未迁移生产。"
    },
    "enable_duplicate_check": 1,
    "duplicate_check_interval": 1800
  }'
```

优点：可按实名负责人发送，适合生产治理。缺点：需要管理应用可见范围、`userid` 映射和 Secret。

## 3. 本地安全自测

工作区中的 `wecom_notifier.py` 提供本地 Mock 测试：

```bash
python3 wecom/wecom_notifier.py --self-test
```

该命令只启动 `127.0.0.1` 的本地 Mock HTTP 服务，验证：

- Webhook Markdown payload。
- 应用消息 payload。
- HTTP POST 和 JSON 响应处理。
- `errcode=0` 成功判断。
- 应用消息的重复检查字段。

它不会访问企业微信，也不会读取或发送任何真实 Secret。

## 4. 真实测试前需要提供的内容

### 4.1 最小测试：群机器人

只需要：

- 一个专门的企业微信群。
- 一个测试群机器人。
- 机器人 Webhook URL 中的 key。
- 测试时间窗口和允许发送的群。

不要把完整 Webhook URL 直接粘贴到聊天中。建议写入本地环境变量：

```bash
export WECOM_ROBOT_KEY='...'
```

### 4.2 实名测试：自建应用

需要以下非 Secret 信息：

- `corp_id`。
- `agent_id`。
- 测试用户的企业微信 `userid`。
- 应用可见范围。
- 测试部门或测试标签。

需要以下 Secret，但不要贴到对话中：

- `corp_secret`。
- 如果同时使用群机器人，则需要 `robot_key`。

推荐通过本地环境变量、Databricks Secret Scope 或企业密钥管理系统注入：

```bash
export WECOM_CORP_ID='...'
export WECOM_AGENT_ID='100001'
export WECOM_TEST_USERID='...'
export WECOM_CORP_SECRET='...'
```

## 5. 受控真实测试步骤

### 阶段 A：只测群机器人

1. 创建“Databricks 治理测试群”。
2. 添加群机器人。
3. 配置 `WECOM_ROBOT_KEY`，只发送一条固定测试消息。
4. 验证 HTTP 返回 `errcode=0`。
5. 在群内确认消息内容、中文、Markdown 和换行正常。
6. 记录机器人发送失败时的返回内容。

### 阶段 B：测试自建应用

1. 创建或选择测试应用。
2. 将应用可见范围限制为测试部门或测试用户。
3. 配置测试用户 `userid`。
4. 获取 access token。
5. 发送一条固定 Markdown 测试消息。
6. 验证用户能收到消息。
7. 使用无效用户测试 `invaliduser` 返回处理。
8. 使用同样 payload 连续发送，验证重复检查行为。

### 阶段 C：接入治理告警

1. 用一条模拟 finding 生成通知。
2. 检查负责人映射。
3. 检查消息中不包含完整代码、Secret 或 Token。
4. 检查重复 finding 不重复发送。
5. 检查失败后可以重试。
6. 检查 `RESOLVED` 后发送关闭通知或停止提醒。

## 6. 生产安全要求

- Secret 不写入 Notebook、Git、Delta 表或企业微信消息。
- Webhook key 和 `corp_secret` 只通过 Secret Scope / Key Vault / 环境变量注入。
- 真实发送前必须有 `dry_run` 和测试接收人白名单。
- 默认只允许测试群和测试用户。
- 发送日志只记录状态、错误码、finding_id 和消息 hash，不记录 Secret。
- 企业微信发送失败需要指数退避重试，并设置最大重试次数。
- `invaliduser`、`invalidparty`、`invalidtag` 要单独记录，不能把所有错误都重试。
- 同一个 finding 使用稳定的 `message_hash` 做幂等键。

## 7. 建议的通知接口

业务规则不应该直接调用企业微信。统一抽象为：

```python
send_notification(
    channel="wecom_app",
    receiver="alice_wecom_userid",
    title="Databricks 开发资产治理提醒",
    body="Job customer_daily 超过 5 天未迁移生产",
    finding_id="finding-20260928-001",
    dry_run=True,
)
```

后续可以增加：

- `wecom_webhook`
- `wecom_app`
- `email`
- `slack`
- `feishu`
- `ticket`

## 8. 参考

- 企业微信应用消息接口：`/cgi-bin/message/send`
- 企业微信 Token 接口：`/cgi-bin/gettoken`
- 企业微信群机器人 Webhook：`/cgi-bin/webhook/send?key=...`
- 工作区本地自测：`wecom/wecom_notifier.py`

## 9. 通知通道可配置控制

不是固定只能使用一种“机器人”。建议将企业微信通知抽象成两个通道：

| 通道 | 实现 | 能发给谁 | 推荐用途 |
|---|---|---|---|
| `wecom_webhook` | 企业微信群机器人 Webhook | 固定微信群 | 每日摘要、团队公告、失败兜底 |
| `wecom_app` | 企业微信自建应用消息 | 个人、部门、标签 | 负责人逐人告警、P1/P2 升级 |

### 9.1 推荐路由

```yaml
notifications:
  dry_run: true
  default_channel: wecom_webhook

  routes:
    P1:
      - wecom_app
      - wecom_webhook
    P2:
      - wecom_app
    P3:
      - daily_digest

  channels:
    wecom_webhook:
      enabled: true
      secret_ref: wecom-robot-key
      receiver: governance-test-group

    wecom_app:
      enabled: false
      corp_id_ref: wecom-corp-id
      corp_secret_ref: wecom-corp-secret
      agent_id: 100001
      allow_users:
        - test_userid

    daily_digest:
      enabled: true
      channel: wecom_webhook
      receiver: governance-test-group
```

`secret_ref` 只保存 Secret Scope、Key Vault 或环境变量的引用，不保存真实 Secret。

### 9.2 发送决策

```text
finding 生成
    |
    v
读取 severity、owner、channel、dry_run
    |
    +-- P1 -> 负责人应用消息 + 治理群
    +-- P2 -> 负责人应用消息
    +-- P3 -> 每日群摘要
    +-- 通知失败 -> 写入 retry 队列
```

## 10. 逐步配置清单

### Step 0：确认发送模式

需要确认：

- 是否只需要群消息，还是必须逐人通知？
- 是否需要 P1/P2/P3 不同通知策略？
- 是否需要主管抄送？
- 是否需要每天固定时间发送摘要？
- 是否允许先只向测试群、测试用户发送？

建议第一阶段：

```text
P1：负责人应用消息 + 治理测试群
P2：负责人应用消息
P3：每天一次群摘要
```

### Step 1：创建企业微信测试群

需要：

- 一个专门的测试群，例如“Databricks 治理测试群”。
- 将执行测试的管理员加入该群。
- 确认群消息不会触达正式业务群。

产出：测试群已经存在。

### Step 2：创建群机器人

在测试群中添加群机器人，记录 Webhook Key。

需要保存：

```text
WECOM_ROBOT_KEY
```

不要把 Key 写入代码、Notebook、Git 或普通配置表。

建议保存位置：

- Databricks Secret Scope。
- 企业 Key Vault。
- 本地测试环境变量。

验证方式：先发送固定测试消息，不接入资产扫描逻辑。

### Step 3：创建企业微信自建应用

只有需要逐人通知时才需要这一步。

在企业微信管理后台创建自建应用，并将可见范围限制为测试部门或测试用户。

需要记录：

```text
WECOM_CORP_ID
WECOM_AGENT_ID
WECOM_CORP_SECRET
```

其中 `WECOM_CORP_SECRET` 必须作为 Secret 保存，不能粘贴到对话或代码中。

### Step 4：准备测试用户映射

Databricks 资产负责人通常是邮箱或用户名，企业微信使用 `userid`，因此需要映射表：

```text
databricks_user | email | wecom_userid | manager_userid | enabled
alice            | ...   | alice_wecom   | manager_001   | true
```

需要提供：

- 一个测试用户的企业微信 `userid`。
- 该用户的 Databricks 登录名或邮箱。
- 如果要测试升级通知，再提供一个测试主管 `userid`。

### Step 5：配置发送通道

推荐使用环境变量或 Secret Scope：

```bash
export WECOM_ROBOT_KEY='...'
export WECOM_CORP_ID='...'
export WECOM_AGENT_ID='100001'
export WECOM_CORP_SECRET='...'
export WECOM_TEST_USERID='...'
```

通道开关使用普通配置：

```yaml
wecom_webhook_enabled: true
wecom_app_enabled: false
dry_run: true
allowlist_only: true
```

### Step 6：先做本地 Mock

不接企业微信、不访问网络：

```bash
python3 wecom/wecom_notifier.py --self-test
```

验证内容：

- Webhook payload 是否正确。
- 应用消息 payload 是否正确。
- 负责人 userid 是否正确写入。
- 消息类型是否为 Markdown。
- 重复检查字段是否存在。
- HTTP 成功和失败是否能被处理。

### Step 7：只测试群机器人真实发送

此时只启用：

```yaml
wecom_webhook_enabled: true
wecom_app_enabled: false
dry_run: false
allowlist_only: true
```

发送内容固定为：

```text
【测试】Databricks 治理通知链路已连通。
```

验证：

- 测试群能收到消息。
- Databricks 或本地运行环境能访问企业微信域名。
- 返回 `errcode=0`。
- 错误响应能写入日志，但不泄露 Key。

### Step 8：只测试自建应用真实发送

此时只允许一个测试用户：

```yaml
wecom_webhook_enabled: false
wecom_app_enabled: true
dry_run: false
allow_users:
  - test_userid
```

验证：

- Token 获取成功。
- 测试用户能够收到应用消息。
- 无效 userid 会进入失败记录，不会无限重试。
- 应用可见范围正确。

### Step 9：测试告警路由

使用模拟 finding，不直接扫描真实资产：

```json
{
  "finding_id": "demo-001",
  "asset_type": "JOB",
  "asset_name": "customer_daily",
  "owner_email": "alice@example.com",
  "severity": "P2",
  "rule_id": "JOB_ASSET_AGE_GT_5D",
  "evidence": "created_at is 8 days ago",
  "remediation": "migrate to production"
}
```

验证：

- P1 是否同时发个人消息和群消息。
- P2 是否只发负责人消息。
- P3 是否只进入每日汇总。
- 同一个 finding 是否不会重复发送。
- 发送失败是否进入 `notification_outbox` 重试。

### Step 10：接入 Databricks 定时 Job

最后才将真实扫描结果接入：

```text
扫描资产
  -> 写入 findings
  -> 读取通知路由配置
  -> 写入 notification_outbox
  -> 通知任务发送
```

建议初始配置：

```yaml
schedule: "每天 09:00"
timezone: "Asia/Shanghai"
dry_run: true
allowlist_only: true
max_messages_per_run: 20
```

连续验证 2–3 天后，再关闭 `dry_run` 或扩大接收人范围。

## 11. 我需要你提供什么

### 先提供非敏感信息

可以直接告诉我：

1. 先测试群机器人，还是直接测试自建应用？
2. 企业微信是国内企业微信环境还是其他区域环境？
3. 是否已有测试群？
4. 是否已有自建应用？
5. Databricks 运行环境能否访问公网企业微信 API？
6. 企业微信通知的默认时区和每日发送时间。
7. 负责人是按邮箱、工号还是 Databricks 用户名映射？

### Secret 不要直接发到聊天

如果要做真实发送，请通过运行环境注入以下变量：

```text
WECOM_ROBOT_KEY
WECOM_CORP_ID
WECOM_AGENT_ID
WECOM_CORP_SECRET
WECOM_TEST_USERID
```

第一轮最少只需要：

```text
WECOM_ROBOT_KEY
```

先完成测试群发送，再决定是否启用自建应用逐人通知。

## 12. 7 天授权限制与生产方案调整

当前通过 `wecom-cli auth init --noninteractive` 完成的机器人授权有效期只有 7 天。这个授权适合交互式使用和测试，不适合作为 Databricks 每日无人值守告警任务的唯一凭据。

### 12.1 不推荐的做法

```text
Databricks Job
  -> 使用 wecom-cli 当前授权
  -> 每天发送告警
```

原因：

- 7 天后需要人工重新扫码。
- 授权依赖某个真人用户和当前 CLI 会话。
- 无法保证无人值守任务连续运行。
- 不能把这种临时授权当成生产 Secret。

### 12.2 推荐的生产做法

```text
Databricks Job
  -> Secret Scope / Key Vault
  -> 企业微信长期凭据
  -> 自动获取短期 access_token
  -> 发送应用消息或群机器人消息
```

生产告警建议改成以下两种通道之一：

#### 方案 A：群机器人 Webhook

适合每日群摘要和团队通知：

```text
WECOM_ROBOT_KEY
```

优点：配置简单、无需人工扫码、适合单向发送。

限制：默认只能发到绑定的群，不适合作为逐人负责人通知的唯一方式。

#### 方案 B：企业微信自建应用消息（推荐）

适合向资产负责人逐人发送：

```text
WECOM_CORP_ID
WECOM_AGENT_ID
WECOM_CORP_SECRET
WECOM_USER_MAPPING
```

程序使用 `corp_id + corp_secret` 自动获取短期 access token，再调用应用消息接口；不需要每 7 天人工扫码。`corp_secret` 必须放在 Databricks Secret Scope、Key Vault 或其他密钥管理系统中。

### 12.3 `wecom-cli` 的正确定位

保留 `wecom-cli` 用于：

- 授权验证。
- 手工测试消息。
- 管理员临时查询企业微信信息。
- 验证群会话和消息格式。

不要把 `wecom-cli` 的 7 天交互授权作为生产 Databricks Job 的长期发送凭据。

### 12.4 生产通知路由

```yaml
production:
  P1:
    - wecom_app
    - wecom_webhook
  P2:
    - wecom_app
  P3:
    - wecom_webhook_digest

credentials:
  wecom_app:
    corp_id_secret_ref: wecom-corp-id
    corp_secret_ref: wecom-corp-secret
    agent_id: 100001
  wecom_webhook:
    robot_key_ref: wecom-robot-key
```

### 12.5 需要用户提供的生产配置

不要把 Secret 直接发到聊天中，只需要通过受控环境注入：

第一阶段群消息：

```text
WECOM_ROBOT_KEY
```

第二阶段实名消息：

```text
WECOM_CORP_ID
WECOM_AGENT_ID
WECOM_CORP_SECRET
WECOM_TEST_USERID
```

此外还需要确认：

- 测试群名称。
- 测试用户和 Databricks 邮箱的映射。
- 生产通知允许发送的部门或用户范围。
- 是否允许 P1 告警抄送主管。
- Databricks Job 运行时是否允许访问企业微信 API。
