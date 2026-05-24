namespace RemoteMediaPlayer.Desktop;

internal sealed class LibraryEditor : UserControl
{
    private readonly TextBox _name = new();
    private readonly TextBox _path = new();
    private readonly TextBox _password = new();
    private readonly CheckBox _locked = new();

    public event EventHandler? RemoveRequested;

    public LibraryEditor(MediaLibrary library)
    {
        LibraryId = string.IsNullOrWhiteSpace(library.Id) ? $"library-{Guid.NewGuid():N}" : library.Id;
        BuildUi();
        _name.Text = library.Name;
        _path.Text = library.Path;
        _password.Text = library.Password;
        _locked.Checked = !string.IsNullOrWhiteSpace(library.Password) || !string.IsNullOrWhiteSpace(library.PasswordHash);
        _password.Visible = _locked.Checked;
    }

    public string LibraryId { get; }

    public MediaLibrary ToLibrary(int index)
    {
        return new MediaLibrary
        {
            Id = string.IsNullOrWhiteSpace(LibraryId) ? $"library-{index + 1}" : LibraryId,
            Name = string.IsNullOrWhiteSpace(_name.Text) ? FallbackName(index) : _name.Text.Trim(),
            Path = _path.Text.Trim(),
            Password = _locked.Checked ? _password.Text : ""
        };
    }

    private void BuildUi()
    {
        AutoSize = true;
        Dock = DockStyle.Top;
        Padding = new Padding(14);
        Margin = new Padding(0, 0, 0, 12);
        BackColor = Color.FromArgb(24, 29, 39);

        var layout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            AutoSize = true,
            ColumnCount = 3,
            RowCount = 4
        };
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 45));
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 55));
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 86));

        var title = Label("显示名称");
        var pathLabel = Label("文件夹");
        var remove = Button("删除");
        remove.Click += (_, _) => RemoveRequested?.Invoke(this, EventArgs.Empty);

        _name.PlaceholderText = "例如：客厅音乐";
        _path.PlaceholderText = "选择或粘贴文件夹路径";
        _password.PlaceholderText = "访问密码";
        _password.UseSystemPasswordChar = true;
        _locked.Text = "需要密码才能打开";
        _locked.ForeColor = Color.FromArgb(214, 220, 229);
        _locked.AutoSize = true;
        _locked.CheckedChanged += (_, _) => _password.Visible = _locked.Checked;

        var choose = Button("选择");
        choose.Click += (_, _) => ChooseFolder();

        layout.Controls.Add(title, 0, 0);
        layout.Controls.Add(pathLabel, 1, 0);
        layout.Controls.Add(remove, 2, 0);
        layout.Controls.Add(_name, 0, 1);
        layout.Controls.Add(_path, 1, 1);
        layout.Controls.Add(choose, 2, 1);
        layout.Controls.Add(_locked, 0, 2);
        layout.SetColumnSpan(_locked, 3);
        layout.Controls.Add(_password, 0, 3);
        layout.SetColumnSpan(_password, 3);

        Controls.Add(layout);
    }

    private void ChooseFolder()
    {
        using var dialog = new FolderBrowserDialog
        {
            Description = "选择要在手机上播放的媒体文件夹",
            UseDescriptionForTitle = true
        };
        if (dialog.ShowDialog(this) != DialogResult.OK) return;
        _path.Text = dialog.SelectedPath;
        if (string.IsNullOrWhiteSpace(_name.Text))
        {
            _name.Text = new DirectoryInfo(dialog.SelectedPath).Name;
        }
    }

    private string FallbackName(int index)
    {
        if (!string.IsNullOrWhiteSpace(_path.Text)) return new DirectoryInfo(_path.Text).Name;
        return $"媒体库 {index + 1}";
    }

    private static Label Label(string text) => new()
    {
        Text = text,
        ForeColor = Color.FromArgb(161, 172, 188),
        AutoSize = true,
        Margin = new Padding(0, 0, 0, 6)
    };

    private static Button Button(string text) => new()
    {
        Text = text,
        Height = 32,
        Dock = DockStyle.Fill,
        BackColor = Color.FromArgb(48, 58, 74),
        ForeColor = Color.White,
        FlatStyle = FlatStyle.Flat
    };
}
