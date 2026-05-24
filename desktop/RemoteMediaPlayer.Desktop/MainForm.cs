using QRCoder;

namespace RemoteMediaPlayer.Desktop;

internal sealed class MainForm : Form
{
    private const int Port = 5178;
    private const int StackedLayoutBreakpoint = 1180;
    private readonly FlowLayoutPanel _libraryList = new();
    private readonly TextBox _publicUrl = new();
    private readonly Label _status = new();
    private readonly Label _accessUrl = new();
    private readonly ComboBox _accessChoices = new();
    private readonly PictureBox _qrImage = new();
    private readonly RoundedButton _serverButton = new();
    private readonly Panel _scrollHost = new();
    private TableLayoutPanel? _shell;
    private Control? _configPanel;
    private Control? _accessPanel;
    private bool _stackedLayout;
    private readonly ServerProcess _server = new();
    private AppConfig _config = AppConfig.Default();

    public MainForm()
    {
        Text = "Remote Media";
        MinimumSize = new Size(760, 620);
        BackColor = Theme.Background;
        ForeColor = Theme.Text;
        Font = new Font("Microsoft YaHei UI", 9F);
        BuildUi();
        LoadConfig();
        Resize += (_, _) => ApplyResponsiveLayout();
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        _qrImage.Image?.Dispose();
        _server.Dispose();
        base.OnFormClosing(e);
    }

    private void BuildUi()
    {
        _shell = new TableLayoutPanel
        {
            Padding = new Padding(18),
            ColumnCount = 2,
            BackColor = Theme.Background
        };
        _scrollHost.Dock = DockStyle.Fill;
        _scrollHost.AutoScroll = true;
        _scrollHost.BackColor = Theme.Background;
        _configPanel = BuildConfigPanel();
        _accessPanel = BuildAccessPanel();
        _scrollHost.Controls.Add(_shell);
        Controls.Add(_scrollHost);
        ApplyResponsiveLayout();
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
        publicRow.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 174));
        StyleTextBox(_publicUrl, "公网访问地址（可选）/ Public URL (optional), e.g. https://media.example.com");
        publicRow.Controls.Add(_publicUrl, 0, 0);

        var applyUrl = SecondaryButton("更新地址 / Update", 164);
        applyUrl.Click += (_, _) => RefreshAccessChoices();
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
        var add = SecondaryButton("添加文件夹 / Add", 150);
        add.Click += (_, _) => AddLibrary(new MediaLibrary());
        var save = SecondaryButton("保存设置 / Save", 150);
        save.Click += (_, _) => SaveConfig();
        StylePrimaryButton(_serverButton, "启动服务 / Start", 150);
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
        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, RowCount = 7, BackColor = Theme.Surface };
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 312));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 28));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 42));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 44));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 50));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));

        layout.Controls.Add(Header(
            "手机访问 / Phone Access",
            "启动服务后，如果默认地址打不开，请在下面切换到能访问的 IP。\nStart the service. If the default URL fails, choose another IP below."), 0, 0);

        var qrFrame = new RoundedPanel
        {
            Dock = DockStyle.Fill,
            BackColor = Color.FromArgb(243, 246, 251),
            Padding = new Padding(16),
            Margin = new Padding(0, 18, 0, 12),
            Radius = 10
        };
        _qrImage.Dock = DockStyle.Fill;
        _qrImage.SizeMode = PictureBoxSizeMode.Zoom;
        _qrImage.BackColor = Color.FromArgb(243, 246, 251);
        qrFrame.Controls.Add(_qrImage);
        layout.Controls.Add(qrFrame, 0, 1);

        layout.Controls.Add(SmallLabel("访问地址 / Access URL"), 0, 2);

        _accessChoices.Dock = DockStyle.Fill;
        _accessChoices.DropDownStyle = ComboBoxStyle.DropDownList;
        _accessChoices.BackColor = Theme.Input;
        _accessChoices.ForeColor = Theme.Text;
        _accessChoices.SelectedIndexChanged += (_, _) => UseSelectedAccessUrl();
        layout.Controls.Add(_accessChoices, 0, 3);

        _accessUrl.Dock = DockStyle.Fill;
        _accessUrl.ForeColor = Theme.Accent;
        _accessUrl.Font = new Font(Font.FontFamily, 12F, FontStyle.Bold);
        _accessUrl.AutoEllipsis = true;
        layout.Controls.Add(_accessUrl, 0, 4);

        var accessActions = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            FlowDirection = FlowDirection.LeftToRight,
            BackColor = Theme.Surface
        };
        var copy = SecondaryButton("复制访问地址 / Copy URL", 200);
        copy.Click += (_, _) =>
        {
            if (!string.IsNullOrWhiteSpace(_accessUrl.Text)) Clipboard.SetText(_accessUrl.Text);
            _status.Text = "访问地址已复制 / URL copied.";
        };
        var testLocal = SecondaryButton("测试本机服务 / Test Local", 190);
        testLocal.Click += async (_, _) => await TestLocalServiceAsync();
        accessActions.Controls.Add(copy);
        accessActions.Controls.Add(testLocal);
        layout.Controls.Add(accessActions, 0, 5);

        var hint = new Label
        {
            Text = "提示：二维码会使用上方选中的地址。手机打不开时，逐个切换地址再扫码。\nTip: the QR code uses the selected URL. If it fails, try the next address.",
            ForeColor = Theme.Muted,
            Dock = DockStyle.Top,
            AutoSize = false,
            Height = 76
        };
        layout.Controls.Add(hint, 0, 6);

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
        RefreshAccessChoices();
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
        RefreshAccessChoices();
        _status.Text = "设置已保存。服务运行中时请重启服务让改动生效 / Saved. Restart the service to apply changes.";
    }

    private async void ToggleServer()
    {
        if (_server.IsRunning)
        {
            _server.Stop();
            StylePrimaryButton(_serverButton, "启动服务 / Start", 150);
            _status.Text = "服务已停止 / Service stopped.";
            return;
        }

        try
        {
            SaveConfig();
            _serverButton.Enabled = false;
            _status.Text = "正在启动服务... / Starting service...";
            _server.Start(Port);
            var healthy = await _server.WaitUntilHealthyAsync(Port, TimeSpan.FromSeconds(8));
            if (!healthy)
            {
                _server.Stop();
                StylePrimaryButton(_serverButton, "启动服务 / Start", 150);
                _status.Text = $"服务启动失败 / Service failed to start: {_server.LastLog}".Trim();
                return;
            }

            _serverButton.Text = "停止服务 / Stop";
            _status.Text = "服务已启动。手机扫码即可访问 / Service started. Scan the QR code on your phone.";
            RefreshAccessChoices();
        }
        catch (Exception error)
        {
            _status.Text = $"服务启动失败 / Service failed to start: {error.Message}";
        }
        finally
        {
            _serverButton.Enabled = true;
        }
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
        var width = Math.Max(540, _libraryList.ClientSize.Width - SystemInformation.VerticalScrollBarWidth - 6);
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

    private void RefreshAccessChoices()
    {
        var current = _accessChoices.SelectedItem?.ToString();
        var tempConfig = new AppConfig { PublicUrl = AccessAddress.Normalize(_publicUrl.Text) };
        var urls = AccessAddress.GetAccessUrls(tempConfig, Port);
        _accessChoices.Items.Clear();
        foreach (var url in urls)
        {
            _accessChoices.Items.Add(url);
        }

        var selected = urls.Contains(current) ? current : urls.FirstOrDefault();
        if (selected != null)
        {
            _accessChoices.SelectedItem = selected;
        }
        else
        {
            UseAccessUrl($"http://127.0.0.1:{Port}");
        }
    }

    private void UseSelectedAccessUrl()
    {
        var selected = _accessChoices.SelectedItem?.ToString();
        if (!string.IsNullOrWhiteSpace(selected)) UseAccessUrl(selected);
    }

    private void UseAccessUrl(string url)
    {
        _accessUrl.Text = url;
        RenderQr(url);
    }

    private async Task TestLocalServiceAsync()
    {
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
            var response = await client.GetAsync($"http://127.0.0.1:{Port}/api/health");
            _status.Text = response.IsSuccessStatusCode
                ? "本机服务可访问 / Local service is reachable."
                : $"本机服务响应异常 / Local service returned {(int)response.StatusCode}.";
        }
        catch (Exception error)
        {
            _status.Text = $"本机服务不可访问 / Local service is not reachable: {error.Message}";
        }
    }

    private void ApplyResponsiveLayout()
    {
        if (_shell is null || _configPanel is null || _accessPanel is null) return;
        var shouldStack = ClientSize.Width < StackedLayoutBreakpoint;
        if (shouldStack == _stackedLayout && _shell.Controls.Count > 0) return;
        _stackedLayout = shouldStack;
        _shell.SuspendLayout();
        _shell.Controls.Clear();
        _shell.ColumnStyles.Clear();
        _shell.RowStyles.Clear();

        if (shouldStack)
        {
            _shell.Dock = DockStyle.Top;
            _shell.Height = 1120;
            _shell.ColumnCount = 1;
            _shell.RowCount = 2;
            _shell.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            _shell.RowStyles.Add(new RowStyle(SizeType.Absolute, 430));
            _shell.RowStyles.Add(new RowStyle(SizeType.Absolute, 654));
            _configPanel.Margin = new Padding(0, 0, 0, 16);
            _accessPanel.Margin = new Padding(0);
            _shell.Controls.Add(_configPanel, 0, 0);
            _shell.Controls.Add(_accessPanel, 0, 1);
        }
        else
        {
            _shell.Dock = DockStyle.Fill;
            _shell.ColumnCount = 2;
            _shell.RowCount = 1;
            _shell.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 65));
            _shell.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 35));
            _shell.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            _configPanel.Margin = new Padding(0, 0, 16, 0);
            _accessPanel.Margin = new Padding(0);
            _shell.Controls.Add(_configPanel, 0, 0);
            _shell.Controls.Add(_accessPanel, 1, 0);
        }

        _shell.ResumeLayout();
        ResizeLibraryEditors();
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
            Font = new Font("Microsoft YaHei UI", 20F, FontStyle.Bold),
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

    private static Label SmallLabel(string text) => new()
    {
        Text = text,
        ForeColor = Theme.Muted,
        Dock = DockStyle.Fill,
        TextAlign = ContentAlignment.BottomLeft
    };

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
