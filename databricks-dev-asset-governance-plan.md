# Databricks 开发环境资产治理与告警平台计划

- **文档状态**：方案草案
- **版本**：0.1
- **日期**：2026-09-28
- **目标**：每天扫描 Databricks 开发环境资产，识别需要迁移、整改或补充治理信息的问题，并通过企业微信通知资产负责人。

## 1. 背景与目标

平台上的 Job、Agent、App、Notebook 等开发资产通常由实名用户创建，但资产长期留在开发环境会带来以下问题：

- 开发 Job 长期运行或长期存在，未迁移到生产环境。
- 代码或路径引用 `test`、`tmp` 数据库、表或目录。
- 资产缺少负责人、生产目标、版本或来源仓库。
- 无人维护的旧资产占用计算资源和治理空间。
- 告警没有状态、去重和升级机制，容易造成通知疲劳。

本项目第一阶段聚焦三个关键能力：

1. **定时任务**：每天固定时间执行扫描。
2. **资产扫描**：扫描 Job、App、Agent 以及可导出的 Workspace 代码资产。
3. **企业微信通知**：将告警发送给负责人，并发送团队汇总消息。

## 2. 范围

### 2.1 第一阶段资产范围

| 资产类型 | 扫描内容 | 第一阶段优先级 |
|---|---|---:|
| Job | 元数据、任务定义、运行记录、负责人、代码来源 | P0 |
| App | 名称、创建者、运行状态、代码路径、资源引用 | P0 |
| Notebook / Workspace File | 路径、创建者、源代码、更新时间 | P0 |
| Agent / Knowledge Assistant | 创建者、更新时间、状态、数据源或配置元数据 | P1 |
| Pipeline | 名称、负责人、更新时间、生产关联 | P1 |
| Model Serving / Endpoint | 所有者、环境、更新时间、调用状态 | P2 |

### 2.2 暂不处理

- 自动删除资产。
- 自动停止 Job 或 Cluster。
- 自动把开发资产部署到生产。
- 自动修改用户代码或数据表。

第一阶段只做**发现、告警、跟踪和闭环状态记录**，避免误操作生产数据。

## 3. 规则口径

### 3.1 Job 相关规则

“运行大于 5 天”需要拆成两个独立规则，避免含义混淆：

| 规则 ID | 含义 | 默认级别 |
|---|---|---:|
| `JOB_ASSET_AGE_GT_5D` | Job 创建或首次登记超过 5 天，且没有生产目标 | P2 |
| `JOB_ACTIVE_RUN_GT_5D` | 当前运行实例持续超过 5 天 | P1 |
| `JOB_NO_PROD_TARGET` | 没有生产 Job、Bundle target、release ID 或生产链接 | P2 |
| `JOB_NO_OWNER` | 无法解析有效负责人 | P1 |
| `JOB_STALE_30D` | 30 天未运行或未更新 | P3 |

建议第一阶段优先实现 `JOB_ASSET_AGE_GT_5D`，随后加入 `JOB_ACTIVE_RUN_GT_5D`。

### 3.2 `test` / `tmp` 规则

分成三层，降低误报：

1. **资产名称和路径扫描**
   - `test_job`
   - `/tmp/etl/`
   - `dev_test_project`
2. **代码文本扫描**
   - `test_catalog.test_schema.table_a`
   - `tmp_sales`
   - `CREATE TABLE tmp_xxx`
3. **结构化引用扫描**
   - 解析 SQL 表引用。
   - 解析 Python 配置或 SQL 字符串。
   - 结合实际运行访问表进行确认。

第一阶段可以使用大小写不敏感正则；第二阶段再引入 SQL Parser 和 Python AST，减少注释、变量名和合法临时表产生的误报。

### 3.3 后续规则候选

| 规则 ID | 说明 | 默认级别 |
|---|---|---:|
| `ASSET_NO_OWNER` | 没有有效负责人或负责人已离职 | P1 |
| `ASSET_STALE_30D` | 长期无运行、无更新 | P3 |
| `ASSET_NO_SOURCE_REPO` | 没有关联 Git 仓库或 Bundle | P2 |
| `ASSET_NO_ENV_TAG` | 缺少 `dev/test/prod` 环境标签 | P2 |
| `AGENT_NO_DATA_OWNER` | Agent 没有数据所有者 | P2 |
| `APP_NO_PROD_TARGET` | App 没有生产部署记录 | P2 |
| `DEV_ASSET_USES_PROD_DATA` | 开发资产直接使用生产数据 | P1 |
| `EXCESSIVE_RESOURCE_USAGE` | 长期高消耗或异常资源使用 | P1 |

## 4. 总体架构

```text
                   每日固定时间
                         |
                         v
              Databricks Scheduled Job
                         |
      +------------------+------------------+
      |                  |                  |
      v                  v                  v
   Jobs Scanner       Apps Scanner       Agents Scanner
      |                  |                  |
      +------------------+------------------+
                         |
                         v
                Workspace Code Scanner
                         |
                         v
                  asset_inventory
                         |
                         v
                   Rule Engine
                         |
                         v
                  governance_findings
                         |
                         v
                 notification_outbox
                         |
                         v
                  WeCom Dispatcher
                  /              \
          负责人应用消息       群机器人汇总
```

### 4.1 推荐实现组合

| 模块 | 推荐实现 |
|---|---|
| 调度 | Databricks Lakeflow Job |
| 扫描 | Python Wheel + Databricks SDK / REST API |
| 数据存储 | Unity Catalog Delta 表 |
| 规则配置 | Delta 配置表 |
| 告警状态 | Delta findings 表 |
| 通知队列 | `notification_outbox` 表 |
| 个人通知 | 企业微信自建应用消息 |
| 团队汇总 | 企业微信群机器人 |
| 部署 | Declarative Automation Bundles（DAB） |
| 身份 | Service Principal，最小只读权限 |

## 5. 方案选择

### 方案 A：Databricks 原生方案（推荐 MVP）

```text
Databricks Job
  -> SDK/REST 扫描
  -> Delta 资产表
  -> 规则引擎
  -> Delta 告警表
  -> 企业微信
```

**优点**

- 不需要新增云服务。
- 调度、扫描、存储、日志都在 Databricks 内。
- 适合单 Workspace 或少量 Workspace。
- 可以用 DAB 管理代码和部署。

**缺点**

- 多 Workspace 场景需要跨 Workspace 认证。
- 如果被扫描 Workspace 整体不可用，扫描任务也可能受影响。

### 方案 B：中心化治理服务

```text
中央 Cron / Function / Kubernetes CronJob
  -> 多 Workspace API
  -> 中央治理库
  -> 统一规则引擎
  -> 企业微信 / 工单 / 邮件
```

**适合**

- 多开发、测试、生产 Workspace。
- 需要跨环境判断开发资产是否已存在生产对应物。
- 未来要建设统一治理门户。

**代价**

- 需要独立部署和维护服务。
- 需要管理多 Workspace 凭据、网络和权限。

### 方案 C：扫描与通知解耦

```text
扫描 Job
  -> findings
  -> notification_outbox
  -> 通知 Job
  -> 企业微信 / 邮件 / Slack / 工单
```

**推荐程度：强烈推荐作为数据链路设计。**

扫描任务不直接发送企业微信，而是写入通知队列表。通知任务负责重试、去重、升级和发送状态记录，避免企业微信故障影响扫描结果。

### 方案 D：定时扫描 + 事件驱动

新建或修改资产时做快速检查，每日全量扫描用于补偿和最终一致性。

**适合第二阶段以后使用。** 第一阶段先做每日扫描，等规则稳定后再接入事件机制。

## 6. 数据模型

### 6.1 `asset_inventory`

```text
scan_date
workspace_id
asset_id
asset_type
asset_name
asset_path
owner_email
creator
run_as
created_at
updated_at
last_run_at
environment
source_repo
production_target
asset_status
metadata_json
content_hash
```

### 6.2 `governance_rules`

```text
rule_id
rule_name
asset_type
severity
enabled
threshold_days
match_type
match_expression
notification_template
escalate_after_days
```

### 6.3 `governance_findings`

```text
finding_id
rule_id
asset_id
owner_email
severity
first_seen_at
last_seen_at
status
evidence
remediation
resolved_at
resolved_by
```

### 6.4 `notification_outbox`

```text
notification_id
finding_id
channel
receiver
message_hash
status
retry_count
last_error
created_at
sent_at
```

## 7. 扫描流程

### 7.1 Job Scanner

1. 分页读取 Job 列表。
2. 获取 Job 详情。
3. 读取创建时间、修改时间、负责人、`run_as`、任务类型、Git 来源和任务路径。
4. 读取最近运行记录。
5. 判断 Job 是否有生产目标。
6. 写入统一资产模型。

### 7.2 App Scanner

1. 分页读取 App 列表。
2. 获取 App 状态、创建者、代码路径和资源引用。
3. 判断是否存在生产部署或生产 target。
4. 检查负责人、更新时间和代码路径。

### 7.3 Agent Scanner

Agent 需要按具体产品做适配器：

- Knowledge Assistant。
- Genie Agent。
- Agent Bricks。
- 自定义 Model Serving Agent。

如果某类 Agent API 不支持源代码导出，则只做元数据、负责人、更新时间、数据源和权限检查。

### 7.4 Workspace Code Scanner

第一阶段只扫描与资产关联的代码路径，不建议对整个 Workspace 做无差别导出。

扫描顺序：

1. 资产名称和路径。
2. Notebook / Workspace File 源代码。
3. SQL 表引用。
4. Python 配置和 SQL 字符串。
5. 运行历史中实际访问的表。

安全要求：

- 扫描 Service Principal 只读权限。
- 告警中不保存完整源代码。
- 只保存命中规则的脱敏片段、文件路径和 hash。
- 禁止把访问令牌、密钥或完整代码发送到企业微信。

## 8. 企业微信通知设计

### 8.1 个人应用消息

用于负责人级别的详细告警：

```text
【Databricks 开发资产治理提醒】

资产：customer_daily
类型：Job
规则：JOB_ASSET_AGE_GT_5D
级别：P2
负责人：alice@example.com
问题：该 Job 已存在 8 天，尚未发现生产目标。
建议：迁移到生产 Bundle 或补充生产关联信息。
处理地址：治理平台链接
```

### 8.2 群机器人汇总

用于团队每日摘要：

```text
【Databricks 开发资产治理日报】

扫描资产：1,286
新增问题：12
待处理问题：47
P1：2 | P2：31 | P3：14

今日重点：
- 2 个 Job 持续运行超过 5 天
- 8 个资产引用 test/tmp 数据库
- 2 个 App 没有生产目标
```

### 8.3 通知去重和升级

```text
OPEN
  -> PENDING_NOTIFICATION
  -> SENT
  -> RETRYING
  -> ACKNOWLEDGED
  -> RESOLVED
```

建议策略：

- 首次发现：立即通知负责人。
- 第 3 天仍未处理：再次提醒。
- 第 7 天仍未处理：抄送主管或治理群。
- 问题消失：自动标记 `RESOLVED`。
- 同一 finding 每天最多发送一次同类型通知。

## 9. 负责人和生产目标识别

实名制资产不能只依赖创建者，因为创建者可能离职或转岗。

负责人解析优先级建议：

1. 显式 owner tag。
2. Job `run_as`。
3. 资产创建者。
4. Git 仓库 CODEOWNERS。
5. 关联项目负责人。
6. 团队默认负责人。
7. 治理管理员兜底。

生产目标识别可以使用：

- `production_target`。
- 生产 Job ID。
- DAB production target。
- Release ID。
- Git tag 或 release branch。
- CI/CD 部署记录。
- 生产 Workspace 中的对应资产。

不能只通过 Job 名称是否相同来判断迁移完成。

## 10. 分期计划

### Phase 1：MVP

- [ ] 建立资产统一模型。
- [ ] 扫描 Job、App、Notebook / Workspace File。
- [ ] 实现每日 Databricks Job 调度。
- [ ] 实现 Job 超过 5 天规则。
- [ ] 实现 `test/tmp` 名称、路径和代码规则。
- [ ] 建立资产表、规则表、告警表和通知队列表。
- [ ] 接入企业微信群机器人。
- [ ] 实现告警去重。

### Phase 2：正式治理

- [ ] 接入 Agent / Knowledge Assistant。
- [ ] 接入企业微信自建应用消息。
- [ ] 建立负责人和企业微信用户映射。
- [ ] 实现告警确认、豁免和关闭。
- [ ] 实现生产目标识别。
- [ ] 增加告警升级和主管抄送。
- [ ] 使用 DAB 管理部署。

### Phase 3：平台化

- [ ] 支持多 Workspace。
- [ ] 支持多环境对比。
- [ ] 建设治理查询页面。
- [ ] 支持工单系统。
- [ ] 支持邮件、Slack、飞书等通知渠道。
- [ ] 增加事件驱动扫描。
- [ ] 增加治理指标和趋势看板。

## 11. 第一阶段验收标准

### 定时任务

- [ ] 每天固定时间自动执行。
- [ ] 任务失败有重试和告警。
- [ ] 扫描批次有唯一 `scan_id`。
- [ ] 支持手动补跑指定日期。

### 资产扫描

- [ ] Job、App、Notebook / Workspace File 能正常入库。
- [ ] 支持分页和 API 重试。
- [ ] 负责人字段可解析。
- [ ] 资产扫描失败不影响其他资产类型。
- [ ] 扫描结果可追溯到 Workspace 和资产 ID。

### 规则判断

- [ ] Job 超过 5 天能够识别。
- [ ] 正在运行超过 5 天能够识别。
- [ ] `test/tmp` 名称、路径和代码命中可追溯。
- [ ] 支持白名单和豁免期限。
- [ ] 同一问题不会每天重复生成新 finding。

### 企业微信

- [ ] 负责人可以收到个人通知。
- [ ] 团队可以收到每日摘要。
- [ ] 消息失败可以重试。
- [ ] 消息中不包含密钥、令牌和完整源代码。
- [ ] 通知记录可查询。

## 12. 推荐结论

第一阶段采用：

```text
Databricks Scheduled Job
+ Python SDK / REST API 扫描器
+ Delta 资产和告警表
+ 配置化规则引擎
+ notification_outbox
+ 企业微信自建应用 + 群机器人
```

核心设计原则：

1. **扫描与通知解耦**。
2. **规则配置化，不把规则写死在代码中**。
3. **资产、finding、通知使用独立数据模型**。
4. **先提醒，不自动修改或删除资产**。
5. **所有告警都必须能定位到负责人、资产和证据**。
6. **从单 Workspace MVP 开始，为多 Workspace 和更多资产类型保留适配器接口**。

## 13. 待确认问题

在进入实现前需要确认：

1. 当前是单个开发 Workspace，还是多个开发 Workspace？
2. “运行大于 5 天”指 Job 创建超过 5 天，还是单次运行持续超过 5 天？
3. 生产环境是否是独立 Workspace？
4. 是否已经使用 DAB、Git、CI/CD 或发布平台？
5. 企业微信希望使用群机器人，还是必须逐人发送应用消息？
6. Agent 指 Knowledge Assistant、Genie Agent、Agent Bricks，还是自定义 Agent？
7. 是否允许扫描 Notebook 和 Workspace File 源代码？
8. 告警是否需要主管升级、确认、豁免和工单闭环？

