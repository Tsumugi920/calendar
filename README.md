# calendar 日程管理

一个前后端完整的项目：后端使用 **Node.js + Express** 提供 REST API，并把数据持久化到 `server/data.json` 文件；前端为原生 **HTML / CSS / JavaScript** 实现的月视图日历。两者由同一个 Express 服务（默认端口 **3008**）提供，无需数据库。

## 功能

- **月视图日历**：上 / 下月切换、一键回到今天、今日高亮、点击日期选中
- **事件列表**：展示选中日期的事件，点击即可编辑
- **关键词搜索**：按标题 / 地点 / 备注 / 分类模糊搜索，命中的日期在日历上虚线高亮
- **添加 / 编辑 / 删除事件**：弹窗表单，保存后自动跳到事件所在月份
- **提醒标识**：开启提醒的事件显示 🔔，侧栏「提醒汇总」给出未来 / 今日 / 已过统计与最近一条提醒
- **数据持久化**：所有增删改都写入 `server/data.json`，重启服务数据不丢

## 目录结构

```
calendar/
├── package.json          # 启动脚本 npm start（node server/server.js）
├── README.md
├── client/               # 前端（由 Express 静态托管）
│   ├── index.html
│   ├── style.css
│   └── app.js
└── server/               # 后端
    ├── server.js         # Express 应用：REST API + 静态托管
    └── data.json         # 数据持久化文件（内置 12 条示例事件）
```

## 环境要求

- Node.js ≥ 16（开发时使用 v22 验证）

## 安装与启动

```bash
cd calendar
npm install
npm start
```

然后打开 <http://localhost:3008> 即可使用。

> 端口说明：默认 **3008**，如需更换可用环境变量覆盖：`PORT=8080 npm start`。

## REST API

Base URL：`http://localhost:3008`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/events` | 列出全部事件；支持 `?date=YYYY-MM-DD` 按日期查询、`?keyword=xx` 关键词搜索 |
| GET | `/api/events/:id` | 查询单个事件 |
| POST | `/api/events` | 新增事件（返回 201） |
| PUT | `/api/events/:id` | 更新事件（全量字段） |
| DELETE | `/api/events/:id` | 删除事件 |
| GET | `/api/reminders` | 提醒汇总：开启提醒的事件 + 未来 / 今日 / 已过统计 |

事件字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `title` | string | 是 | 标题 |
| `date` | string | 是 | 日期，`YYYY-MM-DD` |
| `time` | string | 否 | 时间，`HH:MM`，不填存为 `null` |
| `location` | string | 否 | 地点 |
| `category` | string | 否 | 分类：工作 / 个人 / 学习 / 生活 / 其他（默认「其他」） |
| `notes` | string | 否 | 备注 |
| `reminder` | boolean | 否 | 是否开启提醒（默认 `false`） |

### curl 示例

```bash
# 列出全部事件
curl http://localhost:3008/api/events

# 按日期查询
curl "http://localhost:3008/api/events?date=2026-10-25"

# 关键词搜索
curl "http://localhost:3008/api/events?keyword=%E8%AF%84%E5%AE%A1"

# 新增事件
curl -X POST http://localhost:3008/api/events \
  -H 'Content-Type: application/json' \
  -d '{"title":"项目评审会","date":"2026-10-25","time":"10:00","reminder":true,"category":"工作"}'

# 更新事件
curl -X PUT http://localhost:3008/api/events/<id> \
  -H 'Content-Type: application/json' \
  -d '{"title":"项目评审会（改期）","date":"2026-10-26","time":"14:00","reminder":true}'

# 删除事件
curl -X DELETE http://localhost:3008/api/events/<id>

# 提醒汇总
curl http://localhost:3008/api/reminders
```

## 数据与示例事件

- 数据保存在 `server/data.json`，首次内置 **12 条示例事件**（覆盖 2026 年 9–11 月，含过去 / 今日 / 未来、开提醒 / 不开提醒各种情况）。
- 想清空数据：停止服务后删除 `server/data.json` 再启动 `npm start`，即可从空列表开始。
