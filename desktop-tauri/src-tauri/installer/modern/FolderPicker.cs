using System;
using System.Runtime.InteropServices;

namespace Ayaki.Installer {
  internal static class FolderPicker {
    public static string Pick(IntPtr owner) {
      IFileOpenDialog dialog = (IFileOpenDialog)new FileOpenDialog();
      IShellItem item = null;
      try {
        Marshal.ThrowExceptionForHR(dialog.SetOptions(0x20 | 0x40 | 0x800 | 0x8));
        dialog.SetTitle("选择绘遇的安装位置");
        dialog.SetOkButtonLabel("选择此文件夹");
        int result = dialog.Show(owner);
        if (result == unchecked((int)0x800704C7)) return null;
        Marshal.ThrowExceptionForHR(result);
        Marshal.ThrowExceptionForHR(dialog.GetResult(out item));
        IntPtr name;
        Marshal.ThrowExceptionForHR(item.GetDisplayName(0x80058000, out name));
        try { return Marshal.PtrToStringUni(name); } finally { Marshal.FreeCoTaskMem(name); }
      } finally {
        if (item != null) Marshal.FinalReleaseComObject(item);
        Marshal.FinalReleaseComObject(dialog);
      }
    }
    [ComImport, Guid("DC1C5A9C-E88A-4DDE-A5A1-60F82A20AEF7")] private class FileOpenDialog { }
    [ComImport, Guid("D57C7288-D4AD-4768-BE02-9D969532D960"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IFileOpenDialog {
      [PreserveSig] int Show(IntPtr owner);
      [PreserveSig] int SetFileTypes(uint count, IntPtr types);
      [PreserveSig] int SetFileTypeIndex(uint index);
      [PreserveSig] int GetFileTypeIndex(out uint index);
      [PreserveSig] int Advise(IntPtr events, out uint cookie);
      [PreserveSig] int Unadvise(uint cookie);
      [PreserveSig] int SetOptions(uint options);
      [PreserveSig] int GetOptions(out uint options);
      [PreserveSig] int SetDefaultFolder(IShellItem item);
      [PreserveSig] int SetFolder(IShellItem item);
      [PreserveSig] int GetFolder(out IShellItem item);
      [PreserveSig] int GetCurrentSelection(out IShellItem item);
      [PreserveSig] int SetFileName([MarshalAs(UnmanagedType.LPWStr)] string name);
      [PreserveSig] int GetFileName(out IntPtr name);
      [PreserveSig] int SetTitle([MarshalAs(UnmanagedType.LPWStr)] string title);
      [PreserveSig] int SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string label);
      [PreserveSig] int SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string label);
      [PreserveSig] int GetResult(out IShellItem item);
      [PreserveSig] int AddPlace(IShellItem item, uint location);
      [PreserveSig] int SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)] string extension);
      [PreserveSig] int Close(int result);
      [PreserveSig] int SetClientGuid(ref Guid guid);
      [PreserveSig] int ClearClientData();
      [PreserveSig] int SetFilter(IntPtr filter);
      [PreserveSig] int GetResults(out IntPtr items);
      [PreserveSig] int GetSelectedItems(out IntPtr items);
    }
    [ComImport, Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IShellItem {
      [PreserveSig] int BindToHandler(IntPtr context, ref Guid handler, ref Guid iid, out IntPtr result);
      [PreserveSig] int GetParent(out IShellItem parent);
      [PreserveSig] int GetDisplayName(uint kind, out IntPtr name);
      [PreserveSig] int GetAttributes(uint mask, out uint attributes);
      [PreserveSig] int Compare(IShellItem other, uint hint, out int order);
    }
  }
}
