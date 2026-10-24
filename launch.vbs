Set oShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
oShell.CurrentDirectory = scriptDir

' 1. Locate Python independently of the environment used to launch this script.
Dim pythonExe, pythonArgs, windowsDir, pythonDirs, pythonDir, pathDirs, pathDir, pathCandidate
pythonExe = ""
pythonArgs = ""
windowsDir = oShell.ExpandEnvironmentStrings("%SystemRoot%")

If fso.FileExists(windowsDir & "\pyw.exe") Then
    pythonExe = windowsDir & "\pyw.exe"
    pythonArgs = "-3 "
Else
    pythonDirs = Array( _
        "C:\Python313", _
        "C:\Python312", _
        "C:\Python311", _
        oShell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Programs\Python\Python313", _
        oShell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Programs\Python\Python312", _
        oShell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Programs\Python\Python311" _
    )

    For Each pythonDir In pythonDirs
        If fso.FileExists(pythonDir & "\pythonw.exe") Then
            pythonExe = pythonDir & "\pythonw.exe"
            Exit For
        End If
    Next

    If pythonExe = "" Then
        pathDirs = Split(oShell.ExpandEnvironmentStrings("%PATH%"), ";")
        For Each pathDir In pathDirs
            pathCandidate = Replace(pathDir, """", "")
            If pathCandidate <> "" And fso.FileExists(pathCandidate & "\pythonw.exe") Then
                pythonExe = pathCandidate & "\pythonw.exe"
                Exit For
            End If
        Next
    End If
End If

If pythonExe = "" Then
    MsgBox "Python 3 was not found, so IV TV cannot start." & vbCrLf & _
           "Install Python 3 for Windows, then run launch.bat again.", vbCritical, "IV TV Error"
    WScript.Quit 1
End If

' 2. Ultra-fast native HTTP check (under 15ms) to determine if server is active
Function IsServerRunning()
    IsServerRunning = False
    On Error Resume Next
    Dim xmlHttp
    Set xmlHttp = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    xmlHttp.open "GET", "http://127.0.0.1:5173/index.html", False
    xmlHttp.setTimeouts 400, 400, 400, 400
    xmlHttp.send
    If Err.Number = 0 Then
        If xmlHttp.status = 200 Or xmlHttp.status = 304 Then
            IsServerRunning = True
        End If
    End If
    Set xmlHttp = Nothing
    Err.Clear
    On Error GoTo 0
End Function

If Not IsServerRunning() Then
    ' Start server in background without flashing any command prompt window
    Dim cmd
    cmd = """" & pythonExe & """ " & pythonArgs & """" & scriptDir & "\server.py"""
    oShell.Run cmd, 0, False

    ' Allow time for Python to start and initialize the server.
    Dim attempts, ready
    attempts = 0
    ready = False
    Do While attempts < 30 And Not ready
        WScript.Sleep 500
        attempts = attempts + 1
        If IsServerRunning() Then
            ready = True
            Exit Do
        End If
    Loop

    If Not ready Then
        MsgBox "Failed to start IV TV server on http://localhost:5173." & vbCrLf & _
               "Python was found at:" & vbCrLf & pythonExe & vbCrLf & vbCrLf & _
               "Check server.log in the IV - TV folder for startup errors.", vbCritical, "IV TV Error"
        WScript.Quit 1
    End If
End If

' 3. Detect Chrome or Edge for standalone desktop app window
Dim chromePath, edgePath, browserExe, browserArgs, browserLaunched
browserLaunched = False

chromePath = ""
If fso.FileExists("C:\Program Files\Google\Chrome\Application\chrome.exe") Then
    chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
ElseIf fso.FileExists("C:\Program Files (x86)\Google\Chrome\Application\chrome.exe") Then
    chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
ElseIf fso.FileExists(oShell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Google\Chrome\Application\chrome.exe") Then
    chromePath = oShell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Google\Chrome\Application\chrome.exe"
End If

edgePath = ""
If fso.FileExists("C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe") Then
    edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
ElseIf fso.FileExists("C:\Program Files\Microsoft\Edge\Application\msedge.exe") Then
    edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
End If

' By default, launch as standalone desktop app window unless /browser is specified
Dim useBrowserOnly
useBrowserOnly = False
If WScript.Arguments.Count > 0 Then
    If LCase(WScript.Arguments(0)) = "/browser" Or LCase(WScript.Arguments(0)) = "--browser" Then
        useBrowserOnly = True
    End If
End If

If Not useBrowserOnly Then
    If chromePath <> "" Then
        browserExe = chromePath
    ElseIf edgePath <> "" Then
        browserExe = edgePath
    End If

    If browserExe <> "" Then
        browserArgs = "--app=http://127.0.0.1:5173/?v=70 --start-maximized --autoplay-policy=no-user-gesture-required --disable-features=Translate"
        oShell.Run """" & browserExe & """ " & browserArgs, 1, False
        browserLaunched = True
    End If
End If

If Not browserLaunched Then
    oShell.Run "http://127.0.0.1:5173/?v=70"
End If
