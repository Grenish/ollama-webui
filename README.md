# Ollama Chat Web Interface

A web interface for chatting with Ollama local models, featuring:

- **Code Syntax Highlighting**
- **Typing Animations**
- **Responsive Design**
- **Dark Mode Theme**
- **Model Selection Navbar**
- **Multiline Input Box**

## Table of Contents

- [Demo](#demo)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Configuration](#configuration)
- [Usage](#usage)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Demo

🚧 Work in Progress 🚧


---

## Features

- **Dark Mode**: A clean, minimalistic, and elegant dark-themed UI.
- **Responsive Design**: Works seamlessly across desktop and mobile devices.
- **Code Syntax Highlighting**: Messages containing code are beautifully highlighted using Prism.js.
- **Typing Animations**: Realistic typing indicator while the bot is generating a response.
- **Model Selection Navbar**: Choose from available Ollama models directly from the navbar.
- **Multiline Input**: Compose messages over multiple lines with a sleek input box.

---

## Prerequisites

- **Node.js** (version 12 or higher)
- **npm** (Node Package Manager)
- **Ollama Local Models**: Ensure Ollama is installed and running on your machine.
- **Internet Connection**: To fetch dependencies during installation.

---

## Installation

Follow these steps to set up the application on your local machine.

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/ollama-chat-interface.git
cd ollama-chat-interface
```

### 2. Install Dependencies

Install the required npm packages:

```bash
npm install
```

This command installs:

- **React**: JavaScript library for building user interfaces.
- **Tailwind CSS**: Utility-first CSS framework.
- **Prism.js**: Syntax highlighting library.
- **React Typing Animation**: Library for typing animations.
- **Other Dependencies**: As specified in `package.json`.

### 3. Set Up Tailwind CSS

Tailwind CSS is already configured in the project. If you need to modify the configuration:

- Tailwind config file: `tailwind.config.js`
- Main CSS file with Tailwind directives: `src/index.css`

---

## Running the Application

### 1. Start the Development Server

```bash
npm start
```

This will run the app in development mode. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### 2. Build for Production

To create a production build of the app:

```bash
npm run build
```

The build artifacts will be stored in the `build/` directory.

---

## Configuration

### Ollama API Setup

Ensure that the Ollama API is running locally and accessible at `http://localhost:11434`.

- **Start Ollama**: Follow Ollama's documentation to start the API server.
- **Available Models**: Verify that models are installed and available via the API.

### Adjust API Endpoints (if necessary)

If your Ollama API is running on a different host or port, update the API endpoints in the code:

- **Model Fetching Endpoint**: `Navbar.jsx`
- **Message Generation Endpoint**: `Chat.jsx`

---

## Usage

### Selecting a Model

1. **Navigate to the Application**: Open [http://localhost:5173](http://localhost:3000) (vite).
2. **Select a Model**: Use the dropdown in the navbar to select an available Ollama model.

### Sending Messages

- **Compose a Message**: Type your message in the multiline input box at the bottom.
- **Send Message**:
  - **Send**: Press `Enter`.
  - **New Line**: Press `Shift + Enter` to add a new line within the message.

### Receiving Responses

- **Typing Indicator**: A typing animation is displayed while the model generates a response.
- **Syntax Highlighting**: Any code snippets in messages will be syntax-highlighted.

---

## Troubleshooting

### Common Issues

#### 1. Models Not Appearing in Dropdown

- **Cause**: The application cannot fetch models from the Ollama API.
- **Solution**:
  - Ensure Ollama API is running.
  - Verify the API endpoint in `Navbar.jsx`.
  - Check the console for any error messages.

#### 2. Unable to Send Messages

- **Cause**: No model selected or API error.
- **Solution**:
  - Select a model from the navbar.
  - Check the Ollama API is accessible.
  - Inspect the network requests in the browser's developer tools.

#### 3. Styling Issues

- **Cause**: Tailwind CSS not applied correctly.
- **Solution**:
  - Ensure `@tailwind` directives are present in `src/index.css`.
  - Restart the development server.

#### 4. Build Errors

- **Cause**: Dependency issues or syntax errors.
- **Solution**:
  - Run `npm install` to ensure all dependencies are installed.
  - Check the console for specific error messages.

---

## Contributing

It will be open for contributions soon. Stay tuned!

---

## License

This project is licensed under the [MIT License](./LICENSE).

---

## Acknowledgements

- **[Ollama](https://ollama.ai/)**: For providing the local models and API.
- **[React](https://reactjs.org/)**: JavaScript library for building user interfaces.
- **[Tailwind CSS](https://tailwindcss.com/)**: Utility-first CSS framework.
- **[Prism.js](https://prismjs.com/)**: Syntax highlighting library.
- **[React Typing Animation](https://www.npmjs.com/package/react-typing-animation)**: Typing animations for React.

---

## Detailed File Structure

```
ollama-chat-interface/
├── node_modules/
├── public/
│   ├── index.html
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── Chat.jsx
│   │   ├── Navbar.jsx
│   │   └── TypingAnimation.jsx
│   ├── styles/
│   │   └── index.css
│   ├── App.jsx
│   ├── index.jsx
│   └── tailwind.config.js
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

## Dependencies

- **React**: ^17.0.2
- **Tailwind CSS**: ^2.2.19
- **Prism.js**: ^1.24.1
- **React Typing Animation**: ^1.6.4
- **Other Dependencies**: Listed in `package.json`

---

## Contact

For any questions or suggestions, please open an issue or contact [mrcoder2033d@example.com](mailto:your_email@example.com).

---

_This README was generated to help users install and use the Ollama Chat Web Interface on their own devices._
