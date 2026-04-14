PopShield Windows installer

What this is:
- An Inno Setup project that builds a Windows `.exe` installer for testing PopShield on a PC.
- The installer copies the extension into `%LocalAppData%\PopShield\Extension`.
- After install, it can open the guide, the installed extension folder, and Chrome/Edge's extensions page.

What it does not do:
- It does not auto-install the extension into Chrome or Edge.
- The final "Load unpacked" step still has to be done manually in the browser.

Build on Windows:
1. Install Inno Setup 6.
2. Open `installer\windows\PopShield.iss`.
3. Click Build.
4. The installer `.exe` will be written to `installer\windows\dist\`.

Test flow on Windows:
1. Run the generated installer.
2. Let it open the install helper after setup finishes.
3. In Chrome or Edge, open the extensions page.
4. Turn on Developer mode.
5. Click "Load unpacked".
6. Select the installed `Extension` folder that the installer opens.

Installed paths:
- App root: `%LocalAppData%\PopShield`
- Extension folder: `%LocalAppData%\PopShield\Extension`
- Helper files: `%LocalAppData%\PopShield\support`

Notes:
- This installer is for direct testing and sideloading.
- For public release, the smoother path is still Chrome Web Store / Edge Add-ons distribution.
