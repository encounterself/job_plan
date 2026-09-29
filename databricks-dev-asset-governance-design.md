# Databricks 开发环境资产治理与企业微信告警

## 当前设计、实施步骤与已知限制

- 版本：1.0
- 日期：2026-09-29
- 状态：MVP 设计；企业微信 AI Bot 已完成受控群消息测试

## 1. 执行摘要

目标是每天固定时间扫描 Databricks 开发环境中的 Job、App、Agent、Notebook / Workspace File 等实名资产，识别需要迁移、整改或补充治理信息的问题，写入可追踪的 finding，再通过企业微信向负责人和治理群发送通知。

推荐的第一阶段组合：Databricks Scheduled Job + Python SDK/REST 扫描器 + Unity Catalog Delta 表 + 配置化规则引擎 + `notification_outbox` + 企业微信群机器人和自建应用。

核心原则：扫描和通知解耦；规则配置化；只读扫描、先提醒后处置；每条告警能定位到资产、负责人、证据和处理状态。

## 2. 当前已经验证的结果

- `@wecom/cli` 版本为 1.3.4，扫码授权链路已验证。
- 测试群 `job test` 已成功收到 Markdown 测试消息。
- 当前 AI Bot 的发送 schema 没有 `mentioned_list`、`mentioned_mobile_list` 或群成员查询字段。
- 当前 AI Bot 会话列表只能识别最近有消息往来的会话，不能作为完整通讯录或群成员目录。
- 生产长期运行不应依赖个人扫码授权；应迁移到群 Webhook 和企业微信自建应用，并将密钥放入 Databricks Secret Scope / Key Vault。

## 3. 总体架构

```text
每日固定时间
      |
      v
Databricks Scheduled Job
      |
      +--> Job / App / Agent / Workspace Scanner
      |
      v
asset_inventory  -->  Rule Engine  -->  governance_findings
                                              |
                                              v
                                      notification_outbox
                                              |
                                              v
                                      WeCom Dispatcher
                                      /              \
                         群 Webhook 汇总       自建应用逐人通知
```

扫描器只负责发现事实，规则引擎负责判断，通知分发器负责重试、去重和渠道路由。负责人映射、规则白名单和密钥引用都应独立配置。

## 4. 第一阶段范围

| 资产 | 读取内容 | 优先级 |
|---|---|---|
| Job | 元数据、任务定义、运行记录、负责人、代码来源、生产关联 | P0 |
| App | 名称、创建者、状态、代码路径、资源引用 | P0 |
| Notebook / Workspace File | 路径、创建者、更新时间、源代码或 hash | P0 |
| Agent / Knowledge Assistant | 创建者、更新时间、状态、数据源和配置元数据 | P1 |
| Pipeline | 名称、负责人、更新时间、生产关联 | P1 |
| Model Serving / Endpoint | 所有者、环境、更新时间、调用状态 | P2 |

第一阶段不自动删除、停止、部署或修改任何资产，只做发现、告警、跟踪和闭环记录。

## 5. 核心规则

### 5.1 Job 规则

- `JOB_ASSET_AGE_GT_5D`：资产创建或首次登记超过 5 天，且没有生产目标。
- `JOB_ACTIVE_RUN_GT_5D`：当前运行实例持续超过 5 天。
- `JOB_NO_PROD_TARGET`：没有生产 Job、DAB target、release ID 或生产链接。
- `JOB_NO_OWNER`：无法解析有效负责人。
- `JOB_STALE_30D`：30 天未运行或未更新。

“运行大于 5 天”必须明确是 Job 资产年龄还是单次运行时长，不能混为一个规则。

### 5.2 `test` / `tmp` 规则

1. 名称和路径：`test_job`、`/tmp/etl/`、`dev_test_project`。
2. 代码文本：`test_catalog.test_schema.table_a`、`tmp_sales`、`CREATE TABLE tmp_xxx`。
3. 结构化引用：SQL 解析、Python AST、实际运行访问表联合判断。

第一阶段可使用大小写不敏感正则；正式治理应增加 SQL Parser、Python AST、注释排除、白名单和合法临时表识别。

## 6. 数据模型

### `asset_inventory`

`scan_id`、`workspace_id`、`asset_id`、`asset_type`、`asset_name`、`asset_path`、`owner_email`、`creator`、`run_as`、`created_at`、`updated_at`、`last_run_at`、`environment`、`source_repo`、`production_target`、`asset_status`、`metadata_json`、`content_hash`。

### `governance_rules`

`rule_id`、`rule_name`、`asset_type`、`severity`、`enabled`、`threshold_days`、`match_type`、`match_expression`、`notification_template`、`escalate_after_days`。

### `governance_findings`

`finding_id`、`rule_id`、`asset_id`、`owner_email`、`severity`、`first_seen_at`、`last_seen_at`、`status`、`evidence`、`remediation`、`resolved_at`、`resolved_by`。

### `notification_outbox`

`notification_id`、`finding_id`、`channel`、`receiver`、`message_hash`、`status`、`retry_count`、`last_error`、`created_at`、`sent_at`。

## 7. 扫描与告警步骤

1. 调度器生成唯一 `scan_id`。
2. 扫描器分页读取各类资产。
3. 资产适配器统一字段并写入 `asset_inventory`。
4. 规则引擎读取启用规则和白名单。
5. 命中项写入或更新 `governance_findings`。
6. 通过稳定的 `finding_id + message_hash` 做幂等去重。
7. 生成待发送记录到 `notification_outbox`。
8. 分发器按优先级发送并记录成功、失败和重试。
9. 连续未整改按 3 天、7 天策略升级。
10. 问题消失后自动标记 `RESOLVED`，保留历史。

## 8. 企业微信通道设计

### 当前 AI Bot

适合开发验证和普通群消息。当前已成功向 `job test` 发送 Markdown，但不应依赖它发现群成员或做可靠的逐人 `@`。

### 群 Webhook

适合固定治理群的日报、汇总和兜底告警。若要 `@`，需要在消息中提供已知的企业微信用户标识或手机号；Webhook 本身不应被设计成群成员目录。

### 自建应用

适合按负责人发送详细告警。需要企业 ID、应用 ID、应用 Secret、应用可见范围和 Databricks 用户到企业微信用户的映射。

推荐路由：P1 = 负责人应用消息 + 治理群；P2 = 负责人应用消息；P3 = 每日群摘要。

## 9. 可靠 `@` 的实现方式

```text
Databricks owner_email / username
          |
          v
负责人映射表（邮箱、工号、WeCom userid、手机号）
          |
          +--> 群 Webhook：mentioned_list / mentioned_mobile_list
          |
          +--> 自建应用：touser 逐人发送
```

不要每天从当前 AI Bot 的最近会话列表推断完整群成员。负责人映射应由通讯录同步、人工维护或 HR/身份系统提供，并有失效和离职处理。

## 10. 配置实施顺序

0. 确认开发 Workspace、生产 Workspace、时区和扫描时间。
1. 创建 Unity Catalog catalog/schema 和四张治理表。
2. 创建只读 Service Principal，配置 Jobs、Apps、Workspace、Agent 所需最小权限。
3. 实现 Job、App、Workspace、Agent 适配器，统一分页、重试和部分失败处理。
4. 将规则放入 `governance_rules`，配置阈值、白名单和豁免截止时间。
5. 建立 Databricks 用户到企业微信用户的映射表。
6. 创建测试群 Webhook；创建受限可见范围的自建应用。
7. 将 Webhook key、corp secret 等放入 Secret Scope / Key Vault。
8. 先用 `dry_run` 生成消息预览，再向 `job test` 和测试用户发送固定消息。
9. 创建每日 Databricks Job，配置超时、重试、失败告警和手动补跑参数。
10. 观察一周后再扩大资产范围和通知范围。

## 11. 已知限制与风险

### 企业微信

- 当前 AI Bot CLI 没有可靠的群成员查询和显式 `@` 字段。
- 扫码/长连接授权具有短期或需要续期的运维特征，不适合生产无人值守。
- 群 Webhook 只能面向固定群，不能替代企业通讯录。
- 自建应用需要可见范围和用户映射；失效用户必须单独处理。
- Webhook、自建应用和 AI Bot 是不同能力边界，不能只配置一种凭据就覆盖全部场景。

### Databricks 扫描

- Job、App、Agent、Notebook 的 API 能力和可读字段不完全一致，Agent 必须按产品类型做适配器。
- Workspace 源代码读取受权限、路径和文件类型影响；不建议无差别导出整个 Workspace。
- 多 Workspace 需要跨 Workspace 凭据、网络和权限管理。
- API 分页、限流、临时失败和部分资产失败必须设计重试与断点。
- 仅凭名称判断“已迁移生产”会误判，应使用 DAB、release、CI/CD 或显式生产关联。

### 规则与治理

- 正则扫描会把注释、变量名和合法临时表误判为 `test/tmp`。
- 创建者不一定是长期负责人，必须保留 owner 解析优先级和兜底负责人。
- 每日通知如果没有去重、确认、豁免和升级，会产生通知疲劳。
- 第一阶段只提醒，不自动修改、停止或删除，治理闭环仍需要责任人处理。

## 12. 安全要求

- Secret 不写入 Notebook、Git、Delta 业务表或企业微信消息。
- 扫描 Service Principal 默认只读，通知服务与扫描服务分离。
- 告警只发送资产摘要、证据片段和治理链接，不发送完整源代码、令牌或敏感数据。
- 发送日志仅保存状态、错误码、finding_id 和消息 hash。
- 真实发送前必须有 `dry_run`、测试接收人白名单和单次发送上限。
- 对 `invaliduser`、权限错误和接口限流做分类处理，不能全部重试。

## 13. 分期计划与验收

### Phase 1：MVP

Job、App、Notebook 扫描；每日调度；超过 5 天和 `test/tmp` 规则；Delta 表；群摘要；通知去重。

### Phase 2：正式治理

Agent 适配器；自建应用逐人通知；负责人映射；生产目标识别；确认、豁免、关闭和升级。

### Phase 3：平台化

多 Workspace、多环境对比、治理门户、工单联动、事件驱动扫描和趋势看板。

验收至少包括：每日任务稳定执行、扫描支持分页和重试、告警可追溯、同一 finding 不重复生成、企业微信失败可重试、密钥不泄露、负责人可收到消息、问题消失后能关闭。

## 14. 待确认问题

1. “大于 5 天”最终按资产年龄还是单次运行时长。
2. 开发和生产是否为独立 Workspace。
3. 当前使用 DAB、Git、CI/CD 还是其他发布体系。
4. Agent 的具体类型：Knowledge Assistant、Genie Agent、Agent Bricks 或自定义 Agent。
5. 是否允许扫描 Notebook / Workspace File 源代码。
6. 企业微信是否必须逐人 `@`，还是群摘要即可。
7. 是否需要主管升级、豁免、确认和工单闭环。

## 15. 推荐结论

先以单 Workspace、只读扫描、测试群为边界完成 MVP；通知采用 `notification_outbox` 解耦；普通群消息可继续使用当前 AI Bot 做验证，生产告警采用群 Webhook + 自建应用组合。逐人 `@` 不依赖当前 AI Bot 的群成员发现，而通过负责人映射表和专用企业微信通道实现。

本文不保存任何企业微信真实密钥。当前已暴露过的 Secret 应在测试完成后旋转，并通过 Databricks Secret Scope 或企业密钥管理系统重新注入。
