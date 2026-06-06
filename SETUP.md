# Setting up the project

This guide walks you through getting the project running from scratch. It assumes you have a basic familiarity with typing commands but not necessarily with developer tools.

---

## How to open a terminal

You'll be typing commands into a terminal throughout this guide. Here's how to open one:

- **Mac:** Press `Cmd + Space` to open Spotlight, type `Terminal`, and press Enter.
- **Linux:** Press `Ctrl + Alt + T`, or search for "Terminal" in your application menu.
- **Windows:** Press the Windows key, search for `PowerShell`, and open it. Or use **Git Bash** (installed in Step 1 below) — either works.

---

## Step 1 — Install Git

Git is the tool that lets you download the project.

- **Mac:** Git comes pre-installed. Open Terminal and type `git --version` to confirm. If it's missing, macOS will offer to install it — click Install and follow the prompts.
- **Linux:** Run `sudo apt install git` (Debian/Ubuntu) or `sudo dnf install git` (Fedora/RHEL).
- **Windows:** Download and install [Git for Windows](https://git-scm.com/download/win). The default options during installation are fine. This also installs **Git Bash**, which is a good terminal to use for the steps below.

---

## Step 2 — Install Node.js

Node.js is the runtime that executes the simulation code. We recommend installing it through a version manager — it makes things easier and avoids permission problems.

### Mac and Linux — use `nvm`

1. Install nvm by following the instructions at [github.com/nvm-sh/nvm](https://github.com/nvm-sh/nvm#installing-and-updating). The page shows a single `curl` command to paste into your terminal.
2. **Close and reopen your terminal** (this is required — nvm won't be recognized until you do).
3. Run these two commands:
   ```bash
   nvm install --lts
   nvm use --lts
   ```
4. Confirm it worked — you should see version numbers printed:
   ```bash
   node --version    # should print v20.x.x or higher
   npm --version
   ```

### Windows — use `nvm-windows`

1. Go to the [nvm-windows releases page](https://github.com/coreybutler/nvm-windows/releases) and download the file named `nvm-setup.exe` from the latest release.
2. Run the installer. **Right-click it and choose "Run as administrator"** — this is required.
3. Open a new PowerShell or Command Prompt window **as administrator** (right-click the app and choose "Run as administrator"), then run:
   ```
   nvm install lts
   nvm use lts
   ```
4. Confirm it worked:
   ```
   node --version
   npm --version
   ```

### Alternative — direct download (any platform)

If you'd rather skip the version manager, download the LTS installer directly from [nodejs.org](https://nodejs.org/) and run it. Follow the prompts and accept the defaults.

---

## Step 3 — Clone the repository

"Cloning" downloads a copy of the project to your computer.

Open a terminal and run these two commands:

```bash
git clone https://github.com/Djeisen642/human-model.git
cd human-model
```

The first command downloads the project into a new folder called `human-model`. The second command (`cd` = "change directory") puts you inside that folder — you need to be inside it for the next steps to work.

---

## Step 4 — Install dependencies

The project uses several libraries. This command downloads them all:

```bash
npm install
```

You'll see a lot of text scroll by — that's normal. It may take a minute. When it's done you'll get your prompt back.

---

## Step 5 — Run the simulation

```bash
npm start
```

This runs a simulation with 100 people over 100 years. You'll see output in the terminal as it runs, ending with a summary of the result.

It also creates an HTML report inside the `human-model` folder. To open it:

- **Mac:** Run `open output/` in the terminal — this opens the folder in Finder. Double-click the `.html` file to open it in your browser.
- **Linux:** Run `xdg-open output/` to open the folder, then double-click the `.html` file.
- **Windows:** Run `explorer output` to open the folder in File Explorer, then double-click the `.html` file.

The report contains charts showing population, inequality, resource levels, deaths by cause, and more over the course of the run.

---

## Troubleshooting

**`command not found: node` or `command not found: npm`**
Node wasn't added to your PATH. If you used nvm, close your terminal completely and reopen it, then try again. On Windows, make sure you opened a new window after installing, and that you ran the installer as administrator.

**`command not found: git`**
Git isn't installed or isn't on your PATH. Revisit Step 1 and open a new terminal after installing.

**Errors during `npm install` mentioning permissions**
Don't use `sudo npm install`. Fix your Node installation so it doesn't require sudo — using nvm (Step 2) is the recommended way to avoid this.

**The `output/` folder is empty or no HTML file appeared**
The simulation may have exited early due to extinction (the whole population died — this is a normal outcome, not a bug). Check the terminal output for the result summary. The report is still written even on extinction.

**Something else**
Open an issue at [github.com/Djeisen642/human-model/issues](https://github.com/Djeisen642/human-model/issues) and describe what you tried and what the terminal printed.
