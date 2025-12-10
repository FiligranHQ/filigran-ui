<!-- markdownlint-disable MD030 -->

# Filigran Chatbot

> 🪧 Most of the code from this repository is taken from [FlowiseEmbedChat](https://github.com/FlowiseAI/FlowiseChatEmbed).
>
> The chatbot interface and logic is kept, but we remove ties to flowise in favor of an agnostic approach, to be able to connect custom agentic server.

![Flowise](https://github.com/FlowiseAI/FlowiseChatEmbed/blob/main/images/ChatEmbed.gif?raw=true)

Install:

```bash
yarn install
```

Dev:

```bash
yarn dev
```

A development server will be running on http://localhost:5678 automatically. Update `public/index.html` to connect to your server:

```html
<!-- public/index.html -->
<script type="module">
  import Chatbot from 'https://localhost:5678/web.js'; // Switch between './web.js' or 'https://localhost:5678/web.js'
  Chatbot.init({
    agenticUrl: 'https://your-agentic-service-url/endpoint', // Add your endpoint
  });
</script>
```

Build:

```bash
yarn build
```

## Configuration

You can also customize chatbot with different configuration

```html
<script type="module">
  import Chatbot from 'https://localhost:5678/web.js'; // Switch between './web.js' or 'https://localhost:5678/web.js'
  Chatbot.init({
    agenticUrl: 'https://your-agentic-service-url/endpoint', // Add your endpoint
    chatflowConfig: {
      some: "variable" // this will be send in request header
    },
    observersConfig: {
      // (optional) Allows you to execute code in parent based upon signal observations within the chatbot.
      // The userinput field submitted to bot ("" when reset by bot)
      observeUserInput: (userInput) => {
        console.log({ userInput });
      },
      // The bot message stack has changed
      observeMessages: (messages) => {
        console.log({ messages });
      },
      // The bot loading signal changed
      observeLoading: (loading) => {
        console.log({ loading });
      },
    },
    theme: {
      button: {
        backgroundColor: '#3B81F6',
        right: 20,
        bottom: 20,
        size: 48, // small | medium | large | number
        dragAndDrop: true,
        iconColor: 'white',
        customIconSrc: 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/google-messages.svg',
        autoWindowOpen: {
          autoOpen: true, //parameter to control automatic window opening
          openDelay: 2, // Optional parameter for delay time in seconds
          autoOpenOnMobile: false, //parameter to control automatic window opening in mobile
        },
      },
      tooltip: {
        showTooltip: true,
        tooltipMessage: 'Hi There 👋!',
        tooltipBackgroundColor: 'black',
        tooltipTextColor: 'white',
        tooltipFontSize: 16,
      },
      disclaimer: {
        title: 'Disclaimer',
        message: 'By using this chatbot, you agree to the <a target="_blank" href="https://your-url/terms">Terms & Condition</a>',
        textColor: 'black',
        buttonColor: '#3b82f6',
        buttonText: 'Start Chatting',
        buttonTextColor: 'white',
        blurredBackgroundColor: 'rgba(0, 0, 0, 0.4)', //The color of the blurred background that overlays the chat interface
        backgroundColor: 'white',
        denyButtonText: 'Cancel',
        denyButtonBgColor: '#ef4444',
      },
      form: {
        backgroundColor: 'white',
        textColor: 'black',
      }
      customCSS: ``, // Add custom CSS styles. Use !important to override default styles
      chatWindow: {
        showTitle: true,
        showAgentMessages: true,
        title: 'Chat Bot',
        titleAvatarSrc: 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/google-messages.svg',
        titleBackgroundColor: '#3B81F6',
        titleTextColor: '#ffffff',
        welcomeMessage: 'Hello! This is custom welcome message',
        errorMessage: 'This is a custom error message',
        backgroundColor: '#ffffff',
        backgroundImage: 'enter image path or link', // If set, this will overlap the background color of the chat window.
        height: 700,
        width: 400,
        fontSize: 16,
        starterPrompts: ['What is a bot?', 'Who are you?'], // It overrides the starter prompts set by the chat flow passed
        starterPromptFontSize: 15,
        clearChatOnReload: false, // If set to true, the chat will be cleared when the page reloads
        sourceDocsTitle: 'Sources:',
        renderHTML: true,
        botMessage: {
          backgroundColor: '#f7f8ff',
          textColor: '#303235',
          showAvatar: true,
          avatarSrc: 'https://raw.githubusercontent.com/zahidkhawaja/langchain-chat-nextjs/main/public/parroticon.png',
        },
        userMessage: {
          backgroundColor: '#3B81F6',
          textColor: '#ffffff',
          showAvatar: true,
          avatarSrc: 'https://raw.githubusercontent.com/zahidkhawaja/langchain-chat-nextjs/main/public/usericon.png',
        },
        textInput: {
          placeholder: 'Type your question',
          backgroundColor: '#ffffff',
          textColor: '#303235',
          sendButtonColor: '#3B81F6',
          maxChars: 50,
          maxCharsWarningMessage: 'You exceeded the characters limit. Please input less than 50 characters.',
          autoFocus: true, // If not used, autofocus is disabled on mobile and enabled on desktop. true enables it on both, false disables it on both.
          sendMessageSound: true,
          // sendSoundLocation: "send_message.mp3", // If this is not used, the default sound effect will be played if sendSoundMessage is true.
          receiveMessageSound: true,
          // receiveSoundLocation: "receive_message.mp3", // If this is not used, the default sound effect will be played if receiveSoundMessage is true.
        },
        feedback: {
          color: '#303235',
        },
        dateTimeToggle: {
          date: true,
          time: true,
        },
        footer: {
          textColor: '#303235',
          text: 'Powered by',
          company: 'Filigran',
          companyLink: 'https://filigran.io',
        },
      },
    },
  });
</script>
```

## Development Mode (For Local Testing)

1. Configure your environment variables (see above)

2. Start the proxy server:

```bash
yarn start
# Server will be available at:
# - Local:  http://localhost:3001
```

3. Update the test page configuration:

- Open `public/index.html` in your code editor
- Modify the `agenticUrl`:

```html
<!-- public/index.html -->
<script type="module">
  import Chatbot from './web.js';
  Chatbot.init({
    agenticUrl: 'https://your-agentic-service-url/endpoint', // Add your endpoint
  });
</script>
```

4. Open a new terminal and start the development server:

```bash
yarn dev
# This will serve the test page on http://localhost:5678 automatically
```

5. Test the chatbot:

- Navigate to http://localhost:5678
- The chatbot should now be visible and functional

**Note:** The development URL (http://localhost:5678) is automatically added to allowed domains in development mode. You don't need to add it manually.

## License

Source code in this repository is made available under the [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0).

## Release a new version

1. Git tag the repository with the desired version (ex: 1.0.0)
1. Push the tag: on push an [Action is triggered](https://github.com/FiligranHQ/filigran-chatbot/actions) that release the version
1. At the end a tar.gz archive is on the [Release page](https://github.com/FiligranHQ/filigran-chatbot/releases)

In short:
```bash
git tag -a 1.0.0 -m "Releasing version 1.0.0"
```

Example of usage with yarn:
```bash
yarn add filigran-chatbot@https://github.com/FiligranHQ/filigran-chatbot/releases/download/1.0.0/filigran-chatbot-v1.0.0.tgz
```