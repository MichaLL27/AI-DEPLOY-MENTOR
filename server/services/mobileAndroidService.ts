import * as fs from "fs";
import * as path from "path";
import archiver from "archiver";
import type { Project } from "@shared/schema";

/**
 * Generate a minimal Android Studio project with WebView wrapper
 * Packages the Android project as a ZIP file for download
 */
export async function generateAndroidWrapper(
  project: Project
): Promise<{ status: string; downloadPath: string }> {
  if (!project.deployedUrl) {
    throw new Error("Project must have a deployedUrl to generate Android wrapper");
  }

  const projectId = project.id.substring(0, 12);
  const sanitizedProjectName = project.name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .substring(0, 20);
  const packageName = `com.aideploy.${sanitizedProjectName}`;

  // Create temp directory
  const tmpDir = path.join(process.cwd(), "tmp", "android-builds", projectId);
  const androidDir = path.join(tmpDir, "android");
  const appDir = path.join(androidDir, "app");
  const srcDir = path.join(appDir, "src", "main");
  const javaDir = path.join(srcDir, "java", "com", "aideploy", sanitizedProjectName);
  const resDir = path.join(srcDir, "res");
  const layoutDir = path.join(resDir, "layout");
  const valuesDir = path.join(resDir, "values");

  // Create directories
  fs.mkdirSync(javaDir, { recursive: true });
  fs.mkdirSync(layoutDir, { recursive: true });
  fs.mkdirSync(valuesDir, { recursive: true });

  // Create AndroidManifest.xml
  const manifest = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${packageName}">

    <uses-permission android:name="android.permission.INTERNET" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.AppCompat.Light.DarkActionBar">

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

    </application>

</manifest>
`;

  // Create MainActivity.java
  const mainActivity = `package ${packageName};

import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        WebView webView = findViewById(R.id.webview);
        WebView.setWebContentsDebuggingEnabled(true);
        
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setDatabaseEnabled(true);
        
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
            }
        });

        webView.loadUrl("${project.deployedUrl}");
    }
}
`;

  // Create activity_main.xml layout
  const layoutXml = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical">

    <WebView
        android:id="@+id/webview"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />

</LinearLayout>
`;

  // Create strings.xml
  const stringsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${project.name}</string>
</resources>
`;

  // Create colors.xml
  const colorsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="purple_200">#FFBB86FC</color>
    <color name="purple_500">#FF6200EE</color>
    <color name="purple_700">#FF3700B3</color>
    <color name="teal_200">#FF03DAC5</color>
    <color name="teal_700">#FF018786</color>
    <color name="black">#FF000000</color>
    <color name="white">#FFFFFFFF</color>
</resources>
`;

  // Create build.gradle (project level)
  const buildGradleProject = `// Top-level build file
buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:7.2.0'
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

task clean(type: Delete) {
    delete rootProject.buildDir
}
`;

  // Create app/build.gradle
  const buildGradleApp = `plugins {
    id 'com.android.application'
}

android {
    compileSdk 32

    defaultConfig {
        applicationId "${packageName}"
        minSdk 24
        targetSdk 32
        versionCode 1
        versionName "1.0"

        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_11
        targetCompatibility JavaVersion.VERSION_11
    }
}

dependencies {

    implementation 'androidx.appcompat:appcompat:1.4.1'
    implementation 'com.google.android.material:material:1.6.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'

    testImplementation 'junit:junit:4.13.2'
    androidTestImplementation 'androidx.test.ext:junit:1.1.3'
    androidTestImplementation 'androidx.test.espresso:espresso-core:3.4.0'
}
`;

  // Create settings.gradle
  const settingsGradle = `pluginManagement {
    repositories {
        gradlePluginPortal()
        google()
        mavenCentral()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "${project.name}"
include ':app'
`;

  // Create gradle.properties
  const gradleProperties = `# Project-wide Gradle settings.
org.gradle.jvmargs=-Xmx2048m -XX:MaxPermSize=512m
org.gradle.parallel=true
org.gradle.daemon=true
`;

  // Write all files
  fs.writeFileSync(path.join(srcDir, "AndroidManifest.xml"), manifest);
  fs.writeFileSync(path.join(javaDir, "MainActivity.java"), mainActivity);
  fs.writeFileSync(path.join(layoutDir, "activity_main.xml"), layoutXml);
  fs.writeFileSync(path.join(valuesDir, "strings.xml"), stringsXml);
  fs.writeFileSync(path.join(valuesDir, "colors.xml"), colorsXml);
  fs.writeFileSync(path.join(androidDir, "build.gradle"), buildGradleProject);
  fs.writeFileSync(path.join(appDir, "build.gradle"), buildGradleApp);
  fs.writeFileSync(path.join(androidDir, "settings.gradle"), settingsGradle);
  fs.writeFileSync(path.join(androidDir, "gradle.properties"), gradleProperties);

  // Create README for Android project
  const readmeAndroid = `# ${project.name} - Android Wrapper

This is an Android Studio project that wraps your web application in a WebView.

## Setup

1. Open this project in Android Studio
2. Update the package name in build.gradle
3. Configure your signing configuration for release builds
4. Build and test on an emulator or device
5. Generate a signed APK/AAB for Play Store upload

## Configuration

- The WebView loads: ${project.deployedUrl}
- JavaScript is enabled
- DOM storage and database are enabled
- Modify MainActivity.java to add custom settings

## Next Steps

- Configure app name and icons in res/values/strings.xml
- Add your app icon to res/mipmap/
- Set up signing key for Play Store
- Build release APK/AAB in Android Studio

For more information, see the Android Developer documentation.
`;
  fs.writeFileSync(path.join(androidDir, "README.md"), readmeAndroid);

  // Create public/mobile-builds directory if it doesn't exist
  const publicMobileDir = path.join(process.cwd(), "public", "mobile-builds");
  fs.mkdirSync(publicMobileDir, { recursive: true });

  // Zip the android directory
  const zipPath = path.join(publicMobileDir, `android-project-${projectId}.zip`);

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log(`[Android] Generated ZIP: ${zipPath} (${archive.pointer()} bytes)`);
      resolve({
        status: "ready",
        downloadPath: `/mobile-builds/android-project-${projectId}.zip`,
      });
    });

    archive.on("error", (err: Error) => {
      reject(err);
    });

    archive.pipe(output);
    archive.directory(androidDir, "android");
    archive.finalize();
  });
}
