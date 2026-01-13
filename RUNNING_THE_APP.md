# How to Run the RunItBack Basketball Stats Tracker

This guide will walk you through running the application on your local machine.

## Prerequisites

Before you begin, make sure you have the following installed:

1. **Node.js** (version 18 or higher recommended)
   - Check if you have it: Open a terminal and run `node --version`
   - If you don't have it, download from [nodejs.org](https://nodejs.org/)

2. **npm** (comes with Node.js)
   - Check if you have it: Run `npm --version`

3. **Git** (if you're cloning from GitHub)
   - Check if you have it: Run `git --version`

## Step-by-Step Instructions

### Step 1: Navigate to the Project Directory

Open a terminal (Terminal on Mac/Linux, Command Prompt or PowerShell on Windows) and navigate to the project folder:

```bash
cd /Users/carlbelanger/codes/RunItBack
```

Or if you're in a different location, use the path to wherever you have the project.

### Step 2: Install Dependencies

The project uses npm packages that need to be installed. Run:

```bash
npm install
```

or the shorthand:

```bash
npm i
```

**What this does:** This command reads the `package.json` file and downloads all the required libraries (React, Vite, UI components, etc.) into a `node_modules` folder.

**Expected output:** You'll see a progress bar and a list of packages being installed. This may take 1-3 minutes depending on your internet connection.

**If you see errors:**
- Make sure you have Node.js installed correctly
- Try deleting `node_modules` folder and `package-lock.json`, then run `npm install` again
- Check your internet connection

### Step 3: Start the Development Server

Once dependencies are installed, start the development server:

```bash
npm run dev
```

**What this does:** This starts Vite (the build tool) which:
- Compiles your React/TypeScript code
- Starts a local web server
- Enables hot-reloading (changes you make will automatically refresh in the browser)

**Expected output:** You should see something like:

```
  VITE v6.3.5  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### Step 4: Open the Application in Your Browser

1. Look for the URL in the terminal output (usually `http://localhost:5173/`)
2. Open your web browser (Chrome, Firefox, Safari, Edge, etc.)
3. Navigate to that URL

**Alternative:** You can also press `Cmd+Click` (Mac) or `Ctrl+Click` (Windows/Linux) on the URL in the terminal to open it automatically.

### Step 5: Using the Application

Once the app loads, you should see:
- A dashboard with tournaments, teams, and recent games
- Navigation menu on the left
- Sample data already loaded (teams, players, games)

**Try these features:**
- Click on "Tournaments" to see tournament management
- Click on "Teams" to view team rosters
- Click on "Recent Games" to see game history
- Click "New Game" to start tracking a live game

## Common Commands

### Development Mode
```bash
npm run dev
```
Starts the development server with hot-reloading.

### Build for Production
```bash
npm run build
```
Creates an optimized production build in a `dist` folder.

### Stop the Server
Press `Ctrl+C` in the terminal where the server is running.

## Troubleshooting

### Port Already in Use
If you see an error like "Port 5173 is already in use":
- Another instance might be running - check other terminal windows
- Kill the process: `lsof -ti:5173 | xargs kill -9` (Mac/Linux) or find the process in Task Manager (Windows)
- Or use a different port: `npm run dev -- --port 3000`

### Module Not Found Errors
If you see "Cannot find module" errors:
```bash
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors
The app uses TypeScript. If you see type errors:
- Make sure all dependencies are installed
- Check that your Node.js version is compatible (18+)

### Browser Won't Load
- Make sure the dev server is actually running (check the terminal)
- Try a different browser
- Clear your browser cache
- Check the URL is exactly `http://localhost:5173/`

### Changes Not Reflecting
- The dev server should auto-reload. If not:
  - Save the file again
  - Check the terminal for errors
  - Hard refresh the browser: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)

## What's Happening Behind the Scenes?

1. **Vite** is the build tool that:
   - Transpiles TypeScript to JavaScript
   - Bundles your React components
   - Serves files through a local web server
   - Watches for file changes and hot-reloads

2. **React** is the UI framework that:
   - Renders your components
   - Manages application state
   - Handles user interactions

3. **TypeScript** provides:
   - Type checking
   - Better IDE support
   - Catch errors before runtime

## Next Steps

Once you have the app running:
- Explore the different pages and features
- Try creating a new game and tracking stats
- Check out the advanced metrics and analytics
- Review the code structure in the `src/` folder

## Getting Help

If you encounter issues:
1. Check the terminal output for error messages
2. Check the browser console (F12 or right-click → Inspect → Console)
3. Make sure all prerequisites are installed correctly
4. Try the troubleshooting steps above

Happy coding! 🏀

