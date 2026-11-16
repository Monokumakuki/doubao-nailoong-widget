using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using System.Collections.Generic;

internal static class FollowFixture {
 [StructLayout(LayoutKind.Sequential)] struct Rect {public int Left,Top,Right,Bottom;}
 delegate IntPtr WndProc(IntPtr w,uint m,IntPtr wp,IntPtr lp);
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct WindowClass {public uint style;public WndProc proc;public int clsExtra,wndExtra;public IntPtr instance,icon,cursor,background;public string menu,name;}
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern ushort RegisterClass(ref WindowClass c);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr CreateWindowEx(uint ex,string cls,string title,uint style,int x,int y,int width,int height,IntPtr parent,IntPtr menu,IntPtr instance,IntPtr data);
 [DllImport("user32.dll")] static extern IntPtr DefWindowProc(IntPtr w,uint m,IntPtr wp,IntPtr lp);
 [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr w,IntPtr after,int x,int y,int width,int height,uint flags);
 [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr w,out Rect r);
 [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr w,int command);
 [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
 [DllImport("user32.dll")] static extern void NotifyWinEvent(uint ev,IntPtr w,int obj,int child);
 [DllImport("winmm.dll")] static extern uint timeBeginPeriod(uint period);
 [DllImport("winmm.dll")] static extern uint timeEndPeriod(uint period);
 static WndProc proc=DefWindowProc;
 static int Error(IntPtr host,IntPtr widget,int ox,int oy){Rect h,w;GetWindowRect(host,out h);GetWindowRect(widget,out w);return Math.Max(Math.Abs(w.Left-h.Left-ox),Math.Abs(w.Top-h.Top-oy));}
 [STAThread] static void Main(string[] args){
  SetProcessDpiAwarenessContext(new IntPtr(-4));
  var wc=new WindowClass{name="Chrome_WidgetWin_1",proc=proc};RegisterClass(ref wc);
  var host=CreateWindowEx(0x08000000,wc.name,"Isolated follow test",0x10CF0000,60,60,1000,800,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero);
  var widget=CreateWindowEx(0x08000000,wc.name,"Isolated pet",0x90000000,700,500,160,180,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero);
  if(host==IntPtr.Zero||widget==IntPtr.Zero)throw new Exception("Fixture window creation failed");
  ShowWindow(host,4);ShowWindow(widget,4);
  new Thread(delegate(){
   Process helper=null;timeBeginPeriod(1);
   try {
    helper=Process.Start(new ProcessStartInfo(args[0],Process.GetCurrentProcess().Id+" "+widget.ToInt64()){UseShellExecute=false,CreateNoWindow=true,RedirectStandardInput=true,RedirectStandardOutput=true});
    string lastReport="";helper.OutputDataReceived+=delegate(object sender,DataReceivedEventArgs ev){if(ev.Data!=null)lastReport=ev.Data;};
    helper.BeginOutputReadLine();Thread.Sleep(500);
    Rect h,w;GetWindowRect(host,out h);GetWindowRect(widget,out w);int ox=w.Left-h.Left,oy=w.Top-h.Top;
    var samples=new List<double>();int max=0;
    NotifyWinEvent(10,host,0,0);
    for(int i=0;i<180;i++){
     int offset=i<90?i:179-i;
     var elapsed=Stopwatch.StartNew();
     SetWindowPos(host,IntPtr.Zero,h.Left+offset*5,h.Top+offset*2,0,0,0x0215);
     int error;while((error=Error(host,widget,ox,oy))>1&&elapsed.ElapsedMilliseconds<40)Thread.Sleep(1);
     max=Math.Max(max,error);samples.Add(elapsed.Elapsed.TotalMilliseconds);
     int remaining=8-(int)elapsed.ElapsedMilliseconds;if(remaining>0)Thread.Sleep(remaining);
    }
    NotifyWinEvent(11,host,0,0);Thread.Sleep(150);
    int settled=Error(host,widget,ox,oy);
    // A user's separate pet drag establishes a new offset, not an old anchor.
    GetWindowRect(widget,out w);SetWindowPos(widget,IntPtr.Zero,w.Left-45,w.Top-30,0,0,0x0215);ox-=45;oy-=30;
    Thread.Sleep(100);SetWindowPos(host,IntPtr.Zero,h.Left+30,h.Top+20,0,0,0x0215);Thread.Sleep(50);
    int draggedOffset=Error(host,widget,ox,oy);
    samples.Sort();
    Console.WriteLine("{\"steps\":180,\"cadenceMs\":8,\"medianMs\":"+samples[90].ToString("F3",System.Globalization.CultureInfo.InvariantCulture)+",\"p95Ms\":"+samples[171].ToString("F3",System.Globalization.CultureInfo.InvariantCulture)+",\"maxMs\":"+samples[179].ToString("F3",System.Globalization.CultureInfo.InvariantCulture)+",\"maxResidualPx\":"+max+",\"settledPx\":"+settled+",\"petDragOffsetErrorPx\":"+draggedOffset+"}");
    if(max>1||settled>1||draggedOffset>1){Console.Error.WriteLine(lastReport);Environment.ExitCode=1;}
   }catch(Exception e){Console.Error.WriteLine(e);Environment.ExitCode=1;}
   finally{if(helper!=null){helper.StandardInput.WriteLine();if(!helper.WaitForExit(1000))helper.Kill();helper.Dispose();}timeEndPeriod(1);Application.Exit();}
  }){IsBackground=true}.Start();
  Application.Run();GC.KeepAlive(proc);
 }
}
