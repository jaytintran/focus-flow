# ⚡ FocusFlow — Minimalist Productivity & Mindfulness Hub

FocusFlow is a premium, offline-first personal productivity and mindfulness application. Designed with modern aesthetics (dark/light themes, sleek animations, and responsive touch zones), it blends structured task management, habit-forming routines, and interactive journaling into a single, unified workflow.

Developed to run natively on the web and seamlessly port to Android/iOS using Capacitor.

---

## 🚀 Key Features

### ⏱️ Bulletproof Focus Timer
- **Offset-based background persistence**: Instead of ticking in a background thread or performing heavy periodic disk writes, the app registers a start timestamp in IndexedDB.
- **Auto-Crash Recovery**: If the app is force-closed, phone dies, or the operating system suspends the process, the background time is reconstructed automatically on restart using client/device delta values.
- **Zero-Lag Lifecycle Sync**: Features visibility change listeners to instantaneously sync elapsed time when resuming or locking/unlocking the screen.

### 📅 Habit Tracker & Completion History
- **Streak Counters**: Live flame indicators (`🔥`) showing active daily completion streaks.
- **Completion Calendar Modal**: Access a full-screen, custom historical completion record for any habit.
- **Custom Dropdown Selector**: Fluid 3-column grid dropdown supporting unselected states and accent boundary colors mapped to each habit's customized visual theme.
- **Daily Resets**: Automated checks on page load to reset daily recurring tasks.

### 📓 Mindful Journal & Logs
- **Dual Display Modes**: Toggle between a **Timeline View** (chronological task accomplishments & text logs) and a **Day View** (detailed daily breakdowns).
- **Interactive Calendar Navigation**: Navigate history month-by-month; active days containing logs or tasks are highlighted with subtle dots.
- **Smart Parsing**: Type natural language commands such as `#Work` to auto-categorize logs or `@3:30pm` to set custom entry timestamps.
- **Category Filter Pill Bar**: Easily tag entries with color-coded categories dynamically.

### 📂 Custom Category System
- Dynamic category creation with an integrated icon picker.
- Flexible task sorting and grouping.
- Auto-cleaning routines when deleting categories to prevent orphaned tasks (defaulting tasks to category-less state).

---

## 🛠️ Tech Stack
- **Framework**: [React 19](https://react.dev/) (TypeScript)
- **Bundler**: [Vite](https://vite.dev/) (Fast Hot Module Replacement)
- **Styling**: Vanilla Tailwind CSS v4 + Framer Motion (Smooth page transitions & micro-interactions)
- **Persistence**: High-performance local storage wrapping IndexedDB via transactions
- **Hybrid Bridge**: [Capacitor 8](https://capacitorjs.com/) (Direct bridge to Android native SDKs)

---

## 📦 Local Web Setup

1. **Prerequisites**: Make sure you have [Node.js](https://nodejs.org/) installed.
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Run Dev Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your web browser.

---

## 📱 Porting to Android (Step-by-Step Guide)

You can build and deploy FocusFlow directly to an Android phone or emulator using **Capacitor** and **Android Studio**.

### 1. Install Android Prerequisites
- Download and install [Android Studio](https://developer.android.com/studio).
- Open Android Studio and install the **Android SDK Command-line Tools** via `Tools > SDK Manager > SDK Tools`.
- Ensure you have a device connected with **USB Debugging** enabled, or set up an Virtual Device (Emulator) inside Android Studio's **Device Manager**.

### 2. Build Web Assets
First, compile the React production code into static assets:
```bash
npm run build
```
This creates the static HTML/JS/CSS files in the `dist/` directory.

### 3. Initialize & Sync Capacitor
Add the Android native project folder and sync your built web code:
```bash
# Add the android project (only needed once)
npx cap add android

# Sync web assets and capacitor plugins into the Android directory
npx cap sync
```

### 4. Open Project in Android Studio
Launch Android Studio with the configured Android source directory:
```bash
npx cap open android
```
*Wait for Android Studio to finish indexing the project and completing the Gradle sync.*

### 5. Deploy and Run

#### Method A: Run Directly on Device/Emulator (Recommended)
1. In Android Studio, locate the device dropdown in the top toolbar (should list your physical device or emulator).
2. Select your target device.
3. Click the green **Run (Play)** button (or press `Shift + F10`).
4. The app will compile and install on your device.

#### Method B: Generate a Portable APK
1. In Android Studio's top menu, go to `Build > Build Bundle(s) / APK(s) > Build APK(s)`.
2. Once the build completes, a popup notification will appear at the bottom right. Click **Locate**.
3. Copy the compiled `app-debug.apk` file to your phone and install it manually.

---

## ⚙️ Capacitor Configuration
The native app properties are defined in [capacitor.config.ts](capacitor.config.ts):
- **App ID**: `com.focusflow.app`
- **App Name**: `Focus Flow`
- **Web Directory**: `dist`
