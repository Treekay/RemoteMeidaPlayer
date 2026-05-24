namespace RemoteMediaPlayer.Desktop;

internal sealed class RoundedButton : Button
{
    public int Radius { get; set; } = 8;

    public RoundedButton()
    {
        FlatStyle = FlatStyle.Flat;
        FlatAppearance.BorderSize = 0;
        Resize += (_, _) => UpdateRegion();
    }

    protected override void OnPaint(PaintEventArgs pevent)
    {
        UpdateRegion();
        base.OnPaint(pevent);
    }

    private void UpdateRegion()
    {
        if (Width <= 0 || Height <= 0) return;
        using var path = DrawingUtils.RoundedRect(new Rectangle(0, 0, Width, Height), Radius);
        Region = new Region(path);
    }
}
