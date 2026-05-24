using QRCoder;

namespace RemoteMediaPlayer.Desktop;

internal sealed class MainForm : Form
{
    private const int Port = 5178;
    private readonly FlowLayoutPanel _libraryList = new();
    private readonly TextBox _publicUrl = new();
    private readonly Label _status = new();
    private readonly Label _accessUrl = new();
    private readonly PictureBox _qrImage = new();
    private readonly RoundedButton _serverButton = new();
    private readonly ServerProcess _server = new();
    private AppConfig _config = AppConfig.Default();

    public MainForm()
    {
        Text = "Remote Media";
        MinimumSize = new Size(1180, 760);
        BackColor = Theme.Background;
        ForeColor = Theme.Text;
        Font = new Font("Microsoft YaHei UI", 9F);
        BuildUi();
        LoadConfig();
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        _qrImage.Image?.Dispose();
        _server.Dispose();
        base.OnFormClosing(e);
    }

    private void BuildUi()
    {
        var shell = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            Padding = new Padding(18),
            ColumnCount = 2,
            BackColor = Theme.Background
        };
        shell.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 65));
        shell.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 35));
        shell.Controls.Add(BuildConfigPanel(), 0, 0);
        shell.Controls.Add(BuildAccessPanel(), 1, 0);
        Controls.Add(shell);
    }

    private Control BuildConfigPanel()
    {
        var panel = CardPanel();
        panel.Margin = new Padding(0, 0, 16, 0);

        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, RowCount = 5, BackColor = Theme.Surface };
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 58));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 56));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 36));

        layout.Controls.Add(Header(
            "电脑端设置 / Desktop Setup",
            "选择要共享的媒体文件夹。手机端只会看到显示名称，不会看到电脑里的真实路径。\nChoose folders to share. Phones only see display names, never local paths."), 0, 0);

        var publicRow = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, BackColor = Theme.Surface, Margin = new Padding(0, 14, 0, 8) };
        publicRow.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        publicRow.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 164));
        StyleTextBox(_publicUrl, "公网访问地址（可选）/ Public URL (optional), e.g. https://media.example.com");
        publicRow.Controls.Add(_publicUrl, 0, 0);

        var applyUrl = SecondaryButton("更新二维码 / Update QR", 154);
        applyUrl.Click += (_, _) => RefreshAccess();
        publicRow.Controls.Add(applyUrl, 1, 0);
        layout.Controls.Add(publicRow, 0, 1);

        _libraryList.Dock = DockStyle.Fill;
        _libraryList.FlowDirection = FlowDirection.TopDown;
        _libraryList.WrapContents = false;
        _libraryList.AutoScroll = true;
        _libraryList.BackColor = Theme.Surface;
        _libraryList.Resize += (_, _) => ResizeLibraryEditors();
        layout.Controls.Add(_libraryList, 0, 2);

        var actions = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            FlowDirection = FlowDirection.LeftToRight,
            BackColor = Theme.Surface,
            Padding = new Padding(0, 12, 0, 0)
        };
        var add = SecondaryButton("添加文件夹 / Add", 148);
        add.Click += (_, _) => AddLibrary(new MediaLibrary());
        var save = SecondaryButton("保存设置 / Save", 148);
        save.Click += (_, _) => SaveConfig();
        StylePrimaryButton(_serverButton, "启动服务 / Start", 148);
        _serverButton.Click += (_, _) => ToggleServer();
        actions.Controls.Add(add);
        actions.Controls.Add(save);
        actions.Controls.Add(_serverButton);
        layout.Controls.Add(actions, 0, 3);

        _status.ForeColor = Theme.Muted;
        _status.AutoEllipsis = true;
        _status.Dock = DockStyle.Fill;
        layout.Controls.Add(_status, 0, 4);

        panel.Controls.Add(layout);
        return panel;
    }

    private Control BuildAccessPanel()
    {
        var panel = CardPanel();
        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, RowCount = 5, BackColor = Theme.Surface };
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 318));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 50));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));

        layout.Controls.Add(Header(
            "手机访问 / Phone Access",
            "启动服务后，用手机相机扫描二维码即可打开播放端。\nStart the service, then scan this QR code on your phone."), 0, 0);

        var qrFrame = new RoundedPanel
        {
            Dock = DockStyle.Fill,
            BackColor = Color.FromArgb(243, 246, 251),
            Padding = new Padding(16),
            Margin = new Padding(0, 18, 0, 14),
            Radius = 10
        };
        _qrImage.Dock = DockStyle.Fill;
        _qrImage.SizeMode = PictureBoxSizeMode.Zoom;
        _qrImage.BackColor = Color.FromArgb(243, 246, 251);
        qrFrame.Controls.Add(_qrImage);
        layout.Controls.Add(qrFrame, 0, 1);

        _accessUrl.Dock = DockStyle.Fill;
        _accessUrl.ForeColor = Theme.Accent;
        _accessUrl.Font = new Font(Font.FontFamily, 13F, FontStyle.Bold);
        _accessUrl.AutoEllipsis = true;
        layout.Controls.Add(_accessUrl, 0, 2);

        var copy = SecondaryButton("复制访问地址 / Copy URL", 190);
        copy.Click += (_, _) =>
        {
            if (!string.IsNullOrWhiteSpace(_accessUrl.Text)) Clipboard.SetText(_accessUrl.Text);
            _status.Text = "访问地址已复制 / URL copied.";
        };
        layout.Controls.Add(copy, 0, 3);

        var hint = new Label
        {
            Text = "如果配置了公网访问地址，二维码会使用公网地址；否则使用这台电脑的局域网地址。\nIf a public URL is set, the QR code uses it; otherwise it uses the local network address.",
            ForeColor = Theme.Muted,
            Dock = DockStyle.Top,
            AutoSize = false,
            Height = 76
        };
        layout.Controls.Add(hint, 0, 4);

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
        _status.Text = $"配置文件 / Config: {ProjectPaths.ConfigPath}";
    }

    private void SaveConfig()
    {
        _config.PublicUrl = AccessAddress.Normalize(_publicUrl.Text);
        _config.Libraries = ReadLibraries();
        if (_config.Libraries.Count == 0)
        {
            _status.Text = "至少添加一个媒体文件夹 / Add at least one media folder.";
            return;
        }
        _config.Save(ProjectPaths.ConfigPath);
        RefreshAccess();
        _status.Text = "设置已保存。服务运行中时请重启服务让改动生效 / Saved. Restart the service to apply changes.";
    }

    private void ToggleServer()
    {
        if (_server.IsRunning)
        {
            _server.Stop();
            StylePrimaryButton(_serverButton, "启动服务 / Start", 148);
            _status.Text = "服务已停止 / Service stopped.";
            return;
        }

        SaveConfig();
        _server.Start(Port);
        _serverButton.Text = "停止服务 / Stop";
        _status.Text = "服务已启动。手机扫码即可访问 / Service started. Scan the QR code on your phone.";
        RefreshAccess();
    }

    private void AddLibrary(MediaLibrary library)
    {
        var editor = new LibraryEditor(library);
        editor.RemoveRequested += (_, _) => _libraryList.Controls.Remove(editor);
        _libraryList.Controls.Add(editor);
        ResizeLibraryEditors();
    }

    private void ResizeLibraryEditors()
    {
        var width = Math.Max(520, _libraryList.ClientSize.Width - SystemInformation.VerticalScrollBarWidth - 6);
        foreach (Control editor in _libraryList.Controls)
        {
            editor.Width = width;
        }
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
        RenderQr(url);
    }

    private void RenderQr(string text)
    {
        using var generator = new QRCodeGenerator();
        using var data = generator.CreateQrCode(text, QRCodeGenerator.ECCLevel.M);
        using var qrCode = new QRCode(data);
        var bitmap = qrCode.GetGraphic(12, Color.FromArgb(14, 17, 23), Color.FromArgb(243, 246, 251), drawQuietZones: true);
        var previous = _qrImage.Image;
        _qrImage.Image = bitmap;
        previous?.Dispose();
    }

    private static RoundedPanel CardPanel() => new()
    {
        Dock = DockStyle.Fill,
        Padding = new Padding(28),
        BackColor = Theme.Surface,
        Radius = 12
    };

    private static Control Header(string title, string subtitle)
    {
        var panel = new FlowLayoutPanel { FlowDirection = FlowDirection.TopDown, AutoSize = true, Dock = DockStyle.Top, BackColor = Theme.Surface };
        panel.Controls.Add(new Label
        {
            Text = title,
            ForeColor = Theme.Text,
            Font = new Font("Microsoft YaHei UI", 21F, FontStyle.Bold),
            AutoSize = true
        });
        panel.Controls.Add(new Label
        {
            Text = subtitle,
            ForeColor = Theme.Muted,
            AutoSize = true,
            MaximumSize = new Size(720, 0),
            Margin = new Padding(0, 8, 0, 0)
        });
        return panel;
    }

    private static void StyleTextBox(TextBox textBox, string placeholder)
    {
        textBox.Dock = DockStyle.Fill;
        textBox.PlaceholderText = placeholder;
        textBox.BorderStyle = BorderStyle.FixedSingle;
        textBox.BackColor = Theme.Input;
        textBox.ForeColor = Theme.Text;
        textBox.Margin = new Padding(0, 0, 10, 0);
    }

    private static RoundedButton SecondaryButton(string text, int width = 132) => new()
    {
        Text = text,
        Height = 38,
        Width = width,
        Margin = new Padding(0, 0, 10, 0),
        BackColor = Theme.SurfaceStrong,
        ForeColor = Theme.Text,
        Radius = 8
    };

    private static void StylePrimaryButton(RoundedButton button, string text, int width = 132)
    {
        button.Text = text;
        button.Height = 38;
        button.Width = width;
        button.Margin = new Padding(0, 0, 10, 0);
        button.BackColor = Theme.Accent;
        button.ForeColor = Theme.AccentText;
        button.Radius = 8;
    }
}
