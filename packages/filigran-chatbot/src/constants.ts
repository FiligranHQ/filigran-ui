import type { BubbleProps } from './features/bubble';

export const defaultBotProps: BubbleProps = {
  agenticUrl: '',
  onRequest: undefined,
  ref: undefined,
  text: undefined,
  chatflowConfig: undefined,
  left: 20,
  theme: {
    button: {
      backgroundColor: '#001BDA',
      size: 48,
      dragAndDrop: true,
      iconColor: 'white',
      customIconSrc: 'https://filigran.io/app/uploads/2025/05/ai-chat.png',
      autoWindowOpen: {
        autoOpen: false,
        openDelay: 2,
        autoOpenOnMobile: false,
      },
    },
    tooltip: {
      showTooltip: false,
    },
    customCSS: `
          * {
            font-family: "IBM Plex Sans" !important;
          }
        `,
    chatWindow: {
      showTitle: true,
      showAgentMessages: false,
      title: 'Ariane AI Assistant',
      titleAvatarSrc: 'https://filigran.io/app/uploads/2025/05/embleme_filigran_blanc.png',
      welcomeMessage: "Hi there 👋 You're speaking with an AI Agent. I'm here to answer your questions, so what brings you here today?",
      errorMessage: 'Sorry, an error has occurred, please try again later.',
      backgroundColor: '#ffffff',
      fontSize: 14,
      starterPromptFontSize: 13,
      clearChatOnReload: false,
      sourceDocsTitle: 'Sources:',
      renderHTML: true,
      botMessage: {
        backgroundColor: '#f7f8ff',
        textColor: '#000000',
        showAvatar: true,
        avatarSrc: 'https://filigran.io/app/uploads/2025/05/embleme_filigran_background.png',
      },
      userMessage: {
        backgroundColor: '#001BDA',
        textColor: '#ffffff',
        showAvatar: false,
      },
      textInput: {
        placeholder: 'Ask a question...',
        backgroundColor: '#ffffff',
        textColor: '#303235',
        sendButtonColor: '#001BDA',
        maxChars: 100,
        maxCharsWarningMessage: 'You exceeded the characters limit. Please input less than 50 characters.',
        autoFocus: true,
        sendMessageSound: false,
        receiveMessageSound: false,
      },
      dateTimeToggle: {
        date: true,
        time: true,
      },
      footer: {
        textColor: '#303235',
        text: 'Powered by',
        company: 'Filigran Ariane AI',
        companyLink: 'https://filigran.io',
      },
    },
  },
  observersConfig: undefined,
};
