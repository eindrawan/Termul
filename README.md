# Termul SSH Client - Modern WinSCP Alternative

A powerful, cross-platform SSH client and SFTP file manager designed as a modern alternative to WinSCP. Built with Electron and React, Termul provides a seamless experience for managing remote servers with dual-pane file management, transfer queues, and an integrated terminal.

## 🚀 Why Choose Termul Over WinSCP?

**Termul** brings the power and familiarity of WinSCP to modern platforms with enhanced features:

- **Cross-Platform**: Works seamlessly on Windows, macOS, and Linux (unlike WinSCP which is Windows-only)
- **Modern UI**: Clean, intuitive interface built with React and Tailwind CSS
- **Integrated Terminal**: Full SSH terminal session alongside file management
- **Resumable Transfers**: Robust transfer queue with pause, resume, and retry capabilities
- **Secure by Design**: Modern encryption standards and secure credential storage

## ✨ Key Features

### 📁 Dual-Pane File Manager
- Side-by-side local and remote file explorers
- Drag-and-drop file transfers between panes
- Resizable panes for optimal workspace layout
- Context menus for file operations (rename, delete, permissions)
- Bookmark support for quick navigation to frequently used directories

### 📤 Advanced Transfer Queue
- Resumable file transfers with progress tracking
- Parallel transfer support with configurable concurrency
- Conflict resolution with overwrite/rename/skip options
- Transfer history with detailed logs and error reporting
- Pause, resume, and cancel operations on active transfers

### 💻 Integrated SSH Terminal
- Full-featured terminal session bound to your SSH connection
- xterm.js-based terminal with customizable appearance
- Copy/paste support with context menu
- Terminal session logging and export capabilities
- Automatic terminal resizing on window resize

### 🔐 Security & Authentication
- Support for password and key-based authentication
- Encrypted credential storage using system keychain
- SSH private key management with passphrase support
- Host key verification with known hosts database
- Context isolation prevents renderer access to Node APIs

### 🎯 User Experience
- Connection profile management for quick server access
- Keyboard shortcuts matching Windows Explorer conventions
- Responsive design that adapts to different screen sizes
- Real-time connection status and latency indicators
- Toast notifications for operation feedback

## 🛠️ Technology Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js with Electron main process
- **SSH/SFTP**: ssh2, node-ssh, ssh2-sftp-client
- **Terminal**: xterm.js with node-pty
- **Database**: SQLite with better-sqlite3
- **Security**: keytar for credential management, system DPAPI/keychain for encryption
- **State Management**: Zustand + React Query

## 📋 System Requirements

- **Node.js**: 20.0 or higher
- **Operating System**: Windows 10+, macOS 10.14+, or modern Linux distributions
- **Memory**: 4GB RAM minimum (8GB recommended)
- **Storage**: 200MB for application installation

## 🚀 Getting Started

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/termul/termul-ssh-client.git
   cd termul-ssh-client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

### Building for Production

```bash
# Build the application
npm run build

# Create distributable packages
npm run dist          # All platforms
npm run dist:win       # Windows only
npm run dist:win:nosign    # Windows without code signing
npm run dist:win:portable  # Windows portable version
```

## 🏗️ Project Architecture

```
src/
├── main/                 # Electron main process
│   ├── ipc/           # IPC handlers for secure communication
│   ├── services/       # Core services (SSH, SFTP, Terminal, etc.)
│   ├── workers/        # Worker threads for file transfers
│   └── utils/          # Utility functions
├── preload/              # Preload scripts for secure API exposure
└── renderer/             # React frontend
    ├── components/     # React UI components
    ├── contexts/       # React state management
    ├── types/          # TypeScript type definitions
    └── utils/          # Frontend utilities
```

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run type-check` - Run TypeScript type checking

### Code Quality

The project uses ESLint and TypeScript for code quality assurance:

```bash
# Check for linting issues
npm run lint

# Automatically fix linting issues
npm run lint:fix

# Type checking without compilation
npm run type-check
```

## 🔒 Security Considerations

Termul takes security seriously with multiple layers of protection:

- **Credential Storage**: All SSH credentials are encrypted using Windows DPAPI or system keychain
- **Private Keys**: Stored with AES-256-GCM encryption with optional passphrase protection
- **Host Key Verification**: Maintains a known hosts database with fingerprint confirmation
- **Context Isolation**: Prevents renderer process access to privileged Node APIs
- **Input Validation**: Zod schemas enforce payload constraints and prevent prototype pollution

## 🆚 Comparison with WinSCP

| Feature | Termul | WinSCP |
|---------|--------|--------|
| Cross-Platform | ✅ Windows, macOS, Linux | ❌ Windows only |
| Modern UI | ✅ React-based responsive interface | ❌ Legacy Windows UI |
| Integrated Terminal | ✅ Full SSH terminal in same window | ✅ PuTTY integration |
| Transfer Queue | ✅ Advanced queue with resume support | ✅ Basic queue support |
| Scripting | ⚠️ Limited (planned) | ✅ .NET scripting |
| Price | ✅ Free & Open Source | ✅ Free (closed source) |
| Updates | ✅ Automatic updates planned | ✅ Manual updates |

## 🗺️ Roadmap

### Upcoming Features

- [ ] Multi-session support (multiple connections in separate tabs)
- [ ] Directory synchronization and comparison
- [ ] Scripting and automation capabilities
- [ ] File editor with syntax highlighting
- [ ] Dark/light theme toggle
- [ ] Auto-update mechanism
- [ ] Plugin system for extensibility

### Version History

- **v0.1.0** - Initial release with core SSH/SFTP functionality
- **v0.2.0** - Enhanced transfer queue and bookmark system
- **v0.3.0** - Improved terminal integration and UI polish

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:

- Code style and conventions
- Pull request process
- Issue reporting guidelines
- Development environment setup

## 📄 License

Termul is licensed under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- [WinSCP](https://winscp.net/) - Inspiration for the dual-pane file manager design
- [Electron](https://www.electronjs.org/) - Cross-platform desktop application framework
- [xterm.js](https://xtermjs.org/) - Terminal emulator component
- [React](https://reactjs.org/) - UI framework
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework

## 📞 Support

- 📖 [Documentation](https://termul.github.io/docs)
- 🐛 [Issue Tracker](https://github.com/termul/termul-ssh-client/issues)
- 💬 [Discussions](https://github.com/termul/termul-ssh-client/discussions)

---

**Termul** - The modern WinSCP alternative for cross-platform SSH file management.