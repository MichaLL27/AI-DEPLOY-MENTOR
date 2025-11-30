import * as fs from "fs";
import * as path from "path";
import archiver from "archiver";
import type { Project } from "@shared/schema";

/**
 * Generate a minimal iOS Xcode project with WKWebView wrapper
 * Packages the iOS project as a ZIP file for download
 */
export async function generateIosWrapper(
  project: Project
): Promise<{ status: string; downloadPath: string }> {
  if (!project.deployedUrl) {
    throw new Error("Project must have a deployedUrl to generate iOS wrapper");
  }

  const projectId = project.id.substring(0, 12);
  const sanitizedProjectName = project.name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .substring(0, 20);
  const bundleId = `com.aideploy.${sanitizedProjectName}`;
  const projectName = `AIWrapper`;

  // Create temp directory
  const tmpDir = path.join(process.cwd(), "tmp", "ios-builds", projectId);
  const iosDir = path.join(tmpDir, "ios");
  const projectDir = path.join(iosDir, `${projectName}.xcodeproj`);
  const appDir = path.join(iosDir, projectName);

  // Create directories
  fs.mkdirSync(appDir, { recursive: true });
  fs.mkdirSync(projectDir, { recursive: true });

  // Create AppDelegate.swift
  const appDelegate = `import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
    }

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let sceneConfiguration = UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
        sceneConfiguration.delegateClass = SceneDelegate.self
        return sceneConfiguration
    }
}
`;

  // Create SceneDelegate.swift
  const sceneDelegate = `import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = (scene as? UIWindowScene) else { return }

        let window = UIWindow(windowScene: windowScene)
        let viewController = ViewController()
        let navigationController = UINavigationController(rootViewController: viewController)
        window.rootViewController = navigationController
        self.window = window
        window.makeKeyAndVisible()
    }
}
`;

  // Create ViewController.swift
  const viewController = `import UIKit
import WebKit

class ViewController: UIViewController {
    var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        self.navigationItem.title = "${project.name}"

        let webViewConfig = WKWebViewConfiguration()
        webViewConfig.allowsInlineMediaPlayback = true
        webViewConfig.mediaTypesRequiringUserActionForPlayback = []

        webView = WKWebView(frame: view.bounds, configuration: webViewConfig)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(webView)

        if let url = URL(string: "${project.deployedUrl}") {
            let request = URLRequest(url: url)
            webView.load(request)
        }
    }
}
`;

  // Create Info.plist
  const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDevelopmentRegion</key>
	<string>en</string>
	<key>CFBundleExecutable</key>
	<string>\$(EXECUTABLE_NAME)</string>
	<key>CFBundleIdentifier</key>
	<string>${bundleId}</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>$(PRODUCT_NAME)</string>
	<key>CFBundlePackageType</key>
	<string>APPL</string>
	<key>CFBundleShortVersionString</key>
	<string>1.0</string>
	<key>CFBundleVersion</key>
	<string>1</string>
	<key>LSRequiresIPhoneOS</key>
	<true/>
	<key>UIApplicationSceneManifest</key>
	<dict>
		<key>UIApplicationSupportsMultipleScenes</key>
		<false/>
		<key>UISceneConfigurations</key>
		<dict>
			<key>UIWindowSceneStoryboardSegueActions</key>
			<array/>
			<key>UIWindowSceneSessionRoleApplication</key>
			<array>
				<dict>
					<key>UISceneConfigurationName</key>
					<string>Default Configuration</string>
					<key>UISceneDelegateClassName</key>
					<string>$(PRODUCT_MODULE_NAME).SceneDelegate</string>
				</dict>
			</array>
		</dict>
	</dict>
	<key>UIApplicationSupportsIndirectInputEvents</key>
	<true/>
	<key>UISupportedInterfaceOrientations</key>
	<array>
		<string>UIInterfaceOrientationPortrait</string>
		<string>UIInterfaceOrientationLandscapeLeft</string>
		<string>UIInterfaceOrientationLandscapeRight</string>
	</array>
	<key>NSAppTransportSecurity</key>
	<dict>
		<key>NSAllowsArbitraryLoads</key>
		<true/>
	</dict>
</dict>
</plist>
`;

  // Create project.pbxproj (simplified)
  const pbxproj = `// !$*UTF8*$!
{
	archiveVersion = 1;
	classes = {
	};
	objectVersion = 54;
	objects = {
	};
	rootObject = 00000000000000000000000000000000;
}
`;

  // Create Main.storyboard
  const storyboard = `<?xml version="1.0" encoding="UTF-8"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="21225" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" useSafeAreas="YES" colorLabelStyle="iOS13">
    <device id="retina6_1" orientation="portrait" appearance="light"/>
    <dependencies>
        <deployment identifier="iOS"/>
        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="21207"/>
        <capability name="Safe area layout guides" minToolsVersion="9.0"/>
    </dependencies>
    <scenes>
        <scene sceneID="s0d-6b-0kx">
            <objects>
                <viewController id="01J-lp-oVM" sceneMemberID="viewController">
                    <view key="view" contentMode="scaleToFill" id="Ze5-6b-2t3">
                        <rect key="frame" x="0.0" y="0.0" width="414" height="896"/>
                        <autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"/>
                        <color key="backgroundColor" xcode11CocoaTouchSystemColor="systemBackgroundColor" cocoaTouchSystemColor="whiteColor"/>
                        <viewLayoutGuide key="safeArea" id="Bcu-3y-fbc"/>
                    </view>
                </viewController>
                <placeholder placeholderIdentifier="IBFirstResponder" id="iYj-Kq-Ea1" userLabel="First Responder" sceneMemberID="firstResponder"/>
            </objects>
            <point key="canvasLocation" x="53" y="375"/>
        </scene>
    </scenes>
</document>
`;

  // Create README for iOS project
  const readmeIos = `# ${project.name} - iOS Wrapper

This is an Xcode project that wraps your web application in a WKWebView.

## Setup

1. Open this project in Xcode (requires macOS and Xcode)
2. Update the Bundle Identifier in Xcode to match your Apple Developer account
3. Configure your development team in the project settings
4. Build and run on an iOS device or simulator
5. Configure code signing for app distribution

## Configuration

- The WKWebView loads: ${project.deployedUrl}
- JavaScript is enabled
- Inline media playback is supported

## Building for App Store

1. Select "Generic iOS Device" as the target
2. Product → Archive
3. Distribute App → App Store Connect
4. Upload to App Store Connect/TestFlight

## Requirements

- macOS 12 or later
- Xcode 13 or later
- iOS 13.0+ target

For more information, see Apple's official documentation:
https://developer.apple.com/xcode/
https://developer.apple.com/design/human-interface-guidelines/ios
`;

  // Write all files
  fs.writeFileSync(path.join(appDir, "AppDelegate.swift"), appDelegate);
  fs.writeFileSync(path.join(appDir, "SceneDelegate.swift"), sceneDelegate);
  fs.writeFileSync(path.join(appDir, "ViewController.swift"), viewController);
  fs.writeFileSync(path.join(appDir, "Info.plist"), infoPlist);
  fs.writeFileSync(path.join(projectDir, "project.pbxproj"), pbxproj);
  fs.writeFileSync(path.join(appDir, "Main.storyboard"), storyboard);
  fs.writeFileSync(path.join(iosDir, "README.md"), readmeIos);

  // Create public/mobile-builds directory if it doesn't exist
  const publicMobileDir = path.join(process.cwd(), "public", "mobile-builds");
  fs.mkdirSync(publicMobileDir, { recursive: true });

  // Zip the ios directory
  const zipPath = path.join(publicMobileDir, `ios-project-${projectId}.zip`);

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log(`[iOS] Generated ZIP: ${zipPath} (${archive.pointer()} bytes)`);
      resolve({
        status: "ready",
        downloadPath: `/mobile-builds/ios-project-${projectId}.zip`,
      });
    });

    archive.on("error", (err: Error) => {
      reject(err);
    });

    archive.pipe(output);
    archive.directory(iosDir, "ios");
    archive.finalize();
  });
}
