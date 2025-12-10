import { createEffect, createMemo, createSignal, For, mergeProps, on, onMount, Show } from 'solid-js';
import { v4 as uuidv4 } from 'uuid';
import { IncomingInput, isStreamAvailableQuery } from '@/queries/sendMessageQuery';
import { TextInput } from './inputs/textInput';
import { GuestBubble } from './bubbles/GuestBubble';
import { BotBubble } from './bubbles/BotBubble';
import { LoadingBubble } from './bubbles/LoadingBubble';
import { StarterPromptBubble } from './bubbles/StarterPromptBubble';
import { BotMessageTheme, DateTimeToggleTheme, DisclaimerPopUpTheme, FooterTheme, TextInputTheme, UserMessageTheme } from '@/features/bubble/types';
import { Badge } from './Badge';
import { DisclaimerPopup, Popup } from '@/features/popup';
import { Avatar } from '@/components/avatars/Avatar';
import { DeleteButton, SendButton } from '@/components/buttons/SendButton';
import ExpandButton from '@/components/buttons/ExpandButton';
import { FilePreview } from '@/components/inputs/textInput/components/FilePreview';
import { CircleDotIcon, SparklesIcon, TrashIcon } from './icons';
import { CancelButton } from './buttons/CancelButton';
import { cancelAudioRecording, startAudioRecording, stopAudioRecording } from '@/utils/audioRecording';
import { getCookie, getLocalStorageChatDetails, removeLocalStorageChatHistory, setCookie, setLocalStorageChatDetails } from '@/utils';
import { cloneDeep } from 'lodash';
import { FollowUpPromptBubble } from '@/components/bubbles/FollowUpPromptBubble';
import { EventStreamContentType, fetchEventSource } from '@microsoft/fetch-event-source';
import { CloseButton } from '@/components/buttons/CloseButton';

type IUploadConstraits = {
  fileTypes: string[];
  maxUploadSize: number;
};

export type UploadsConfig = {
  imgUploadSizeAndTypes: IUploadConstraits[];
  fileUploadSizeAndTypes: IUploadConstraits[];
  isImageUploadAllowed: boolean;
  isSpeechToTextEnabled: boolean;
  isRAGFileUploadAllowed: boolean;
};

type FilePreviewData = string | ArrayBuffer;

type FilePreview = {
  data: FilePreviewData;
  mime: string;
  name: string;
  preview: string;
  type: string;
};

type messageType = 'apiMessage' | 'userMessage' | 'usermessagewaiting' | 'leadCaptureMessage';
type ExecutionState = 'INPROGRESS' | 'FINISHED' | 'ERROR' | 'TERMINATED' | 'TIMEOUT' | 'STOPPED';

export type IAgentReasoning = {
  agentName?: string;
  messages?: string[];
  usedTools?: any[];
  artifacts?: FileUpload[];
  sourceDocuments?: any[];
  instructions?: string;
  nextAgent?: string;
};

export type IAction = {
  id?: string;
  data?: any;
  elements?: Array<{
    type: string;
    label: string;
  }>;
  mapping?: {
    approve: string;
    reject: string;
    toolCalls: any[];
  };
};

export type FileUpload = Omit<FilePreview, 'preview'>;

export type MessageType = {
  messageId?: string;
  message: string;
  type: messageType;
  sourceDocuments?: any;
  fileAnnotations?: any;
  fileUploads?: Partial<FileUpload>[];
  artifacts?: Partial<FileUpload>[];
  agentReasoning?: IAgentReasoning[];
  execution?: any;
  agentFlowEventStatus?: string;
  agentFlowExecutedData?: any;
  usedTools?: any[];
  action?: IAction | null;
  id?: string;
  followUpPrompts?: string;
  dateTime?: string;
};

type observerConfigType = (accessor: string | boolean | object | MessageType[]) => void;
export type observersConfigType = Record<'observeUserInput' | 'observeLoading' | 'observeMessages', observerConfigType>;

export type BotProps = {
  expanded?: boolean;
  onExpand?: () => void;
  agenticUrl: string;
  onRequest?: (request: RequestInit) => Promise<void>;
  chatflowConfig?: Record<string, unknown> & { vars: Record<string, string> };
  backgroundColor?: string;
  welcomeMessage?: string;
  errorMessage?: string;
  botMessage?: BotMessageTheme;
  userMessage?: UserMessageTheme;
  textInput?: TextInputTheme;
  poweredByTextColor?: string;
  badgeBackgroundColor?: string;
  bubbleBackgroundColor?: string;
  bubbleTextColor?: string;
  showTitle?: boolean;
  showAgentMessages?: boolean;
  title?: string;
  titleAvatarSrc?: string;
  titleTextColor?: string;
  titleBackgroundColor?: string;
  formBackgroundColor?: string;
  formTextColor?: string;
  fontSize?: number;
  isFullPage?: boolean;
  footer?: FooterTheme;
  sourceDocsTitle?: string;
  observersConfig?: observersConfigType;
  starterPrompts?: string[] | Record<string, { prompt: string }>;
  starterPromptFontSize?: number;
  clearChatOnReload?: boolean;
  disclaimer?: DisclaimerPopUpTheme;
  dateTimeToggle?: DateTimeToggleTheme;
  renderHTML?: boolean;
  closeBot?: () => void;
};

const defaultWelcomeMessage = 'Hi there! How can I help?';

/*const sourceDocuments = [
    {
        "pageContent": "I know some are talking about "living with COVID-19". Tonight – I say that we will never just accept living with COVID-19. \r\n\r\nWe will continue to combat the virus as we do other diseases. And because this is a virus that mutates and spreads, we will stay on guard. \r\n\r\nHere are four common sense steps as we move forward safely.  \r\n\r\nFirst, stay protected with vaccines and treatments. We know how incredibly effective vaccines are. If you're vaccinated and boosted you have the highest degree of protection. \r\n\r\nWe will never give up on vaccinating more Americans. Now, I know parents with kids under 5 are eager to see a vaccine authorized for their children. \r\n\r\nThe scientists are working hard to get that done and we'll be ready with plenty of vaccines when they do. \r\n\r\nWe're also ready with anti-viral treatments. If you get COVID-19, the Pfizer pill reduces your chances of ending up in the hospital by 90%.",
        "metadata": {
          "source": "blob",
          "blobType": "",
          "loc": {
            "lines": {
              "from": 450,
              "to": 462
            }
          }
        }
    },
    {
        "pageContent": "sistance,  and  polishing  [65].  For  instance,  AI  tools  generate\nsuggestions based on inputting keywords or topics. The tools\nanalyze  search  data,  trending  topics,  and  popular  queries  to\ncreate  fresh  content.  What's  more,  AIGC  assists  in  writing\narticles and posting blogs on specific topics. While these tools\nmay not be able to produce high-quality content by themselves,\nthey can provide a starting point for a writer struggling with\nwriter's block.\nH.  Cons of AIGC\nOne of the main concerns among the public is the potential\nlack  of  creativity  and  human  touch  in  AIGC.  In  addition,\nAIGC sometimes lacks a nuanced understanding of language\nand context, which may lead to inaccuracies and misinterpre-\ntations. There are also concerns about the ethics and legality\nof using AIGC, particularly when it results in issues such as\ncopyright  infringement  and  data  privacy.  In  this  section,  we\nwill discuss some of the disadvantages of AIGC (Table IV).",
        "metadata": {
          "source": "blob",
          "blobType": "",
          "pdf": {
            "version": "1.10.100",
            "info": {
              "PDFFormatVersion": "1.5",
              "IsAcroFormPresent": false,
              "IsXFAPresent": false,
              "Title": "",
              "Author": "",
              "Subject": "",
              "Keywords": "",
              "Creator": "LaTeX with hyperref",
              "Producer": "pdfTeX-1.40.21",
              "CreationDate": "D:20230414003603Z",
              "ModDate": "D:20230414003603Z",
              "Trapped": {
                "name": "False"
              }
            },
            "metadata": null,
            "totalPages": 17
          },
          "loc": {
            "pageNumber": 8,
            "lines": {
              "from": 301,
              "to": 317
            }
          }
        }
    },
    {
        "pageContent": "Main article: Views of Elon Musk",
        "metadata": {
          "source": "https://en.wikipedia.org/wiki/Elon_Musk",
          "loc": {
            "lines": {
              "from": 2409,
              "to": 2409
            }
          }
        }
    },
    {
        "pageContent": "First Name: John\nLast Name: Doe\nAddress: 120 jefferson st.\nStates: Riverside\nCode: NJ\nPostal: 8075",
        "metadata": {
          "source": "blob",
          "blobType": "",
          "line": 1,
          "loc": {
            "lines": {
              "from": 1,
              "to": 6
            }
          }
        }
    },
]*/

const defaultBackgroundColor = '#ffffff';
const defaultTextColor = '#303235';
const defaultTitleBackgroundColor = '#3B81F6';

/* FormInputView component - for displaying the form input */
const FormInputView = (props: {
  title: string;
  description: string;
  inputParams: any[];
  onSubmit: (formData: object) => void;
  parentBackgroundColor?: string;
  backgroundColor?: string;
  textColor?: string;
  sendButtonColor?: string;
  fontSize?: number;
}) => {
  const [formData, setFormData] = createSignal<Record<string, any>>({});

  const handleInputChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    props.onSubmit(formData());
  };

  return (
    <div
      class="w-full h-full flex flex-col items-center justify-center px-4 py-8 rounded-lg"
      style={{
        'font-family': 'Poppins, sans-serif',
        'font-size': props.fontSize ? `${props.fontSize}px` : '16px',
        background: props.parentBackgroundColor || defaultBackgroundColor,
        color: props.textColor || defaultTextColor,
      }}
    >
      <div
        class="w-full max-w-md bg-white shadow-lg rounded-lg overflow-hidden"
        style={{
          'font-family': 'Poppins, sans-serif',
          'font-size': props.fontSize ? `${props.fontSize}px` : '16px',
          background: props.backgroundColor || defaultBackgroundColor,
          color: props.textColor || defaultTextColor,
        }}
      >
        <div class="p-6">
          <h2 class="text-xl font-bold mb-2">{props.title}</h2>
          {props.description && (
            <p class="text-gray-600 mb-6" style={{ color: props.textColor || defaultTextColor }}>
              {props.description}
            </p>
          )}

          <form onSubmit={handleSubmit} class="space-y-4">
            <For each={props.inputParams}>
              {(param) => (
                <div class="space-y-2">
                  <label class="block text-sm font-medium">{param.label}</label>

                  {param.type === 'string' && (
                    <input
                      type="text"
                      class="w-full px-3 py-2 rounded-md focus:outline-none"
                      style={{
                        border: '1px solid #9ca3af',
                        'border-radius': '0.375rem',
                      }}
                      onFocus={(e) => (e.target.style.border = '1px solid #3b82f6')}
                      onBlur={(e) => (e.target.style.border = '1px solid #9ca3af')}
                      name={param.name}
                      onInput={(e) => handleInputChange(param.name, e.target.value)}
                      required
                    />
                  )}

                  {param.type === 'number' && (
                    <input
                      type="number"
                      class="w-full px-3 py-2 rounded-md focus:outline-none"
                      style={{
                        border: '1px solid #9ca3af',
                        'border-radius': '0.375rem',
                      }}
                      onFocus={(e) => (e.target.style.border = '1px solid #3b82f6')}
                      onBlur={(e) => (e.target.style.border = '1px solid #9ca3af')}
                      name={param.name}
                      onInput={(e) => handleInputChange(param.name, parseFloat(e.target.value))}
                      required
                    />
                  )}

                  {param.type === 'boolean' && (
                    <div class="flex items-center">
                      <input
                        type="checkbox"
                        class="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                        style={{
                          border: '1px solid #9ca3af',
                        }}
                        name={param.name}
                        onChange={(e) => handleInputChange(param.name, e.target.checked)}
                      />
                      <span class="ml-2">Yes</span>
                    </div>
                  )}

                  {param.type === 'options' && (
                    <select
                      class="w-full px-3 py-2 rounded-md focus:outline-none"
                      style={{
                        border: '1px solid #9ca3af',
                        'border-radius': '0.375rem',
                      }}
                      onFocus={(e) => (e.target.style.border = '1px solid #3b82f6')}
                      onBlur={(e) => (e.target.style.border = '1px solid #9ca3af')}
                      name={param.name}
                      onChange={(e) => handleInputChange(param.name, e.target.value)}
                      required
                    >
                      <option value="">Select an option</option>
                      <For each={param.options}>{(option) => <option value={option.name}>{option.label}</option>}</For>
                    </select>
                  )}
                </div>
              )}
            </For>

            <div class="pt-4">
              <button
                type="submit"
                class="w-full py-2 px-4 text-white font-semibold rounded-md focus:outline-none transition duration-300 ease-in-out"
                style={{
                  'background-color': props.sendButtonColor || '#3B81F6',
                }}
              >
                Submit
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export const Bot = (botProps: BotProps & { class?: string }) => {
  // set a default value for showTitle if not set and merge with other props
  const props = mergeProps({ showTitle: true }, botProps);
  let chatContainer: HTMLDivElement | undefined;
  let bottomSpacer: HTMLDivElement | undefined;
  let botContainer: HTMLDivElement | undefined;

  const [userInput, setUserInput] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [sourcePopupOpen, setSourcePopupOpen] = createSignal(false);
  const [sourcePopupSrc, setSourcePopupSrc] = createSignal({});
  const [messages, setMessages] = createSignal<MessageType[]>(
    [
      {
        message: props.welcomeMessage ?? defaultWelcomeMessage,
        type: 'apiMessage',
      },
    ],
    { equals: false },
  );

  const [chatId, setChatId] = createSignal('');
  const [starterPrompts, setStarterPrompts] = createSignal<string[]>([], { equals: false });
  const [leadEmail, setLeadEmail] = createSignal('');
  const [disclaimerPopupOpen, setDisclaimerPopupOpen] = createSignal(false);

  // drag & drop file input
  // TODO: fix this type
  const [previews, setPreviews] = createSignal<FilePreview[]>([]);

  // audio recording
  const [elapsedTime, setElapsedTime] = createSignal('00:00');
  const [isRecording, setIsRecording] = createSignal(false);
  const [recordingNotSupported, setRecordingNotSupported] = createSignal(false);
  const [isLoadingRecording, setIsLoadingRecording] = createSignal(false);
  const [isDirectReplyAgent, setIsDirectReplyAgent] = createSignal(false);

  // follow-up prompts
  const [followUpPrompts, setFollowUpPrompts] = createSignal<string[]>([]);

  createMemo(() => {
    const customerId = (props.chatflowConfig?.vars as any)?.customerId;
    setChatId(customerId ? `${customerId.toString()}+${uuidv4()}` : uuidv4());
  });

  onMount(() => {
    if (botProps?.observersConfig) {
      const { observeUserInput, observeLoading, observeMessages } = botProps.observersConfig;
      typeof observeUserInput === 'function' &&
        // eslint-disable-next-line solid/reactivity
        createMemo(() => {
          observeUserInput(userInput());
        });
      typeof observeLoading === 'function' &&
        // eslint-disable-next-line solid/reactivity
        createMemo(() => {
          observeLoading(loading());
        });
      typeof observeMessages === 'function' &&
        // eslint-disable-next-line solid/reactivity
        createMemo(() => {
          observeMessages(messages());
        });
    }

    if (!bottomSpacer) return;
    setTimeout(() => {
      chatContainer?.scrollTo(0, chatContainer.scrollHeight);
    }, 50);
  });

  const scrollToBottom = () => {
    setTimeout(() => {
      chatContainer?.scrollTo(0, chatContainer.scrollHeight);
    }, 50);
  };

  /**
   * Add each chat message into localStorage
   */
  const addChatMessage = (allMessage: MessageType[]) => {
    const messages = allMessage.map((item) => {
      if (item.fileUploads) {
        const fileUploads = item?.fileUploads.map((file) => ({
          type: file.type,
          name: file.name,
          mime: file.mime,
        }));
        return { ...item, fileUploads };
      }
      // To prevent localStorage overloading 
      delete item.agentFlowEventStatus;
      delete item.agentFlowExecutedData;
      
      return item;
    });
    setLocalStorageChatDetails(props.agenticUrl, chatId(), { chatHistory: messages });
};

  // Define the audioRef
  let audioRef: HTMLAudioElement | undefined;
  const playReceiveSound = () => {
    if (props.textInput?.receiveMessageSound && props.textInput?.receiveSoundLocation) {
      audioRef = new Audio(props.textInput?.receiveSoundLocation);
      audioRef.play();
    }
  };

  let hasSoundPlayed = false;

  const updateLastMessage = (text: string) => {
    setMessages((prevMessages) => {
      const allMessages = [...cloneDeep(prevMessages)];
      if (allMessages[allMessages.length - 1].type === 'userMessage') return allMessages;
      if (!text) return allMessages;
      // directReplyAgent are just loading messages
      if (isDirectReplyAgent()) {
        allMessages[allMessages.length - 1].message = text;
        setIsDirectReplyAgent(false);
      } else {
        allMessages[allMessages.length - 1].message += text;
      }
      allMessages[allMessages.length - 1].dateTime = new Date().toISOString();
      if (!hasSoundPlayed) {
        playReceiveSound();
        hasSoundPlayed = true;
      }
      addChatMessage(allMessages);
      return allMessages;
    });
  };

  const updateErrorMessage = (errorMessage: string) => {
    setMessages((prevMessages) => {
      const allMessages = [...cloneDeep(prevMessages)];
      allMessages.push({ message: props.errorMessage || errorMessage, type: 'apiMessage' });
      setIsDirectReplyAgent(false);
      addChatMessage(allMessages);
      return allMessages;
    });
  };

  const updateLastMessageSourceDocuments = (sourceDocuments: any) => {
    setMessages((data) => {
      const updated = data.map((item, i) => {
        if (i === data.length - 1) {
          return { ...item, sourceDocuments };
        }
        return item;
      });
      addChatMessage(updated);
      return [...updated];
    });
  };

  const updateLastMessageUsedTools = (usedTools: any[]) => {
    setMessages((prevMessages) => {
      const allMessages = [...cloneDeep(prevMessages)];
      if (allMessages[allMessages.length - 1].type === 'userMessage') return allMessages;
      allMessages[allMessages.length - 1].usedTools = usedTools;
      addChatMessage(allMessages);
      return allMessages;
    });
  };

  const updateLastMessageFileAnnotations = (fileAnnotations: any) => {
    setMessages((prevMessages) => {
      const allMessages = [...cloneDeep(prevMessages)];
      if (allMessages[allMessages.length - 1].type === 'userMessage') return allMessages;
      allMessages[allMessages.length - 1].fileAnnotations = fileAnnotations;
      addChatMessage(allMessages);
      return allMessages;
    });
  };

  const updateLastMessageAgentReasoning = (agentReasoning: string | IAgentReasoning[]) => {
    setMessages((data) => {
      const updated = data.map((item, i) => {
        if (i === data.length - 1) {
          return { ...item, agentReasoning: typeof agentReasoning === 'string' ? JSON.parse(agentReasoning) : agentReasoning };
        }
        return item;
      });
      addChatMessage(updated);
      return [...updated];
    });
  };

  const updateAgentFlowEvent = (event: string) => {
    if (event === 'INPROGRESS') {
      setMessages((prevMessages) => [...prevMessages, { message: '', type: 'apiMessage', agentFlowEventStatus: event }]);
    } else {
      setMessages((prevMessages) => {
        const allMessages = [...cloneDeep(prevMessages)];
        if (allMessages[allMessages.length - 1].type === 'userMessage') return allMessages;
        allMessages[allMessages.length - 1].agentFlowEventStatus = event;
        return allMessages;
      });
    }
  };

  const updateAgentFlowExecutedData = (agentFlowExecutedData: any) => {
    setMessages((prevMessages) => {
      const allMessages = [...cloneDeep(prevMessages)];
      if (allMessages[allMessages.length - 1].type === 'userMessage') return allMessages;
      allMessages[allMessages.length - 1].agentFlowExecutedData = agentFlowExecutedData;
      addChatMessage(allMessages);
      return allMessages;
    });
  };

  const updateLastMessageArtifacts = (artifacts: FileUpload[]) => {
    setMessages((prevMessages) => {
      const allMessages = [...cloneDeep(prevMessages)];
      if (allMessages[allMessages.length - 1].type === 'userMessage') return allMessages;
      allMessages[allMessages.length - 1].artifacts = artifacts;
      addChatMessage(allMessages);
      return allMessages;
    });
  };

  const updateLastMessageAction = (action: IAction) => {
    setMessages((data) => {
      const updated = data.map((item, i) => {
        if (i === data.length - 1) {
          return { ...item, action: typeof action === 'string' ? JSON.parse(action) : action };
        }
        return item;
      });
      addChatMessage(updated);
      return [...updated];
    });
  };

  const clearPreviews = () => {
    // Revoke the data uris to avoid memory leaks
    previews().forEach((file) => URL.revokeObjectURL(file.preview));
    setPreviews([]);
  };

  // Handle errors
  const handleError = (message = 'Oops! There seems to be an error. Please try again.', preventOverride?: boolean) => {
    let errMessage = message;
    if (!preventOverride && props.errorMessage) {
      errMessage = props.errorMessage;
    }
    setMessages((prevMessages) => {
      const messages: MessageType[] = [...prevMessages, { message: errMessage, type: 'apiMessage' }];
      addChatMessage(messages);
      return messages;
    });
    setLoading(false);
    setUserInput('');
    scrollToBottom();
  };

  const handleDisclaimerAccept = () => {
    setDisclaimerPopupOpen(false); // Close the disclaimer popup
    setCookie('chatbotDisclaimer', 'true', 365); // Disclaimer accepted
  };

  const promptClick = (prompt: string) => {
    handleSubmit(prompt);
  };

  const followUpPromptClick = (prompt: string) => {
    setFollowUpPrompts([]);
    handleSubmit(prompt);
  };

  const updateMetadata = (data: any, input: string) => {
    if (data.chatId) {
      setChatId(data.chatId);
    }

    if (input === '' && data.question) {
      // the response contains the question even if it was in an audio format
      // so if input is empty but the response contains the question, update the user message to show the question
      setMessages((prevMessages) => {
        const allMessages = [...cloneDeep(prevMessages)];
        if (allMessages[allMessages.length - 2].type === 'apiMessage') return allMessages;
        allMessages[allMessages.length - 2].message = data.question;
        addChatMessage(allMessages);
        return allMessages;
      });
    }

    if (data.followUpPrompts) {
      setMessages((prevMessages) => {
        const allMessages = [...cloneDeep(prevMessages)];
        if (allMessages[allMessages.length - 1].type === 'userMessage') return allMessages;
        allMessages[allMessages.length - 1].followUpPrompts = data.followUpPrompts;
        addChatMessage(allMessages);
        return allMessages;
      });
      setFollowUpPrompts(JSON.parse(data.followUpPrompts));
    }
  };

  const fetchResponseFromEventStream = async (agenticUrl: string, params: any) => {
    const chatId = params.chatId;
    const input = params.question;
    params.streaming = true;
    fetchEventSource(agenticUrl, {
      openWhenHidden: true,
      method: 'POST',
      body: JSON.stringify(params),
      headers: {
        'Content-Type': 'application/json',
        ...props.chatflowConfig?.vars,
      },
      async onopen(response) {
        if (response.ok && response.headers.get('content-type')?.startsWith(EventStreamContentType)) {
          return; // everything's good
        } else if (response.status === 429) {
          const errMessage = 'Preview API limit reached (50 requests per day). As this is a preview version, requests are limited. Your limit will reset in 24 hours.';
          handleError(errMessage, true);
          throw new Error(errMessage);
        } else if (response.status === 403) {
          const errMessage = 'Unauthorized';
          handleError(errMessage);
          throw new Error(errMessage);
        } else if (response.status === 401) {
          const errMessage = 'Unauthenticated';
          handleError(errMessage);
          throw new Error(errMessage);
        } else if (response.status === 400) {
          const errMessage = 'Chatbot proxy not properly configured';
          handleError(errMessage);
          throw new Error(errMessage);
        } else if (response.status >= 500 && response.status < 600) {
          const errMessage = 'Server error. Please try again later.';
          handleError(errMessage);
          throw new Error(errMessage);
        } else {
          throw new Error();
        }
      },
      async onmessage(ev) {
        const payload = JSON.parse(ev.data);
        switch (payload.event) {
          case 'start':
            setMessages((prevMessages) => [...prevMessages, { message: '', type: 'apiMessage' }]);
            break;
          case 'token':
            updateLastMessage(payload.data);
            break;
          case 'sourceDocuments':
            updateLastMessageSourceDocuments(payload.data);
            break;
          case 'usedTools':
            updateLastMessageUsedTools(payload.data);
            break;
          case 'fileAnnotations':
            updateLastMessageFileAnnotations(payload.data);
            break;
          case 'agentReasoning':
            updateLastMessageAgentReasoning(payload.data);
            break;
          case 'nextAgentFlow':
            if (payload.data.nodeId.startsWith('directReplyAgent')) {
              setIsDirectReplyAgent(true);
            }
            break;
          case 'agentFlowEvent':
            updateAgentFlowEvent(payload.data);
            break;
          case 'agentFlowExecutedData':
            updateAgentFlowExecutedData(payload.data);
            break;
          case 'action':
            updateLastMessageAction(payload.data);
            break;
          case 'artifacts':
            updateLastMessageArtifacts(payload.data);
            break;
          case 'metadata':
            updateMetadata(payload.data, input);
            break;
          case 'error':
            updateErrorMessage(payload.data);
            break;
          case 'abort':
            abortMessage();
            closeResponse();
            break;
          case 'end':
            setLocalStorageChatDetails(agenticUrl, chatId);
            closeResponse();
            break;
        }
      },
      async onclose() {
        closeResponse();
      },
      onerror(err) {
        console.error('EventSource Error: ', err);
        closeResponse();
        throw err;
      },
    });
  };

  const closeResponse = () => {
    setLoading(false);
    setUserInput('');
    hasSoundPlayed = false;
    setTimeout(() => {
      scrollToBottom();
    }, 100);
  };

  const abortMessage = () => {
    setMessages((prevMessages) => {
      const allMessages = [...cloneDeep(prevMessages)];
      if (allMessages[allMessages.length - 1].type === 'userMessage') return allMessages;
      const lastAgentReasoning = allMessages[allMessages.length - 1].agentReasoning;
      if (lastAgentReasoning && lastAgentReasoning.length > 0) {
        allMessages[allMessages.length - 1].agentReasoning = lastAgentReasoning.filter((reasoning) => !reasoning.nextAgent);
      }
      setIsDirectReplyAgent(false);
      return allMessages;
    });
  };

  // Handle form submission
  const handleSubmit = async (value: string | object, action?: IAction | undefined | null, humanInput?: any) => {
    if (typeof value === 'string' && value.trim() === '') {
      const containsFile = previews().filter((item) => !item.mime.startsWith('image') && item.type !== 'audio').length > 0;
      if (!previews().length || (previews().length && containsFile)) {
        return;
      }
    }

    let formData = {};
    if (typeof value === 'object') {
      formData = value;
      value = Object.entries(value)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
    }

    setLoading(true);
    scrollToBottom();

    clearPreviews();

    setMessages((prevMessages) => {
      const messages: MessageType[] = [...prevMessages, { message: value as string, type: 'userMessage' }];
      addChatMessage(messages);
      return messages;
    });

    const body: IncomingInput = {
      question: value,
      chatId: chatId(),
    };

    if (props.chatflowConfig) body.overrideConfig = props.chatflowConfig;

    if (leadEmail()) body.leadEmail = leadEmail();

    if (action) body.action = action;

    if (humanInput) body.humanInput = humanInput;

    fetchResponseFromEventStream(props.agenticUrl, body);
  };

  const handleActionClick = async (elem: any, action: IAction | undefined | null) => {
    setUserInput(elem.label);
    setMessages((data) => {
      const updated = data.map((item, i) => {
        if (i === data.length - 1) {
          return { ...item, action: null };
        }
        return item;
      });
      addChatMessage(updated);
      return [...updated];
    });
    handleSubmit(elem.label, action);
  };

  const clearChat = () => {
    try {
      removeLocalStorageChatHistory(props.agenticUrl);
      setChatId(
        (props.chatflowConfig?.vars as any)?.customerId ? `${(props.chatflowConfig?.vars as any).customerId.toString()}+${uuidv4()}` : uuidv4(),
      );
      const messages: MessageType[] = [
        {
          message: props.welcomeMessage ?? defaultWelcomeMessage,
          type: 'apiMessage',
        },
      ];
      setMessages(messages);
    } catch (error: any) {
      const errorData = error.response.data || `${error.response.status}: ${error.response.statusText}`;
      console.error(`error: ${errorData}`);
    }
  };

  onMount(() => {
    if (props.clearChatOnReload) {
      clearChat();
      window.addEventListener('beforeunload', clearChat);
      return () => {
        window.removeEventListener('beforeunload', clearChat);
      };
    }
  });

  createEffect(() => {
    if (props.starterPrompts) {
      let prompts: string[];

      if (Array.isArray(props.starterPrompts)) {
        // If starterPrompts is an array
        prompts = props.starterPrompts;
      } else {
        // If starterPrompts is a JSON object
        prompts = Object.values(props.starterPrompts).map((promptObj: { prompt: string }) => promptObj.prompt);
      }

      // Filter out any empty prompts
      return setStarterPrompts(prompts.filter((prompt) => prompt !== ''));
    }
  });

  // Auto scroll chat to bottom
  createEffect(() => {
    if (messages()) {
      if (messages().length > 1) {
        setTimeout(() => {
          chatContainer?.scrollTo(0, chatContainer.scrollHeight);
        }, 400);
      }
    }
  });

  createEffect(() => {
    if (props.fontSize && botContainer) botContainer.style.fontSize = `${props.fontSize}px`;
  });

  // eslint-disable-next-line solid/reactivity
  createEffect(async () => {
    if (props.disclaimer) {
      if (getCookie('chatbotDisclaimer') == 'true') {
        setDisclaimerPopupOpen(false);
      } else {
        setDisclaimerPopupOpen(true);
      }
    } else {
      setDisclaimerPopupOpen(false);
    }

    const chatMessage = getLocalStorageChatDetails(props.agenticUrl);
    if (chatMessage && Object.keys(chatMessage).length) {
      if (chatMessage.chatId) setChatId(chatMessage.chatId);
      const savedLead = chatMessage.lead;
      if (savedLead) {
        setLeadEmail(savedLead.email);
      }
      const loadedMessages: MessageType[] =
        chatMessage?.chatHistory?.length > 0
          ? chatMessage.chatHistory?.map((message: MessageType) => {
              const chatHistory: MessageType = {
                messageId: message?.messageId,
                message: message.message,
                type: message.type,
                dateTime: message.dateTime,
              };
              if (message.sourceDocuments) chatHistory.sourceDocuments = message.sourceDocuments;
              if (message.fileAnnotations) chatHistory.fileAnnotations = message.fileAnnotations;
              if (message.fileUploads) chatHistory.fileUploads = message.fileUploads;
              if (message.agentReasoning) chatHistory.agentReasoning = message.agentReasoning;
              if (message.action) chatHistory.action = message.action;
              if (message.artifacts) chatHistory.artifacts = message.artifacts;
              if (message.followUpPrompts) chatHistory.followUpPrompts = message.followUpPrompts;
              if (message.execution && message.execution.executionData)
                chatHistory.agentFlowExecutedData =
                  typeof message.execution.executionData === 'string' ? JSON.parse(message.execution.executionData) : message.execution.executionData;
              if (message.agentFlowExecutedData)
                chatHistory.agentFlowExecutedData =
                  typeof message.agentFlowExecutedData === 'string' ? JSON.parse(message.agentFlowExecutedData) : message.agentFlowExecutedData;
              return chatHistory;
            })
          : [{ message: props.welcomeMessage ?? defaultWelcomeMessage, type: 'apiMessage' }];

      const filteredMessages = loadedMessages.filter((message) => message.type !== 'leadCaptureMessage');
      setMessages([...filteredMessages]);
    }

    // Determine if particular chatflow is available for streaming
    const { data } = await isStreamAvailableQuery({
      agenticUrl: props.agenticUrl,
      onRequest: props.onRequest,
    });

    if (!data) {
      handleError('Service unavailable !');
    }

    // eslint-disable-next-line solid/reactivity
    return () => {
      setUserInput('');
      setLoading(false);
      setMessages([
        {
          message: props.welcomeMessage ?? defaultWelcomeMessage,
          type: 'apiMessage',
        },
      ]);
    };
  });

  const addRecordingToPreviews = (blob: Blob) => {
    let mimeType = '';
    const pos = blob.type.indexOf(';');
    if (pos === -1) {
      mimeType = blob.type;
    } else {
      mimeType = blob.type.substring(0, pos);
    }

    // read blob and add to previews
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      const base64data = reader.result as FilePreviewData;
      const upload: FilePreview = {
        data: base64data,
        preview: '../assets/wave-sound.jpg',
        type: 'audio',
        name: `audio_${Date.now()}.wav`,
        mime: mimeType,
      };
      setPreviews((prevPreviews) => [...prevPreviews, upload]);
    };
  };

  const handleDeletePreview = (itemToDelete: FilePreview) => {
    if (itemToDelete.type === 'file') {
      URL.revokeObjectURL(itemToDelete.preview); // Clean up for file
    }
    setPreviews(previews().filter((item) => item !== itemToDelete));
  };

  const onMicrophoneClicked = () => {
    setIsRecording(true);
    startAudioRecording(setIsRecording, setRecordingNotSupported, setElapsedTime);
  };

  const onRecordingCancelled = () => {
    if (!recordingNotSupported) cancelAudioRecording();
    setIsRecording(false);
    setRecordingNotSupported(false);
  };

  const onRecordingStopped = async () => {
    setIsLoadingRecording(true);
    stopAudioRecording(addRecordingToPreviews);
  };

  const getInputDisabled = (): boolean => {
    const messagesArray = messages();
    const disabled =
      loading() ||
      !props.agenticUrl ||
      (messagesArray[messagesArray.length - 1].action && Object.keys(messagesArray[messagesArray.length - 1].action as any).length > 0);
    if (disabled) {
      return true;
    }
    return false;
  };

  createEffect(
    // listen for changes in previews
    on(previews, (uploads) => {
      // wait for audio recording to load and then send
      const containsAudio = uploads.filter((item) => item.type === 'audio').length > 0;
      if (uploads.length >= 1 && containsAudio) {
        setIsRecording(false);
        setRecordingNotSupported(false);
        promptClick('');
      }

      return () => {
        setPreviews([]);
      };
    }),
  );

  const previewDisplay = (item: FilePreview) => {
    if (item.mime.startsWith('image/')) {
      return (
        <button
          class="group w-12 h-12 flex items-center justify-center relative rounded-[10px] overflow-hidden transition-colors duration-200"
          onClick={() => handleDeletePreview(item)}
        >
          <img class="w-full h-full bg-cover" src={item.data as string} />
          <span class="absolute hidden group-hover:flex items-center justify-center z-10 w-full h-full top-0 left-0 bg-black/10 rounded-[10px] transition-colors duration-200">
            <TrashIcon />
          </span>
        </button>
      );
    } else if (item.mime.startsWith('audio/')) {
      return (
        <div
          class={`inline-flex basis-auto flex-grow-0 flex-shrink-0 justify-between items-center rounded-xl h-12 p-1 mr-1 bg-gray-500`}
          style={{
            width: `${chatContainer ? (botProps.isFullPage ? chatContainer?.offsetWidth / 4 : chatContainer?.offsetWidth / 2) : '200'}px`,
          }}
        >
          <audio class="block bg-cover bg-center w-full h-full rounded-none text-transparent" controls src={item.data as string} />
          <button class="w-7 h-7 flex items-center justify-center bg-transparent p-1" onClick={() => handleDeletePreview(item)}>
            <TrashIcon color="white" />
          </button>
        </div>
      );
    } else {
      return <FilePreview disabled={getInputDisabled()} item={item} onDelete={() => handleDeletePreview(item)} />;
    }
  };

  return (
    <>
      <div
        ref={botContainer}
        class={'relative flex w-full h-full text-base overflow-hidden bg-cover bg-center flex-col items-center chatbot-container ' + props.class}
      >
        {props.showTitle ? (
          <div
            class="flex flex-row items-center w-full h-[50px] absolute top-0 left-0 z-10 px-2"
            style={{
              background: props.titleBackgroundColor || props.bubbleBackgroundColor || defaultTitleBackgroundColor,
              color: props.titleTextColor || props.bubbleTextColor || defaultBackgroundColor,
              'border-top-left-radius': props.isFullPage ? '0px' : '6px',
              'border-top-right-radius': props.isFullPage ? '0px' : '6px',
            }}
          >
            <Show when={props.titleAvatarSrc}>
              <>
                <div style={{ width: '15px' }} />
                <Avatar initialAvatarSrc={props.titleAvatarSrc} />
              </>
            </Show>
            <Show when={props.title}>
              <span class="px-3 whitespace-pre-wrap font-semibold max-w-full">{props.title}</span>
            </Show>
            <div style={{ flex: 1 }} />
            <div class="flex justify-between gap-2">
              <ExpandButton expanded={props.expanded ?? false} on:click={props.onExpand} color={props.bubbleTextColor} type="button" class="w-8" />
              <DeleteButton
                sendButtonColor={props.bubbleTextColor}
                type="button"
                class="w-8"
                isDisabled={messages().length === 1}
                on:click={clearChat}
              >
                <span style={{ 'font-family': 'Poppins, sans-serif' }}>Clear</span>
              </DeleteButton>
              <CloseButton color={props.bubbleTextColor} class="w-8" on:click={props.closeBot} />
            </div>
          </div>
        ) : null}
        <div class="flex flex-col w-full h-full justify-start z-0">
          <div
            ref={chatContainer}
            class="overflow-y-scroll flex flex-col flex-grow min-w-full w-full px-1 pt-[70px] relative scrollable-container chatbot-chat-view scroll-smooth"
          >
            <For each={[...messages()]}>
              {(message, index) => {
                return (
                  <>
                    {message.type === 'userMessage' && (
                      <GuestBubble
                        message={message}
                        backgroundColor={props.userMessage?.backgroundColor}
                        textColor={props.userMessage?.textColor}
                        showAvatar={props.userMessage?.showAvatar}
                        avatarSrc={props.userMessage?.avatarSrc}
                        fontSize={props.fontSize}
                        renderHTML={props.renderHTML}
                      />
                    )}
                    {message.type === 'apiMessage' && (
                      <BotBubble
                        message={message}
                        backgroundColor={props.botMessage?.backgroundColor}
                        textColor={props.botMessage?.textColor}
                        fontSize={props.fontSize}
                        showAvatar={props.botMessage?.showAvatar}
                        avatarSrc={props.botMessage?.avatarSrc}
                        isLoading={loading() && index() === messages().length - 1}
                        showAgentMessages={props.showAgentMessages}
                        handleActionClick={(elem, action) => handleActionClick(elem, action)}
                        sourceDocsTitle={props.sourceDocsTitle}
                        handleSourceDocumentsClick={(sourceDocuments) => {
                          setSourcePopupSrc(sourceDocuments);
                          setSourcePopupOpen(true);
                        }}
                        dateTimeToggle={props.dateTimeToggle}
                        renderHTML={props.renderHTML}
                      />
                    )}
                    {message.type === 'userMessage' && loading() && index() === messages().length - 1 && (
                      <LoadingBubble
                        backgroundColor={props.botMessage?.backgroundColor}
                        textColor={props.botMessage?.textColor}
                        fontSize={props.fontSize}
                      />
                    )}
                    {message.type === 'apiMessage' && message.message === '' && loading() && index() === messages().length - 1 && (
                      <LoadingBubble
                        backgroundColor={props.botMessage?.backgroundColor}
                        textColor={props.botMessage?.textColor}
                        fontSize={props.fontSize}
                      />
                    )}
                  </>
                );
              }}
            </For>
          </div>
          <Show when={messages().length === 1}>
            <Show when={starterPrompts().length > 0}>
              <div class="w-full flex flex-row flex-wrap px-3 py-[10px] gap-2">
                <For each={[...starterPrompts()]}>
                  {(key) => (
                    <StarterPromptBubble
                      prompt={key}
                      onPromptClick={() => promptClick(key)}
                      starterPromptFontSize={botProps.starterPromptFontSize} // Pass it here as a number
                    />
                  )}
                </For>
              </div>
            </Show>
          </Show>
          <Show when={messages().length > 2}>
            <Show when={followUpPrompts().length > 0}>
              <>
                <div class="flex items-center gap-1 px-4">
                  <SparklesIcon class="w-4 h-4" />
                  <span class="text-sm text-gray-700">Try these prompts</span>
                </div>
                <div class="w-full flex flex-row flex-wrap px-4 py-[10px] gap-2">
                  <For each={[...followUpPrompts()]}>
                    {(prompt, index) => (
                      <FollowUpPromptBubble
                        prompt={prompt}
                        onPromptClick={() => followUpPromptClick(prompt)}
                        starterPromptFontSize={botProps.starterPromptFontSize} // Pass it here as a number
                      />
                    )}
                  </For>
                </div>
              </>
            </Show>
          </Show>
          <Show when={previews().length > 0}>
            <div class="w-full flex items-center justify-start gap-2 px-4 pt-2 border-t border-[#eeeeee]">
              <For each={[...previews()]}>{(item) => <>{previewDisplay(item)}</>}</For>
            </div>
          </Show>
          <div class="w-full px-4 pt-2 pb-1">
            {isRecording() ? (
              <>
                {recordingNotSupported() ? (
                  <div class="w-full flex items-center justify-between p-4 border border-[#eeeeee]">
                    <div class="w-full flex items-center justify-between gap-3">
                      <span class="text-base">To record audio, use modern browsers like Chrome or Firefox that support audio recording.</span>
                      <button
                        class="py-2 px-4 justify-center flex items-center bg-red-500 text-white rounded-md"
                        type="button"
                        onClick={() => onRecordingCancelled()}
                      >
                        Okay
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    class="h-[58px] flex items-center justify-between chatbot-input border border-[#eeeeee]"
                    data-testid="input"
                    style={{
                      margin: 'auto',
                      'background-color': props.textInput?.backgroundColor ?? defaultBackgroundColor,
                      color: props.textInput?.textColor ?? defaultTextColor,
                    }}
                  >
                    <div class="flex items-center gap-3 px-4 py-2">
                      <span>
                        <CircleDotIcon color="red" />
                      </span>
                      <span>{elapsedTime() || '00:00'}</span>
                      {isLoadingRecording() && <span class="ml-1.5">Sending...</span>}
                    </div>
                    <div class="flex items-center">
                      <CancelButton buttonColor={props.textInput?.sendButtonColor} type="button" class="m-0" on:click={onRecordingCancelled}>
                        <span style={{ 'font-family': 'Poppins, sans-serif' }}>Send</span>
                      </CancelButton>
                      <SendButton
                        sendButtonColor={props.textInput?.sendButtonColor}
                        type="button"
                        isDisabled={loading()}
                        class="m-0"
                        on:click={onRecordingStopped}
                      >
                        <span style={{ 'font-family': 'Poppins, sans-serif' }}>Send</span>
                      </SendButton>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <TextInput
                backgroundColor={props.textInput?.backgroundColor}
                textColor={props.textInput?.textColor}
                placeholder={props.textInput?.placeholder}
                sendButtonColor={props.textInput?.sendButtonColor}
                maxChars={props.textInput?.maxChars}
                maxCharsWarningMessage={props.textInput?.maxCharsWarningMessage}
                autoFocus={props.textInput?.autoFocus}
                fontSize={props.fontSize}
                disabled={getInputDisabled()}
                inputValue={userInput()}
                onInputChange={(value) => setUserInput(value)}
                onSubmit={handleSubmit}
                onMicrophoneClicked={onMicrophoneClicked}
                sendMessageSound={props.textInput?.sendMessageSound}
                sendSoundLocation={props.textInput?.sendSoundLocation}
                enableInputHistory={true}
                maxHistorySize={10}
              />
            )}
          </div>
          <Badge
            footer={props.footer}
            badgeBackgroundColor={props.badgeBackgroundColor}
            poweredByTextColor={props.poweredByTextColor}
            botContainer={botContainer}
          />
        </div>
      </div>
      {sourcePopupOpen() && <Popup isOpen={sourcePopupOpen()} value={sourcePopupSrc()} onClose={() => setSourcePopupOpen(false)} />}

      {disclaimerPopupOpen() && (
        <DisclaimerPopup
          isOpen={disclaimerPopupOpen()}
          onAccept={handleDisclaimerAccept}
          title={props.disclaimer?.title}
          message={props.disclaimer?.message}
          textColor={props.disclaimer?.textColor}
          buttonColor={props.disclaimer?.buttonColor}
          buttonText={props.disclaimer?.buttonText}
          buttonTextColor={props.disclaimer?.buttonTextColor}
          blurredBackgroundColor={props.disclaimer?.blurredBackgroundColor}
          backgroundColor={props.disclaimer?.backgroundColor}
          denyButtonBgColor={props.disclaimer?.denyButtonBgColor}
          denyButtonText={props.disclaimer?.denyButtonText}
          onDeny={props.closeBot}
          isFullPage={props.isFullPage}
        />
      )}
    </>
  );
};
