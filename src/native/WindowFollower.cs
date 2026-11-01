using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
// Geometry-only helper: no conversation text, credentials or window titles are read.
internal static class WindowFollower {
 [StructLayout(LayoutKind.Sequential)] struct Rect { public int Left,Top,Right,Bottom; }
 [StructLayout(LayoutKind.Sequential)] struct Point { public int X,Y; }
 [StructLayout(LayoutKind.Sequential)] struct Msg { public IntPtr Hwnd;public uint Id;public UIntPtr WParam;public IntPtr LParam;public uint Time;public Point Point;public uint Private; }
 delegate bool EnumProc(IntPtr w,IntPtr data);
 delegate void WinEvent(IntPtr hook,uint ev,IntPtr w,int obj,int child,uint thread,uint time);
 [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc p,IntPtr d);
 [DllImport("user32.dll")] static extern bool IsWindow(IntPtr w);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr w);
 [DllImport("user32.dll")] static extern bool IsIconic(IntPtr w);
 [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr w,out Rect r);
 [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr w,out Rect r);
 [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr w,ref Point p);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr w,out uint pid);
 [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr w,uint cmd);
 [DllImport("user32.dll",EntryPoint="GetWindowLongPtrW")] static extern IntPtr GetWindowLongPtr(IntPtr w,int index);
 [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr w,int command);
 [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr w,IntPtr after,int x,int y,int width,int height,uint flags);
 [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr c);
 [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
 [DllImport("user32.dll")] static extern IntPtr SetWinEventHook(uint first,uint last,IntPtr module,WinEvent cb,uint pid,uint tid,uint flags);
 [DllImport("user32.dll")] static extern bool UnhookWinEvent(IntPtr h);
 [DllImport("user32.dll")] static extern bool PeekMessage(out Msg m,IntPtr w,uint first,uint last,uint remove);
 static volatile bool stopping;
 static IntPtr host=IntPtr.Zero,widget=IntPtr.Zero;
 static Rect lastClient;
 static bool positioned;
 static bool IsHost(IntPtr w) {
  try {uint pid;Rect r;GetWindowThreadProcessId(w,out pid);
   if(!IsWindow(w)||GetWindow(w,4)!=IntPtr.Zero||!GetClientRect(w,out r)||r.Right<300||r.Bottom<150)return false;
   using(var p=Process.GetProcessById((int)pid))return String.Equals(p.ProcessName,"Doubao",StringComparison.OrdinalIgnoreCase)||String.Equals(p.ProcessName,"DoubaoWork",StringComparison.OrdinalIgnoreCase);
  }catch{return false;}
 }
 static IntPtr FindHost() {
  IntPtr best=IntPtr.Zero;long largest=0;
  EnumWindows(delegate(IntPtr w,IntPtr d){Rect r;if(IsWindowVisible(w)&&IsHost(w)&&GetClientRect(w,out r)){long area=(long)r.Right*r.Bottom;if(area>largest){largest=area;best=w;}}return true;},IntPtr.Zero);return best;
 }
 static bool Client(IntPtr w,out Rect r) {
  var p=new Point();r=new Rect();if(w==IntPtr.Zero||IsIconic(w)||!IsWindowVisible(w)||!GetClientRect(w,out r)||!ClientToScreen(w,ref p))return false;
  r.Right+=p.X;r.Bottom+=p.Y;r.Left=p.X;r.Top=p.Y;return true;
 }
 static string JsonRect(Rect r){return "{\"x\":"+r.Left+",\"y\":"+r.Top+",\"width\":"+(r.Right-r.Left)+",\"height\":"+(r.Bottom-r.Top)+"}";}
 static void Follow() {
  Rect c,w;if(widget==IntPtr.Zero||!Client(host,out c)||!GetWindowRect(widget,out w))return;
  int width=w.Right-w.Left,height=w.Bottom-w.Top;
  if(c.Right-c.Left<width||c.Bottom-c.Top<height)return;
  if(!positioned){
   int x=c.Right-width-6,y=c.Bottom-height-6;
   SetWindowPos(widget,IntPtr.Zero,x,y,0,0,0x0015);lastClient=c;positioned=true;return;
  }
  int dx=c.Left-lastClient.Left,dy=c.Top-lastClient.Top;
  if(dx!=0||dy!=0)SetWindowPos(widget,IntPtr.Zero,w.Left+dx,w.Top+dy,0,0,0x0015);
  lastClient=c;

 }
 static void Main(string[] args) {
  try{if(!SetProcessDpiAwarenessContext(new IntPtr(-4)))SetProcessDPIAware();}catch{SetProcessDPIAware();}
  if(args.Length==1&&args[0]=="--probe"){Rect c;var h=FindHost();Console.WriteLine("{\"hostId\":\""+h.ToInt64()+"\",\"bounds\":"+(Client(h,out c)?JsonRect(c):"null")+"}");return;}
  int parentId;long handle;if(args.Length<2||!Int32.TryParse(args[0],out parentId)||!Int64.TryParse(args[1],out handle))return;
  widget=new IntPtr(handle);
  new Thread(delegate(){try{Console.ReadLine();}catch{}stopping=true;}){IsBackground=true}.Start();
  WinEvent moved=delegate(IntPtr hook,uint ev,IntPtr w,int obj,int child,uint thread,uint time){if(w==host&&obj==0)Follow();};
  IntPtr locationHook=SetWinEventHook(0x800B,0x800B,IntPtr.Zero,moved,0,0,0);
  try{using(var parent=Process.GetProcessById(parentId)){
   host=FindHost();
   string previous=null;var heartbeat=Stopwatch.StartNew();var scan=Stopwatch.StartNew();var layerClock=Stopwatch.StartNew();IntPtr lastForeground=IntPtr.Zero;
   while(!stopping&&!parent.HasExited&&IsWindow(widget)){
    Msg m;while(PeekMessage(out m,IntPtr.Zero,0,0,1)){}
    IntPtr foreground=GetForegroundWindow();
    if((!IsWindow(host)&&scan.ElapsedMilliseconds>1000)||scan.ElapsedMilliseconds>2000){var found=FindHost();if(found!=host){host=found;positioned=false;}scan.Restart();}
    Rect c,w;bool available=Client(host,out c);uint foregroundPid;GetWindowThreadProcessId(foreground,out foregroundPid);
    bool fits=available&&GetWindowRect(widget,out w)&&c.Right-c.Left>=w.Right-w.Left&&c.Bottom-c.Top>=w.Bottom-w.Top;
    uint hostPid=0;if(available)GetWindowThreadProcessId(host,out hostPid);
    bool show=available&&fits;
    bool wantTop=show&&(foregroundPid==hostPid||foreground==widget||foregroundPid==parentId);
    if(available)Follow();
    // Electron must own show/hide so renderer visibility and pointer input stay in sync.
    if(foreground!=lastForeground||layerClock.ElapsedMilliseconds>1000){
     layerClock.Restart();
     if(wantTop)SetWindowPos(widget,new IntPtr(-1),0,0,0,0,0x0013);
     else {SetWindowPos(widget,new IntPtr(-2),0,0,0,0,0x0013);
      if(foreground!=IntPtr.Zero&&foreground!=widget){var after=foreground;while(after!=IntPtr.Zero&&(GetWindowLongPtr(after,-20).ToInt64()&8)!=0)after=GetWindow(after,2);SetWindowPos(widget,after==IntPtr.Zero?new IntPtr(1):after,0,0,0,0,0x0013);}
     }
    }
    lastForeground=foreground;
    bool behind=false;var nextWindow=GetWindow(foreground,2);for(int i=0;nextWindow!=IntPtr.Zero&&i<2000;i++){if(nextWindow==widget){behind=true;break;}nextWindow=GetWindow(nextWindow,2);}
    string message="{\"behindForeground\":"+(behind?"true":"false")+",\"nativeTopmost\":"+((GetWindowLongPtr(widget,-20).ToInt64()&8)!=0?"true":"false")+",\"topmost\":"+(wantTop?"true":"false")+",\"foregroundPid\":"+foregroundPid+",\"parentPid\":"+parentId+",\"fits\":"+(fits?"true":"false")+",\"hostId\":\""+host.ToInt64()+"\",\"available\":"+(available?"true":"false")+",\"visible\":"+(show?"true":"false")+",\"bounds\":"+(available?JsonRect(c):"null")+"}";
    if(message!=previous||heartbeat.ElapsedMilliseconds>1000){Console.WriteLine(message);Console.Out.Flush();previous=message;heartbeat.Restart();}
    Thread.Sleep(16);
   }
  }}catch(Exception e){Console.Error.WriteLine(e.Message);}finally{
   if(locationHook!=IntPtr.Zero)UnhookWinEvent(locationHook);GC.KeepAlive(moved);
   if(IsWindow(widget))SetWindowPos(widget,new IntPtr(-2),0,0,0,0,0x0013);
  }
 }
}
