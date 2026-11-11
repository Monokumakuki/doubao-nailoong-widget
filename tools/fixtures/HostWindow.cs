using System;using System.IO;using System.Windows.Forms;
class HostWindow {
 [STAThread] static void Main(string[] args){
  var form=new Form{Text="Widget test host (no account data)",Width=1800,Height=1100,StartPosition=FormStartPosition.CenterScreen};
  var timer=new Timer{Interval=100};string previous="";
  timer.Tick+=delegate{string cmd=File.Exists(args[0])?File.ReadAllText(args[0]).Trim():"";if(cmd==previous)return;previous=cmd;
   if(cmd=="hide")form.Hide();else if(cmd=="minimize")form.WindowState=FormWindowState.Minimized;
   else if(cmd=="show"){form.WindowState=FormWindowState.Normal;form.Show();form.Activate();}else if(cmd=="exit")form.Close();};
  form.Shown+=delegate{File.WriteAllText(args[0]+".ready",form.Handle.ToInt64().ToString());};timer.Start();Application.Run(form);
 }
}
