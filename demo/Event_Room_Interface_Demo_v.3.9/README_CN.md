# 使用说明

这个文件主要给前端 / 后端 / 其他组员快速了解如何运行和使用这个 demo。

## 1. 项目用途

这个 demo 模拟的是一个本地的会议室 presentation 系统：

- **Admin 端**：主持电脑使用，用来创建连接、显示二维码、查看连接状态、断开连接。
- **Controller / Presentation 端**：手机、iPad 或另一台电脑使用，用来上传文件、开始演示、翻页、缩放和移动画面。
- **Display 端**：展示屏幕使用，用来显示 presentation 内容。

基本流程是：

```text
Admin 创建连接
↓
手机 / iPad 扫码进入 Controller
↓
Controller 上传 PDF / PPT
↓
Controller 点击 Start Presentation
↓
Display 显示 presentation
↓
Controller 控制翻页、缩放、移动、切换文件
```

## 2. 运行前准备

需要先安装 **Node.js**。

检查是否已经安装：

```bash
node -v
```

如果显示类似：

```text
v20.x.x
```

说明 Node.js 已经可以使用。

## 3. Windows 启动方式

1. 解压项目 zip 文件。
2. 进入解压后的项目文件夹。
3. 在文件夹空白处右键，选择 **Open in Terminal** 或 **在终端中打开**。
4. 运行：

```bash
node cbrin_image_server_v2_idle.js
```

5. 浏览器打开：

```text
http://localhost:3000/admin
```

Admin 登录信息：

```text
Username: admin
Password: cbrin123
```

## 4. macOS 启动方式

1. 解压项目 zip 文件。
2. 打开 **Terminal**。
3. 进入项目文件夹，例如：

```bash
cd ~/Downloads/your-project-folder
```

4. 运行：

```bash
node cbrin_image_server_v2_idle.js
```

5. 浏览器打开：

```text
http://localhost:3000/admin
```

Admin 登录信息：

```text
Username: admin
Password: cbrin123
```

## 5. Admin 端使用流程

1. 打开：

```text
http://localhost:3000/admin
```

2. 登录 Admin。
3. 点击 **Connect**。
4. 选择 **Wireless**。
5. 页面会显示：
   - QR code
   - presentation URL
   - connection status
6. 让手机 / iPad 扫描 QR code，或者手动输入 URL。
7. 如果需要断开当前连接，点击红色 **Disconnect**。

## 6. Controller / 手机端使用流程

1. 用手机 / iPad 扫描 Admin 页面上的 QR code。
2. 进入 Presentation / Controller 页面。
3. 上传 PDF / PowerPoint 文件。
4. 选择要演示的文件。
5. 点击 **Start Presentation**。
6. 进入演示控制界面后，可以：
   - 点击上一页 / 下一页按钮翻页
   - 点击 Prev File / Next File 切换文件
   - 双指捏合缩放
   - 单指拖动画面
   - 点击 Exit 退出当前演示
   - 在 Start Presentation 页面点击 Disconnect 释放当前控制端连接

注意：手机端 / iPad 端不会显示 Share Screen 功能，因为移动端浏览器通常不支持真正的网页屏幕共享。

## 7. Display 端使用方式

Display 端用于显示 presentation 内容。

正常情况下，Controller 点击 **Start Presentation** 后，Display 页面会显示当前文件。

如果需要更像 PPT 演讲模式：

```text
在 Display 电脑上按 F11
```

这样可以隐藏浏览器地址栏和系统顶栏，进入更接近全屏演示的状态。

注意：网页代码不能强制远程电脑自动进入 F11 全屏模式，这是浏览器安全限制。

## 8. 手机 / iPad / 其他设备连接要求

所有设备必须在同一个 Wi-Fi / 局域网下。

如果 QR code 扫描后打不开，可以手动输入局域网地址。

### Windows 查看 IP

在 PowerShell 或 CMD 运行：

```bash
ipconfig
```

找到 `IPv4 Address`，例如：

```text
192.168.1.206
```

然后在手机上打开：

```text
http://192.168.1.206:3000/presentation
```

### macOS 查看 IP

Wi-Fi 通常运行：

```bash
ipconfig getifaddr en0
```

有线网络可以试：

```bash
ipconfig getifaddr en1
```

然后在手机上打开：

```text
http://你的Mac局域网IP:3000/presentation
```

## 9. 常见问题

### 手机扫码打不开

可能原因：

- 手机和电脑不在同一个 Wi-Fi。
- Windows 防火墙拦截了 Node.js。
- 使用了 VPN，导致局域网 IP 不正确。
- 学校 / 宿舍网络禁止设备互相访问。
- QR code 中的 IP 不是当前电脑的正确局域网 IP。

可以尝试手动输入：

```text
http://电脑局域网IP:3000/presentation
```

### 显示设备已经被占用

如果出现类似：

```text
Another controller is already connected
Another display screen is already connected
```

可以：

1. 在 Admin 点击红色 **Disconnect**。
2. 关闭旧的手机 / display 标签页。
3. 重新扫码进入。
4. 必要时重启 Node server。

### 页面看起来还是旧版本

浏览器可能用了缓存。

Windows 可以按：

```text
Ctrl + F5
```

macOS 可以按：

```text
Cmd + Shift + R
```

手机端建议直接关闭旧网页标签，然后重新扫码。

### 手机端不能分享屏幕

这是正常限制。

移动端浏览器通常不支持 `getDisplayMedia()` 这类真实屏幕捕获 API，所以手机端主要用于：

```text
上传文件
控制演示
翻页
缩放
移动画面
切换文件
```

真正的屏幕共享建议在电脑端测试。

### Display 无法自动进入真正全屏

网页不能远程强制电脑进入 F11 全屏。

解决方式：

```text
在 Display 电脑上手动按 F11
```

或者使用浏览器 kiosk mode。

## 10. 停止服务器

回到运行 server 的 Terminal / PowerShell 窗口，按：

```text
Ctrl + C
```

即可停止本地服务器。
