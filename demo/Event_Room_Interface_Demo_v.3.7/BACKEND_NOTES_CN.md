# 后端说明

这个文件主要给后端同学看，用来说明在修改或接入这个 demo 之前需要知道的内容。

## 当前架构

这个项目目前是一个本地运行的 Node.js demo server。

| 角色 | 常用 URL | 作用 |
|---|---|---|
| Admin | `/admin` | 创建房间，显示 QR / URL，管理连接状态和断开连接 |
| Controller / Presentation | `/presentation` 或 `/p/:room` | 手机、iPad 或另一台设备使用，用于上传文件并控制演示 |
| Display | `/display?room=ROOM_ID` | 展示端页面，用于在演示屏幕上显示 presentation 内容 |

启动服务器：

```bash
node cbrin_image_server_v2_idle.js
```

默认端口：

```text
3000
```

## 主要用户流程

1. Admin 点击 **Connect**。
2. 系统生成一个随机 room ID。
3. Admin 显示 QR code / URL，给控制端扫码或打开。
4. Controller 加入这个 room。
5. Controller 上传 presentation 文件。
6. Controller 点击 **Start Presentation**。
7. Display 打开或接收当前 presentation 状态。
8. Controller 和 Display 会同步翻页、切换文件、缩放和移动位置。
9. Admin 或 Controller 可以断开当前 room。

## Room / Device 逻辑

这个 demo 会把每一个 connection room 当成一个 session。

重要规则：

- 一个 room 同一时间只应该有一个 active controller。
- 一个 room 同一时间只应该有一个 active display。
- Admin 可以 disconnect room，并清理旧设备占用。
- Controller 可以主动断开自己，让其他设备重新加入。
- Display 在退出 presentation 时应该释放自己的 display slot。

这些逻辑主要是为了避免旧浏览器标签页、刷新后的页面、缓存 session 等把新设备挡住。

## 文件上传逻辑

Controller 会把 presentation 文件上传到本地 server。

当前 demo 支持的文件类型：

```text
PDF
PPTX
PPT
```

当前表现：

- PDF 最稳定。
- PPTX 可能会用简化版的浏览器文本读取逻辑，或者根据当前实现进行转换 / 展示。
- 旧版 `.ppt` 通常需要后端转换，才能准确预览。

推荐的后端改进方向：

```text
在 server 端把 PPT / PPTX 转换成 PDF 或 slide images，
然后让 Display 和 Controller 渲染转换后的结果。
```

未来可能用到的工具：

- LibreOffice headless conversion
- Windows server 上的 Microsoft Office conversion
- Cloud conversion API
- 后端逐页生成 slide image

## Display 同步逻辑

Controller 和 Display 需要共享同一份 presentation 状态。

状态里建议包含：

```json
{
  "room": "ROOM_ID",
  "fileId": "uploaded-file-id",
  "page": 1,
  "zoom": 1,
  "panX": 0,
  "panY": 0,
  "sequence": 100,
  "sourceClientId": "client-id"
}
```

重要点：

- 使用 sequence number 或 timestamp 来忽略旧事件。
- 如果 server 把事件广播回发送者，客户端应该忽略自己发出的事件。
- 翻页时应该把 zoom 和 pan 重置成默认值。
- pan 和 zoom 不应该只用原始像素同步，因为手机、iPad 和展示屏幕尺寸不同。
- 在不同设备之间同步时，更推荐使用相对位置 / normalized position。

## 移动端 / iPad 注意事项

移动端和 iPad 的行为跟桌面浏览器不完全一样。

已经实现 / 预期的行为：

- 移动端会隐藏 Share Screen，因为移动端浏览器通常不支持真实屏幕捕获。
- 移动端使用双指捏合来缩放。
- 移动端使用拖动手势来移动画面。
- 翻页和切换文件应该使用按钮，而不是滑动手势，避免误触。
- iPad 有时会把自己识别成桌面 Mac 浏览器，所以不能只依赖 user agent 来判断设备类型。

## 全屏说明

网页不能在没有用户交互的情况下，强制远程电脑进入真正的 F11 全屏模式。

实际可行的行为：

- Display 页面可以隐藏自己的内部 toolbar。
- 浏览器窗口 UI，比如地址栏、标签栏、系统按钮，通常不能被代码完全隐藏。
- 如果演示时需要真正全屏，请在 Display 电脑上按 **F11**。
- 也可以使用 kiosk mode 来实现更接近演讲模式的效果。

Chrome / Edge kiosk mode 示例：

```bash
chrome --kiosk http://localhost:3000/display?room=ROOM_ID
```

具体命令可能会因为操作系统和浏览器安装路径不同而不同。

## 连接状态

Admin 应该显示当前连接状态。

建议状态：

```text
Not connected
Waiting for controller
Controller connected
Presentation live
Presentation ended, link still active
Disconnected
```

建议颜色逻辑：

```text
Grey   = not connected / disconnected
Yellow = waiting
Green  = controller connected / live
Red    = error
```

## 重要限制

- 这仍然是一个本地 demo prototype，不是 production backend。
- 当前 room state 很可能是存在内存里的，所以重启 Node server 会清空所有 room。
- 如果需要长期保存，需要加入数据库或持久化文件存储。
- 如果多个小组 / 多台设备同时使用，需要加强后端 room / session 逻辑。
- 如果要上 production，需要加入上传校验、文件大小限制、MIME 检查和定期清理任务。

## 建议的后续后端任务

1. 把 server code 拆成更清晰的模块：
   - routes
   - upload handling
   - room/session manager
   - socket/event manager
   - static file serving

2. 加入稳定的 room / session API：
   - create room
   - join room
   - leave room
   - disconnect room
   - get room status

3. 加入更可靠的文件转换：
   - PPT / PPTX 转 PDF 或图片
   - 生成 slide thumbnails
   - 生成 page count metadata

4. 加入清理逻辑：
   - 删除过期 room
   - 删除旧上传文件
   - 超时后释放断开的设备

5. 加入更好的错误处理：
   - duplicate controller
   - duplicate display
   - missing file
   - upload failure
   - unsupported file type

## 快速测试清单

1. 启动 server。
2. 打开 `/admin`。
3. 点击 **Connect**。
4. 用手机 / iPad 扫 QR code 加入。
5. 上传一个 PDF。
6. 点击 **Start Presentation**。
7. 检查 Display 是否显示同一个文件。
8. 测试上一页 / 下一页。
9. 测试缩放 / 移动画面。
10. 测试切换文件。
11. 测试 Controller Disconnect。
12. 测试 Admin Disconnect。
13. 刷新手机页面，确认它不会一直占用 room，导致其他设备无法加入。
