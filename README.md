# Remote Media Player / 远程媒体播放器

Remote Media Player is a phone-friendly media browser and player for folders shared from your PC or server. / Remote Media Player 是一个面向手机浏览器的媒体浏览和播放工具，用来访问电脑或服务器共享出来的文件夹。

The desktop app configures folders, starts the local media service, and shows a QR code. The phone scans the QR code, browses libraries, previews files, and plays audio/video in the browser. / 电脑端负责配置共享文件夹、启动媒体服务并显示二维码；手机扫码后可以浏览媒体库、预览文件，并在浏览器里播放音频和视频。

## Quick Start / 快速开始

Run the desktop app / 运行电脑端应用：

```powershell
.\run-desktop.ps1
```

On Windows, you can also double-click `run-desktop.cmd`. / 在 Windows 上也可以直接双击 `run-desktop.cmd`。

The desktop app runs locally. If an admin password is not set, the phone UI cannot enter management mode. / 电脑端应用在本机运行；如果没有设置管理员密码，手机端不能进入管理模式。

If you set an admin password in the desktop app, the phone UI shows an Admin entry. After unlocking, you can edit shared folders from the phone. / 如果在电脑端设置管理员密码，手机端会显示管理入口；解锁后可以在手机端编辑共享文件夹。

## Desktop Workflow / 电脑端流程

1. Add one or more media folders. / 添加一个或多个媒体文件夹。
2. Set the display name shown on phones. / 设置手机端看到的显示名称。
3. Optionally enable a password for each library. / 可选：为每个媒体库启用访问密码。
4. Optionally set an admin password for phone-side management. / 可选：设置管理员密码以启用手机端管理。
5. Optionally set a public URL, such as `https://media.example.com`. / 可选：填写公网访问地址，例如 `https://media.example.com`。
6. Start the service. / 启动服务。
7. Scan the QR code with your phone. / 用手机扫描二维码访问。

If a public URL is configured, the QR code uses that URL. Otherwise, it uses a local-network IP address. / 如果配置了公网访问地址，二维码会使用该地址；否则会使用局域网 IP。

If scanning does not open the page, check that / 如果扫码打不开页面，请确认：

- The desktop service is started. / 电脑端服务已经启动。
- Phone and PC are on the same Wi-Fi or reachable network. / 手机和电脑在同一个 Wi-Fi 或互相可达的网络中。
- Windows Firewall allows the service on private networks. / Windows 防火墙允许该服务在专用网络中通信。
- The shown IP address belongs to the same network as your phone. / 二维码里的 IP 地址和手机处于同一网络。

## Phone Admin / 手机端管理

The Admin entry appears only when an admin password is configured on the desktop app. / 只有电脑端配置了管理员密码，手机端才会显示管理入口。

Phone admin can edit public URL, library display name, folder path, per-library password, and add/remove libraries. / 手机端管理可以编辑公网地址、媒体库显示名、文件夹路径、媒体库访问密码，并添加或删除媒体库。

Admin unlock uses the same password transport rules as library unlock. / 管理解锁使用和媒体库解锁相同的密码传输规则。

## Password Security / 密码安全

When browser encryption is available, passwords are encrypted with `RSA-OAEP + SHA-256` before being sent. / 浏览器支持加密能力时，密码会用 `RSA-OAEP + SHA-256` 加密后再发送。

When opened from a private LAN address over HTTP, some browsers block WebCrypto. In that case, the app allows plaintext password fallback only for localhost/private-network requests. / 使用内网 IP 的 HTTP 地址访问时，有些浏览器会禁用 WebCrypto；此时应用只允许 localhost/局域网请求降级为明文密码提交。

Public-network HTTP still requires browser encryption or HTTPS. / 公网 HTTP 仍然需要浏览器加密能力或 HTTPS。

## Manual Server Mode / 手动服务模式

Start with a config file / 使用配置文件启动：

```powershell
npm start -- --config ".\media.config.json" --port 5178
```

Start with a single folder / 使用单文件夹模式启动：

```powershell
npm start -- --media "D:\Music" --port 5178
```

## Configuration / 配置文件

Example `media.config.json` / `media.config.json` 示例：

```json
{
  "publicUrl": "",
  "adminPassword": "change-this-admin-password",
  "libraries": [
    {
      "id": "music",
      "name": "Living Room Music / 客厅音乐",
      "path": "D:\\Music"
    },
    {
      "id": "movies",
      "name": "Movies / 电影收藏",
      "path": "E:\\Videos",
      "password": "change-this-library-password"
    }
  ]
}
```

The phone library list only exposes display names, not local folder paths. / 手机端媒体库列表只显示名称，不显示电脑上的真实文件夹路径。

For library passwords, you may use `passwordHash` instead of `password`; it should be a SHA-256 hex digest. / 媒体库密码可以用 `passwordHash` 替代 `password`，值为密码的 SHA-256 十六进制摘要。

## Features / 功能

- Desktop configuration app. / 电脑端配置应用。
- QR code connection for phones. / 手机扫码连接。
- Public URL first, local-network IP fallback. / 优先使用公网访问地址，没有配置时使用局域网 IP。
- Multiple media libraries. / 支持多个媒体库。
- Optional per-library password. / 支持为单个媒体库设置访问密码。
- Optional phone-side admin management. / 支持可选的手机端管理界面。
- Folder browsing. / 支持文件夹浏览。
- Built-in audio/video playback. / 支持应用内音频和视频播放。
- Image, text, Markdown, PDF, and common Office document browsing. / 支持图片、文本、Markdown、PDF 和常见 Office 文档浏览。
- Current-folder playlist with auto-next playback. / 可根据当前文件夹生成播放列表并自动播放下一项。
- HTTP Range support for seeking and large files. / 支持 HTTP Range，便于拖动进度和播放大文件。
- Mobile layout and PWA support. / 支持移动端布局和 PWA。

## Supported Formats / 支持格式

- Audio / 音频：`mp3`, `m4a`, `aac`, `flac`, `wav`, `ogg`, `opus`, `webm`
- Video / 视频：`mp4`, `m4v`, `mov`, `webm`, `mkv`, `avi`
- Images / 图片：`jpg`, `jpeg`, `png`, `gif`, `webp`, `bmp`, `svg`, `avif`
- Documents and text / 文档和文本：`pdf`, `doc`, `docx`, `xls`, `xlsx`, `ppt`, `pptx`, `rtf`, `md`, `txt`, `csv`, `json`, `xml`, `yaml`, `log`

Actual playback support depends on the phone browser and codecs. `mp4`, `mp3`, and `m4a` usually work best. / 实际播放能力取决于手机浏览器和编码支持，通常 `mp4`、`mp3`、`m4a` 兼容性最好。

## API

- `GET /api/health` - service status, access URL, and library summary / 服务状态、访问地址和媒体库摘要
- `GET /api/libraries` - visible library list for the phone UI / 手机端可见的媒体库列表
- `GET /api/crypto-key` - temporary RSA public key / 临时 RSA 公钥
- `POST /api/unlock` - unlock a protected library / 解锁受保护媒体库
- `GET /api/list?library=<id>&path=<path>` - list a library folder / 列出媒体库目录
- `GET /media/<libraryId>/<path>` - stream or preview a file / 流式播放或预览文件
- `GET /api/qr?text=<url>` - generate QR SVG / 生成二维码 SVG
- `GET /api/admin/status` - check whether phone admin is enabled / 检查是否启用手机端管理
- `POST /api/admin/unlock` - unlock phone admin / 解锁手机端管理
- `GET /api/admin/config` - read editable admin config / 读取可编辑管理配置
- `POST /api/admin/config` - save editable admin config / 保存可编辑管理配置

## Project Structure / 项目结构

```text
server.js                 # Node service entry / Node 服务入口
src/server/               # Service modules / 服务端模块
public/index.html         # Phone web app shell / 手机端页面
public/styles.css         # Phone web app styles / 手机端样式
public/js/                # Phone web app modules / 手机端模块
public/sw.js              # PWA cache worker / PWA 缓存
desktop/                  # C#/.NET desktop config app / C#/.NET 电脑端配置应用
media.config.example.json # Example config / 配置示例
```
