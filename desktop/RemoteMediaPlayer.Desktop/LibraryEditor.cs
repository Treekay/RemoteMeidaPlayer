namespace RemoteMediaPlayer.Desktop;

internal sealed class LibraryEditor : RoundedPanel
{
    private readonly TextBox _name = new();
    private readonly TextBox _path = new();
    private readonly TextBox _password = new();
    private readonly CheckBox _locked = new();

    public event EventHandler? RemoveRequested;

    public LibraryEditor(MediaLibrary library)
    {
        LibraryId = string.IsNullOrWhiteSpace(library.Id) ? $"library-{Guid.NewGuid():N}" : library.Id;
        Radius = 10;
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
        Height = 148;
        Margin = new Padding(0, 0, 0, 14);
        Padding = new Padding(16);
        BackColor = Theme.SurfaceAlt;

        var root = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 4,
            RowCount = 4,
            BackColor = Theme.SurfaceAlt
        };
        root.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 33));
        root.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 67));
        root.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 104));
        root.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 96));
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, 24));
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, 38));
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, 12));
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, 40));

        root.Controls.Add(Label("显示名称 / Display name"), 0, 0);
        root.Controls.Add(Label("文件夹 / Folder"), 1, 0);

        var choose = SecondaryButton("选择 / Pick");
        choose.Click += (_, _) => ChooseFolder();
        var remove = SecondaryButton("删除 / Delete");
        remove.Click += (_, _) => RemoveRequested?.Invoke(this, EventArgs.Empty);

        StyleTextBox(_name, "例如：客厅音乐 / e.g. Living Room Music");
        StyleTextBox(_path, "选择或粘贴文件夹路径 / Pick or paste a folder path");
        StyleTextBox(_password, "访问密码 / Password");
        _password.UseSystemPasswordChar = true;

        root.Controls.Add(_name, 0, 1);
        root.Controls.Add(_path, 1, 1);
        root.Controls.Add(choose, 2, 1);
        root.Controls.Add(remove, 3, 1);

        _locked.Text = "需要密码才能打开 / Require password";
        _locked.ForeColor = Theme.Text;
        _locked.AutoSize = true;
        _locked.Margin = new Padding(0, 8, 0, 0);
        _locked.CheckedChanged += (_, _) => _password.Visible = _locked.Checked;
        root.Controls.Add(_locked, 0, 3);
        root.SetColumnSpan(_locked, 2);

        root.Controls.Add(_password, 2, 3);
        root.SetColumnSpan(_password, 2);

        Controls.Add(root);
    }

    private void ChooseFolder()
    {
        using var dialog = new FolderBrowserDialog
        {
            Description = "选择要在手机上播放的媒体文件夹 / Choose a media folder for phone playback",
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
        return $"媒体库 {index + 1} / Library {index + 1}";
    }

    private static Label Label(string text) => new()
    {
        Text = text,
        ForeColor = Theme.Muted,
        AutoSize = true,
        Margin = new Padding(0, 0, 0, 4)
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

    private static RoundedButton SecondaryButton(string text) => new()
    {
        Text = text,
        Dock = DockStyle.Fill,
        BackColor = Theme.SurfaceStrong,
        ForeColor = Theme.Text,
        Margin = new Padding(0, 0, 8, 0),
        Radius = 8
    };
}
