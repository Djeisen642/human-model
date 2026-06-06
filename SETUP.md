# Setting up the project

This guide walks you through getting the project running from scratch. It assumes you have a basic familiarity with typing commands but not necessarily with developer tools.

---

## Step 1 — Install Git

Git is the tool that lets you download (and contribute to) the project.

- **Mac:** Git comes pre-installed. Open Terminal and type `git --version` to confirm. If it's missing, macOS will prompt you to install it.
- **Linux:** Run `sudo apt install git` (Debian/Ubuntu) or `sudo dnf install git` (Fedora/RHEL).
- **Windows:** Download and install [Git for Windows](https://git-scm.com/download/win). During installation, the default options are fine. This also installs "Git Bash," a terminal you can use for the rest of these steps.

---

## Step 2 — Install Node.js

Node.js is the runtime that executes the simulation code. We recommend installing it through a version manager — it makes upgrading easier and avoids permission problems.

### Mac and Linux — use `nvm`

1. Install nvm by following the instructions at [github.com/nvm-sh/nvm](https://github.com/nvm-sh/nvm#installing-and-updating). It's a single command you paste into your terminal.
2. Close and reopen your terminal, then run:
   ```bash
   nvm install --lts
   nvm use --lts
   ```
3. Confirm it worked:
   ```bash
   node --version    # should print v20.x.x or higher
   npm --version
   ```

### Windows — use `nvm-windows`

1. Download the installer from [github.com/coreybutler/nvm-windows/releases](https://github.com/coreybutler/nvm-windows/releases) — get the file named `nvm-setup.exe`.
2. Run the installer with the default options.
3. Open a new Command Prompt or PowerShell window and run:
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

If you'd rather not use a version manager, download the LTS installer directly from [nodejs.org](https://nodejs.org/). Run it and follow the prompts.

---

## Step 3 — Clone the repository

"Cloning" downloads a copy of the project to your computer.

Open a terminal (on Windows, use Git Bash or PowerShell) and run:

```bash
git clone https://github.com/Djeisen642/human-model.git
cd human-model
```

---

## Step 4 — Install dependencies

The project uses several libraries. This command downloads them all into a local folder:

```bash
npm install
```

You should see a progress bar and then a summary. It may take a minute.

---

## Step 5 — Run the simulation

```bash
npm start
```

This runs a simulation with 100 people over 100 years. You'll see progress printed to the terminal as it runs, and an HTML report will be written to a folder called `output/` in the project directory. Open that file in any browser to see charts and a full breakdown of the run.

---

## Troubleshooting

**`command not found: node` or `command not found: npm`**
Node wasn't added to your PATH. If you used nvm, close your terminal and reopen it, then try again. On Windows, make sure you opened a new window after installing.

**`command not found: git`**
Git isn't installed or wasn't added to your PATH. Revisit Step 1 and make sure you opened a new terminal after installing.

**Errors during `npm install` about permissions**
Don't use `sudo npm install`. Instead, fix your Node installation to not require sudo — this is one of the reasons the version manager approach (nvm) is recommended.

**The `output/` folder is empty or the HTML file doesn't open**
The simulation may have exited early due to extinction (the whole population died — this is a normal outcome, not a bug). Check the terminal output for the result summary.

**Something else**
Open an issue at [github.com/Djeisen642/human-model/issues](https://github.com/Djeisen642/human-model/issues) and describe what you tried and what the terminal said.
