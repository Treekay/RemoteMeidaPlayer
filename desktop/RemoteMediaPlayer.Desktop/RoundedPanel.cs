namespace RemoteMediaPlayer.Desktop;

internal class RoundedPanel : Panel
{
    public int Radius { get; set; } = 12;

    public RoundedPanel()
    {
        DoubleBuffered = true;
        Resize += (_, _) => UpdateRegion();
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        UpdateRegion();
    }

    private void UpdateRegion()
    {
        if (Width <= 0 || Height <= 0) return;
        using var path = DrawingUtils.RoundedRect(new Rectangle(0, 0, Width, Height), Radius);
        Region = new Region(path);
    }
}
