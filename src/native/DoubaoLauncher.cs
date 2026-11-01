using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;
using System.Xml;

// GUI subsystem: the taskbar bridge never opens a console window.
internal static class DoubaoLauncher {
  static string Quote(string value) {
    var text=new StringBuilder("\"");int slashes=0;
    foreach(char c in value) {
      if(c=='\\'){slashes++;continue;}
      text.Append('\\',c=='"'?slashes*2+1:slashes).Append(c);slashes=0;
    }
    return text.Append('\\',slashes*2).Append('"').ToString();
  }
  static void Launch(string path,string args) {
    Process.Start(new ProcessStartInfo(path,args){WorkingDirectory=Path.GetDirectoryName(path),UseShellExecute=false,CreateNoWindow=true});
  }
  [STAThread] static int Main(string[] args) {
    string folder=AppDomain.CurrentDomain.BaseDirectory;
    using(var mutex=new Mutex(false,"Local\\DaFeiDou.TaskbarLauncher")) {
      if(!mutex.WaitOne(0))return 0;
      try {
        var doc=new XmlDocument();doc.XmlResolver=null;doc.Load(Path.Combine(folder,"launcher.xml"));
        var config=doc.DocumentElement;int port=int.Parse(config.GetAttribute("port"));
        string host=config.GetAttribute("host"),widget=config.GetAttribute("widget");
        if(port<1||port>65535||!Path.IsPathRooted(host)||!File.Exists(host)||!Path.IsPathRooted(widget)||!File.Exists(widget))throw new InvalidOperationException("Invalid launcher configuration");
        var hostArgs=new StringBuilder("--remote-debugging-address=127.0.0.1 --remote-debugging-port="+port);
        foreach(string arg in args)if(!arg.StartsWith("--remote-debugging-",StringComparison.OrdinalIgnoreCase))hostArgs.Append(' ').Append(Quote(arg));
        // The client and widget both enforce their own single-instance behavior.
        Launch(host,hostArgs.ToString());Launch(widget,"");return 0;
      } catch(Exception e) {
        try{File.AppendAllText(Path.Combine(folder,"launcher-errors.log"),DateTime.Now.ToString("s")+" "+e.Message+Environment.NewLine);}catch{}
        return 1;
      } finally{mutex.ReleaseMutex();}
    }
  }
}
