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

Node.js is the runtime that executes the simulation code. The simplest option is a direct download; if you plan to work on multiple projects with different Node versions, use mise instead.

### Simple option — direct download (any platform)

Download the LTS installer from [nodejs.org](https://nodejs.org/) and run it. Follow the prompts and accept the defaults.

Confirm it worked:
```bash
node --version    # should print v20.x.x or higher
npm --version
```

### Version manager option — mise (Mac, Linux, Windows)

[mise](https://mise.jdx.dev) manages Node (and other runtimes) and avoids permission problems with global packages. Install it and then install Node in two steps:

**Mac and Linux:**
```bash
curl https://mise.run | sh
```
Then follow the printed instructions to add mise to your shell (it'll show you the exact line to add). Close and reopen your terminal, then run:
```bash
mise use --global node@lts
```

**Windows:**
```
winget install mise
```
Close and reopen your terminal, then run:
```
mise use --global node@lts
```

Confirm it worked:
```bash
node --version
npm --version
```

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
Node wasn't added to your PATH. Close your terminal completely and reopen it, then try again. If you used mise, make sure you followed the step to add it to your shell profile.

**`command not found: git`**
Git isn't installed or isn't on your PATH. Revisit Step 1 and open a new terminal after installing.

**Errors during `npm install` mentioning permissions**
Don't use `sudo npm install`. Switch to the mise install path in Step 2 — it avoids this problem.

**The `output/` folder is empty or no HTML file appeared**
The simulation may have exited early due to extinction (the whole population died — this is a normal outcome, not a bug). Check the terminal output for the result summary. The report is still written even on extinction.

**Something else**
Open an issue at [github.com/Djeisen642/human-model/issues](https://github.com/Djeisen642/human-model/issues) and describe what you tried and what the terminal printed.
