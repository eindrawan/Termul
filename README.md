# Termul SSH Client

A WinSCP-like SSH client built with Electron and React, featuring dual-pane file management, transfer queue, and integrated terminal.

## Features

- **SSH Connection Management**: Save and manage connection profiles with support for password and key-based authentication
- **Dual-Pane File Manager**: Side-by-side local and remote file explorers with drag-and-drop support
- **Transfer Queue**: Resumable file transfers with progress tracking, conflict resolution, and queue management
- **Integrated Terminal**: SSH terminal session bound to the active connection
- **Security**: Encrypted credential storage with optional passphrase caching
- **Cross-Platform**: Built with Electron for Windows, macOS, and Linux support

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js with Electron main process
- **SSH/SFTP**: ssh2, node-ssh, ssh2-sftp-client
- **Terminal**: xterm.js with node-pty
- **Database**: SQLite with better-sqlite3
- **Security**: keytar for credential management, DPAPI for master key encryption

## Development

### Prerequisites

- Node.js 20+
- npm or yarn

### Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run development server:
   ```bash
   npm run dev
   ```

### Building

```bash
npm run build
```

### Packaging

```bash
npm run dist
```

## Project Structure

```
src/
├── main/                 # Electron main process
│   ├── ipc/           # IPC handlers
│   ├── services/       # Main process services
│   └── workers/        # Worker threads
├── preload/              # Preload scripts
└── renderer/             # React frontend
    ├── components/     # React components
    ├── contexts/       # React contexts
    ├── services/       # Frontend services
    └── types/          # TypeScript types
```

## Architecture

The application follows a multi-process architecture:

- **Main Process**: Manages SSH connections, file operations, and system integration
- **Renderer Process**: React UI with optimistic updates and state management
- **Worker Threads**: Handle file transfers in parallel without blocking the UI
- **Preload Scripts**: Secure bridge between main and renderer processes

## Security Considerations

- All SSH credentials are encrypted using Windows DPAPI or system keychain
- Private keys are stored with AES-256-GCM encryption
- Passphrase caching is time-limited and stored in memory only
- Host key verification with known hosts database
- Context isolation prevents renderer access to Node APIs

## Roadmap

See [docs/architecture.md](docs/architecture.md) for detailed development roadmap and technical specifications.

## License

MIT