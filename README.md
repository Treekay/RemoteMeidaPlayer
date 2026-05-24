# Remote Media Player

一个面向手机浏览器的局域网媒体播放器。服务端把电脑或服务器上的指定文件夹配置成“媒体库”，手机打开网页后可以选择媒体库、浏览子文件夹，并在应用内播放音乐或视频。

## 启动

单个文件夹可以直接启动：

```powershell
npm start -- --media "D:\Music" --port 5178
```

也可以用环境变量：

```powershell
$env:MEDIA_ROOT="D:\Music"
$env:MEDIA_NAME="我的音乐"
$env:MEDIA_PASSWORD="可选密码"
npm start
```

启动后，在手机浏览器打开电脑的局域网 IP：

```text
http://你的电脑IP:5178
```

例如：

```text
http://192.168.1.20:5178
```

手机和电脑需要在同一个局域网内。Windows 防火墙如果弹窗，请允许 Node.js 在专用网络中通信。

## 多媒体库配置

复制 `media.config.example.json`，按需修改成自己的配置：

```json
{
  "libraries": [
    {
      "id": "music",
      "name": "客厅音乐",
      "path": "D:\\Music"
    },
    {
      "id": "movies",
      "name": "电影收藏",
      "path": "E:\\Videos",
      "password": "change-this-password"
    }
  ]
}
```

启动时传入配置文件：

```powershell
npm start -- --config ".\media.config.json" --port 5178
```

前端只会看到 `name`，不会暴露真实文件夹路径。`password` 存在时，该媒体库需要先解锁才能浏览和播放。

也可以把 `password` 换成 `passwordHash`，值为密码的 SHA-256 十六进制摘要，这样配置文件里不保存明文密码。

## 密码传输

前端解锁时会先请求服务端临时 RSA 公钥，然后用浏览器 Web Crypto 的 `RSA-OAEP + SHA-256` 加密密码，再发送到 `/api/unlock`。服务端解密并验证成功后返回临时播放令牌。

注意：这能避免密码以明文出现在请求体里，但如果你把服务暴露到不可信网络，仍应在反向代理或本机证书后使用 HTTPS，防止中间人替换公钥。

## 功能

- 展示服务端配置的多个媒体库名称
- 支持媒体库访问密码
- 浏览子文件夹，只显示可播放媒体和文件夹
- 应用内播放音频和视频
- 根据当前文件夹自动生成播放列表，当前曲目结束后自动播放下一项
- 支持 HTTP Range，便于拖动进度条和播放大文件
- 支持移动端布局和 PWA 安装

## 支持格式

音频：`mp3`、`m4a`、`aac`、`flac`、`wav`、`ogg`、`opus`、`webm`

视频：`mp4`、`m4v`、`mov`、`webm`、`mkv`、`avi`

浏览器是否能直接播放某个编码，取决于手机浏览器自身支持情况。通常 `mp4`、`mp3`、`m4a` 兼容性最好。

## API

- `GET /api/health` 查看服务状态和媒体库摘要
- `GET /api/libraries` 获取前端可见媒体库
- `GET /api/crypto-key` 获取临时 RSA 公钥
- `POST /api/unlock` 解锁受保护媒体库
- `GET /api/list?library=<id>&path=<path>` 列出媒体库目录
- `GET /media/<libraryId>/<path>` 流式播放指定媒体文件

## 项目结构

```text
server.js                 # 服务端启动入口
src/server/               # 服务端模块：配置、路由、加密、媒体库、流式播放、静态文件
public/index.html         # 前端页面外壳
public/styles.css         # 前端样式
public/js/                # 前端模块：状态、API、渲染、播放器、密码加密
public/sw.js              # PWA 静态资源缓存
media.config.example.json # 多媒体库配置示例
```
