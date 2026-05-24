# Remote Media Player / 远程媒体播放器

Remote Media Player is a local-network media player for phones. The desktop app configures folders on your PC, starts the media service, and shows a QR code. Your phone scans the code, browses the configured libraries, and plays music or video in the browser.

Remote Media Player 是一个面向手机浏览器的局域网媒体播放器。电脑端应用负责配置本机文件夹、启动媒体服务并显示二维码；手机扫码后即可浏览媒体库并播放音乐或视频。

## Quick Start / 快速启动

Run the desktop configuration app:

运行电脑端配置器：

```powershell
.\run-desktop.ps1
```

On Windows, you can also double-click `run-desktop.cmd`.

Windows 也可以直接双击 `run-desktop.cmd`。

The desktop app only runs locally. It is not exposed as a web setup page, so phones and other users cannot modify server settings from the browser.

If you set an admin password in the desktop app, the phone UI shows an Admin entry. After unlocking with the admin password, you can edit shared folders from the phone. The admin password is encrypted in the browser before it is sent.

如果在电脑端设置了管理员密码，手机端会显示管理入口。输入管理员密码解锁后，可以在手机端编辑共享文件夹。管理员密码会在浏览器中加密后再发送。

电脑端配置器只在本机运行，不通过网页暴露配置入口，因此手机或其他用户不能在浏览器里修改服务端设置。

## Desktop Workflow / 电脑端流程

1. Add one or more media folders.
2. Set the display name shown on phones.
3. Optionally enable a password for a library.
4. Optionally set a public URL, such as `https://media.example.com`.
5. Start the service.
6. Scan the QR code with your phone.

1. 添加一个或多个媒体文件夹。
2. 设置手机端看到的显示名称。
3. 按需为媒体库启用访问密码。
4. 可选填写公网访问地址，例如 `https://media.example.com`。
5. 启动服务。
6. 用手机扫码访问。

If a public URL is configured, the QR code uses that public URL. Otherwise, it automatically uses the best local-network IP address.

如果配置了公网访问地址，二维码会使用公网地址；如果没有配置，则自动选择最合适的局域网 IP。

If scanning does not open the page, check that:

如果扫码打不开页面，请确认：

- The desktop service is started.
- Phone and PC are on the same Wi-Fi or reachable network.
- Windows Firewall allows Node.js on private networks.
- The shown IP address belongs to the same network as your phone.

- 电脑端服务已经启动。
- 手机和电脑在同一个 Wi-Fi 或互相可达的网络中。
- Windows 防火墙允许 Node.js 在专用网络中通信。
- 二维码里的 IP 地址和手机处在同一网段。

## Manual Server Mode / 手动服务模式

You can still start the Node service manually for server deployments:

如果要部署到服务器，也可以手动启动 Node 服务：

```powershell
npm start -- --config ".\media.config.json" --port 5178
```

Single-folder mode:

单文件夹模式：

```powershell
npm start -- --media "D:\Music" --port 5178
```

## Configuration / 配置文件

Example `media.config.json`:

示例 `media.config.json`：

```json
{
  "publicUrl": "",
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
      "password": "change-this-password"
    }
  ]
}
```

The phone UI only receives `name`; local folder paths are never exposed through the library list.

手机端只会看到 `name`，不会在媒体库列表里看到电脑上的真实文件夹路径。

You may use `passwordHash` instead of `password`. The hash value is a SHA-256 hex digest.

也可以使用 `passwordHash` 替代 `password`，值为密码的 SHA-256 十六进制摘要。

## Password Security / 密码安全

When unlocking a protected library, the phone first requests a temporary RSA public key, encrypts the password with `RSA-OAEP + SHA-256`, and sends it to `/api/unlock`. The service returns a temporary playback token after verification.

解锁受保护媒体库时，手机端会先请求临时 RSA 公钥，再使用 `RSA-OAEP + SHA-256` 加密密码并发送到 `/api/unlock`。验证成功后，服务端返回临时播放令牌。

This prevents the password from appearing as plaintext in the request body. If exposing the service to untrusted networks, use HTTPS to prevent public-key replacement by a middleman.

这可以避免密码以明文出现在请求体中。如果把服务暴露到不可信网络，请使用 HTTPS，防止中间人替换公钥。

## Features / 功能

- Desktop-only configuration app.
- QR code connection for phones.
- Public URL first, local-network IP fallback.
- Multiple media libraries.
- Optional per-library password.
- Folder browsing.
- Built-in audio/video playback.
- Image, text, Markdown, PDF, and common Office document browsing.
- Current-folder playlist with auto-next playback.
- HTTP Range support for seeking and large files.
- Mobile layout and PWA support.

- 电脑端本机配置器。
- 手机扫码连接。
- 优先使用公网访问地址，没有配置则使用局域网 IP。
- 支持多个媒体库。
- 支持按媒体库设置访问密码。
- 支持文件夹浏览。
- 支持应用内音频/视频播放。
- 支持图片、文本、Markdown、PDF 和常见 Office 文档浏览。
- 根据当前文件夹生成播放列表，并自动播放下一项。
- 支持 HTTP Range，便于拖动进度条和播放大文件。
- 支持移动端布局和 PWA 安装。

## Supported Formats / 支持格式

Audio / 音频：`mp3`、`m4a`、`aac`、`flac`、`wav`、`ogg`、`opus`、`webm`

Video / 视频：`mp4`、`m4v`、`mov`、`webm`、`mkv`、`avi`

Images / 图片：`jpg`、`jpeg`、`png`、`gif`、`webp`、`bmp`、`svg`、`avif`

Documents and text / 文档和文本：`pdf`、`doc`、`docx`、`xls`、`xlsx`、`ppt`、`pptx`、`rtf`、`md`、`txt`、`csv`、`json`、`xml`、`yaml`、`log`

Actual playback support depends on the phone browser and codecs. `mp4`, `mp3`, and `m4a` usually work best.

实际能否播放取决于手机浏览器和编码支持。通常 `mp4`、`mp3`、`m4a` 兼容性最好。

## API

- `GET /api/health` service status, access URL, and library summary
- `GET /api/libraries` visible library list for the phone UI
- `GET /api/crypto-key` temporary RSA public key
- `POST /api/unlock` unlock a protected library
- `GET /api/list?library=<id>&path=<path>` list a library folder
- `GET /media/<libraryId>/<path>` stream media
- `GET /api/qr?text=<url>` generate QR SVG for a URL or pairing link

- `GET /api/health` 服务状态、访问地址和媒体库摘要
- `GET /api/libraries` 手机端可见媒体库列表
- `GET /api/crypto-key` 临时 RSA 公钥
- `POST /api/unlock` 解锁受保护媒体库
- `GET /api/list?library=<id>&path=<path>` 列出媒体库目录
- `GET /media/<libraryId>/<path>` 流式播放媒体文件
- `GET /api/qr?text=<url>` 为访问地址或配对链接生成二维码 SVG

## Project Structure / 项目结构

```text
server.js                 # Node service entry / Node 服务入口
src/server/               # Service modules / 服务端模块
public/index.html         # Phone web app shell / 手机端页面
public/styles.css         # Phone web app styles / 手机端样式
public/js/                # Phone web app modules / 手机端模块
public/sw.js              # PWA cache worker / PWA 缓存
desktop/                  # C#/.NET desktop config app / C#/.NET 电脑端配置器
media.config.example.json # Example config / 配置示例
```
