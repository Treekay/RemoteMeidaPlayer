namespace RemoteMediaPlayer.Desktop;

internal sealed class MainForm : Form
{
    private const int Port = 5178;
    private readonly FlowLayoutPanel _libraryList = new();
    private readonly TextBox _publicUrl = new();
    private readonly Label _status = new();
    private readonly Label _accessUrl = new();
    private readonly WebBrowser _qrBrowser = new();
    private readonly Button _serverButton = new();
    private readonly ServerProcess _server = new();
    private AppConfig _config = AppConfig.Default();

    public MainForm()
    {
        Text = "Remote Media";
        MinimumSize = new Size(1040, 720);
        BackColor = Color.FromArgb(14, 17, 23);
        ForeColor = Color.White;
        Font = new Font("Microsoft YaHei UI", 9F);
        BuildUi();
        LoadConfig();
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        _server.Dispose();
        base.OnFormClosing(e);
    }

    private void BuildUi()
    {
        var shell = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            Padding = new Padding(18),
            ColumnCount = 2
        };
        shell.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 64));
        shell.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 36));

        shell.Controls.Add(BuildConfigPanel(), 0, 0);
        shell.Controls.Add(BuildAccessPanel(), 1, 0);
        Controls.Add(shell);
    }

    private Control BuildConfigPanel()
    {
        var panel = Panel();
        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, RowCount = 5 };
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));

        layout.Controls.Add(Header("电脑端设置", "选择要共享的媒体文件夹。手机端只会看到显示名称，不会看到电脑里的真实路径。"), 0, 0);

        var publicRow = new TableLayoutPanel { Dock = DockStyle.Top, ColumnCount = 2, AutoSize = true, Margin = new Padding(0, 14, 0, 18) };
        publicRow.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        publicRow.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 132));
        _publicUrl.PlaceholderText = "公网访问地址（可选，例如 https://media.example.com）";
        _publicUrl.Height = 36;
        publicRow.Controls.Add(_publicUrl, 0, 0);
        var applyUrl = Button("更新二维码");
        applyUrl.Click += (_, _) => RefreshAccess();
        publicRow.Controls.Add(applyUrl, 1, 0);
        layout.Controls.Add(publicRow, 0, 1);

        _libraryList.Dock = DockStyle.Fill;
        _libraryList.FlowDirection = FlowDirection.TopDown;
        _libraryList.WrapContents = false;
        _libraryList.AutoScroll = true;
        layout.Controls.Add(_libraryList, 0, 2);

        var actions = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true, FlowDirection = FlowDirection.LeftToRight };
        var add = Button("添加文件夹");
        add.Click += (_, _) => AddLibrary(new MediaLibrary());
        var save = Button("保存设置");
        save.Click += (_, _) => SaveConfig();
        _serverButton.Text = "启动服务";
        _serverButton.Height = 38;
        _serverButton.Width = 120;
        _serverButton.BackColor = Color.FromArgb(93, 214, 182);
        _serverButton.ForeColor = Color.FromArgb(6, 17, 14);
        _serverButton.FlatStyle = FlatStyle.Flat;
        _serverButton.Click += (_, _) => ToggleServer();
        actions.Controls.Add(add);
        actions.Controls.Add(save);
        actions.Controls.Add(_serverButton);
        layout.Controls.Add(actions, 0, 3);

        _status.ForeColor = Color.FromArgb(161, 172, 188);
        _status.AutoSize = true;
        _status.Margin = new Padding(0, 12, 0, 0);
        layout.Controls.Add(_status, 0, 4);
        panel.Controls.Add(layout);
        return panel;
    }

    private Control BuildAccessPanel()
    {
        var panel = Panel();
        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, RowCount = 4 };
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 328));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        layout.Controls.Add(Header("手机访问", "启动服务后，用手机相机扫描二维码即可打开播放端。"), 0, 0);

        _qrBrowser.Dock = DockStyle.Fill;
        _qrBrowser.ScrollBarsEnabled = false;
        _qrBrowser.ScriptErrorsSuppressed = true;
        layout.Controls.Add(_qrBrowser, 0, 1);

        _accessUrl.Dock = DockStyle.Top;
        _accessUrl.ForeColor = Color.FromArgb(93, 214, 182);
        _accessUrl.Font = new Font(Font.FontFamily, 12F, FontStyle.Bold);
        _accessUrl.Margin = new Padding(0, 14, 0, 8);
        layout.Controls.Add(_accessUrl, 0, 2);

        var copy = Button("复制访问地址");
        copy.Click += (_, _) =>
        {
            if (!string.IsNullOrWhiteSpace(_accessUrl.Text)) Clipboard.SetText(_accessUrl.Text);
            _status.Text = "访问地址已复制。";
        };
        layout.Controls.Add(copy, 0, 3);
        panel.Controls.Add(layout);
        return panel;
    }

    private void LoadConfig()
    {
        _config = AppConfig.Load(ProjectPaths.ConfigPath);
        _publicUrl.Text = _config.PublicUrl;
        _libraryList.Controls.Clear();
        foreach (var library in _config.Libraries)
        {
            AddLibrary(library);
        }
        RefreshAccess();
        _status.Text = $"配置文件：{ProjectPaths.ConfigPath}";
    }

    private void SaveConfig()
    {
        _config.PublicUrl = AccessAddress.Normalize(_publicUrl.Text);
        _config.Libraries = ReadLibraries();
        if (_config.Libraries.Count == 0)
        {
            _status.Text = "至少添加一个媒体文件夹。";
            return;
        }
        _config.Save(ProjectPaths.ConfigPath);
        RefreshAccess();
        _status.Text = "设置已保存。服务运行中时请重启服务让改动生效。";
    }

    private void ToggleServer()
    {
        if (_server.IsRunning)
        {
            _server.Stop();
            _serverButton.Text = "启动服务";
            _status.Text = "服务已停止。";
            return;
        }

        SaveConfig();
        _server.Start(Port);
        _serverButton.Text = "停止服务";
        _status.Text = "服务已启动。手机扫码即可访问。";
        RefreshAccess();
    }

    private void AddLibrary(MediaLibrary library)
    {
        var editor = new LibraryEditor(library);
        editor.Width = _libraryList.ClientSize.Width - 26;
        editor.Anchor = AnchorStyles.Left | AnchorStyles.Right | AnchorStyles.Top;
        editor.RemoveRequested += (_, _) => _libraryList.Controls.Remove(editor);
        _libraryList.Controls.Add(editor);
    }

    private List<MediaLibrary> ReadLibraries()
    {
        return _libraryList.Controls
            .OfType<LibraryEditor>()
            .Select((editor, index) => editor.ToLibrary(index))
            .Where(library => !string.IsNullOrWhiteSpace(library.Path))
            .ToList();
    }

    private void RefreshAccess()
    {
        var tempConfig = new AppConfig { PublicUrl = AccessAddress.Normalize(_publicUrl.Text) };
        var url = AccessAddress.GetPrimaryUrl(tempConfig, Port);
        _accessUrl.Text = url;
        var qrSource = $"http://127.0.0.1:{Port}/api/qr?text={Uri.EscapeDataString(url)}";
        _qrBrowser.DocumentText = $"""
            <!doctype html>
            <html>
              <body style="margin:0;display:grid;place-items:center;height:100vh;background:#f3f6fb;">
                <img src="{qrSource}" style="width:286px;height:286px;" alt="QR" />
              </body>
            </html>
            """;
    }

    private static Panel Panel() => new()
    {
        Dock = DockStyle.Fill,
        Padding = new Padding(22),
        Margin = new Padding(0, 0, 16, 0),
        BackColor = Color.FromArgb(23, 27, 35)
    };

    private static Control Header(string title, string subtitle)
    {
        var panel = new FlowLayoutPanel { FlowDirection = FlowDirection.TopDown, AutoSize = true, Dock = DockStyle.Top };
        panel.Controls.Add(new Label
        {
            Text = title,
            ForeColor = Color.White,
            Font = new Font("Microsoft YaHei UI", 20F, FontStyle.Bold),
            AutoSize = true
        });
        panel.Controls.Add(new Label
        {
            Text = subtitle,
            ForeColor = Color.FromArgb(161, 172, 188),
            AutoSize = true,
            MaximumSize = new Size(620, 0),
            Margin = new Padding(0, 8, 0, 0)
        });
        return panel;
    }

    private static Button Button(string text) => new()
    {
        Text = text,
        Height = 38,
        Width = 120,
        Margin = new Padding(0, 0, 10, 0),
        BackColor = Color.FromArgb(48, 58, 74),
        ForeColor = Color.White,
        FlatStyle = FlatStyle.Flat
    };
}
