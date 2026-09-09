using System;
using System.IO;
using System.Threading;
using System.Windows;

namespace Ayaki.Installer {
  internal static class Program {
    [STAThread]
    public static int Main(string[] args) {
      try { Console.OutputEncoding = new System.Text.UTF8Encoding(false); } catch { }
      InstallOptions options = InstallOptions.Parse(args);
      try {
        if (options.SelfTest) return SelfTest();
        if (options.Silent && !options.Preview) return InstallEngine.Run(options, null, CancellationToken.None).GetAwaiter().GetResult();
        var app = new Application();
        var window = new InstallerWindow(options);
        if (!String.IsNullOrEmpty(options.Capture)) { window.Capture(options.Capture, options.Dpi); return 0; }
        app.Run(window.View);
        return window.ExitCode;
      } catch (Exception ex) {
        if (!options.Silent && !options.SelfTest && String.IsNullOrEmpty(options.Capture)) MessageBox.Show(ex.Message, "绘遇", MessageBoxButton.OK, MessageBoxImage.Information);
        Console.Error.WriteLine(ex.ToString());
        return 1;
      }
    }
    private static int SelfTest() {
      string valid = InstallEngine.NormalizeDirectory(@"D:\Games\绘遇\");
      if (valid != @"D:\Games\绘遇") throw new Exception("Unicode path normalization failed");
      foreach (string invalid in new [] { "", "relative\\path", @"C:\", Environment.GetFolderPath(Environment.SpecialFolder.Windows), @"C:\test?invalid" }) {
        bool rejected = false;
        try { InstallEngine.NormalizeDirectory(invalid); } catch (ArgumentException) { rejected = true; }
        if (!rejected) throw new Exception("Unsafe install path accepted: " + invalid);
      }
      var silent = InstallOptions.Parse(new [] { "/S", "/UPDATE", @"/D=C:\Program", @"Files\Atelier" });
      if (!silent.Silent || !silent.Update || silent.Directory != @"C:\Program Files\Atelier") throw new Exception("Silent arguments were not preserved");
      var preview = InstallOptions.Parse(new [] { "--capture=test.png" });
      if (!preview.Preview) throw new Exception("Capture must stay non-installing");
      bool blocked = false;
      try { InstallEngine.Run(new InstallOptions { Preview = true }, null, CancellationToken.None).GetAwaiter().GetResult(); }
      catch (InvalidOperationException) { blocked = true; }
      if (!blocked) throw new Exception("Preview installation guard failed");
      if (!PayloadInfo.PreviewBuild) InstallEngine.VerifyPayload();
      var app = new Application();
      var window = new InstallerWindow(new InstallOptions { Preview = true });
      window.ValidateView();
      app.Shutdown();
      Console.WriteLine("Installer self-test passed: paths, arguments, preview isolation, payload integrity");
      return 0;
    }
  }
}
