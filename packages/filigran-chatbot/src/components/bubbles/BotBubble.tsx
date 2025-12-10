import { createEffect, For, onMount, Show } from 'solid-js';
import { Avatar } from '../avatars/Avatar';
import { Marked } from '@ts-stack/markdown';
import { FileUpload, IAction, MessageType } from '../Bot';
import { AgentReasoningBubble } from './AgentReasoningBubble';
import { TickIcon, XIcon } from '../icons';
import { SourceBubble } from '../bubbles/SourceBubble';
import { DateTimeToggleTheme } from '@/features/bubble/types';
import { WorkflowTreeView } from '../treeview/WorkflowTreeView';

type Props = {
  message: MessageType;
  showAvatar?: boolean;
  avatarSrc?: string;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  isLoading: boolean;
  dateTimeToggle?: DateTimeToggleTheme;
  showAgentMessages?: boolean;
  sourceDocsTitle?: string;
  renderHTML?: boolean;
  handleActionClick: (elem: any, action: IAction | undefined | null) => void;
  handleSourceDocumentsClick: (src: any) => void;
};

const defaultBackgroundColor = '#f7f8ff';
const defaultTextColor = '#303235';
const defaultFontSize = 16;

export const BotBubble = (props: Props) => {
  let botDetailsEl: HTMLDetailsElement | undefined;

  Marked.setOptions({ isNoP: true, sanitize: props.renderHTML !== undefined ? !props.renderHTML : true });

  const setBotMessageRef = (el: HTMLSpanElement) => {
    if (el) {
      el.innerHTML = Marked.parse(props.message.message);

      // Apply textColor to all links, headings, and other markdown elements except code
      const textColor = props.textColor ?? defaultTextColor;
      el.querySelectorAll('a, h1, h2, h3, h4, h5, h6, strong, em, blockquote, li, th').forEach((element) => {
        (element as HTMLElement).style.color = textColor;
      });

      // Code blocks (with pre) get white text
      el.querySelectorAll('pre').forEach((element) => {
        (element as HTMLElement).style.color = '#FFFFFF';
        // Also ensure any code elements inside pre have white text
        element.querySelectorAll('code').forEach((codeElement) => {
          (codeElement as HTMLElement).style.color = '#FFFFFF';
        });
      });

      // Inline code (not in pre) gets green text
      el.querySelectorAll('code:not(pre code)').forEach((element) => {
        (element as HTMLElement).style.color = '#4CAF50'; // Green color
      });

      // Set target="_blank" for links
      el.querySelectorAll('a').forEach((link) => {
        link.target = '_blank';
      });
    }
  };

  const isValidURL = (url: string): URL | undefined => {
    try {
      return new URL(url);
    } catch (err) {
      return undefined;
    }
  };

  const removeDuplicateURL = (message: MessageType) => {
    const visitedURLs: string[] = [];
    const newSourceDocuments: any = [];

    message.sourceDocuments.forEach((source: any) => {
      if (isValidURL(source.metadata.source) && !visitedURLs.includes(source.metadata.source)) {
        visitedURLs.push(source.metadata.source);
        newSourceDocuments.push(source);
      } else if (!isValidURL(source.metadata.source)) {
        newSourceDocuments.push(source);
      }
    });
    return newSourceDocuments;
  };

  onMount(() => {
    if (botDetailsEl && props.isLoading) {
      botDetailsEl.open = true;
    }
  });

  createEffect(() => {
    if (botDetailsEl && props.isLoading) {
      botDetailsEl.open = true;
    } else if (botDetailsEl && !props.isLoading) {
      botDetailsEl.open = false;
    }
  });

  return (
    <div>
      <div class="flex flex-row justify-start mb-2 items-start host-container" style={{ 'margin-right': '50px' }}>
        <Show when={props.showAvatar}>
          <Avatar initialAvatarSrc={props.avatarSrc} />
        </Show>
        <div class="flex flex-col justify-start">
          {props.showAgentMessages &&
            props.message.agentFlowExecutedData &&
            Array.isArray(props.message.agentFlowExecutedData) &&
            props.message.agentFlowExecutedData.length > 0 && (
              <div>
                <WorkflowTreeView workflowData={props.message.agentFlowExecutedData} indentationLevel={24} />
              </div>
            )}
          {props.showAgentMessages && props.message.agentReasoning && (
            <details ref={botDetailsEl} class="mb-2 px-3 py-2 ml-2 chatbot-host-bubble rounded-[6px]">
              <summary class="cursor-pointer">
                <span class="italic">Agent Messages</span>
              </summary>
              <br />
              <For each={props.message.agentReasoning}>
                {(agent) => {
                  const agentMessages = agent.messages ?? [];
                  let msgContent = agent.instructions || (agentMessages.length > 1 ? agentMessages.join('\\n') : agentMessages[0]);
                  if (agentMessages.length === 0 && !agent.instructions) msgContent = `<p>Finished</p>`;
                  return (
                    <AgentReasoningBubble
                      agentName={agent.agentName ?? ''}
                      agentMessage={msgContent}
                      backgroundColor={props.backgroundColor}
                      textColor={props.textColor}
                      fontSize={props.fontSize}
                      renderHTML={props.renderHTML}
                    />
                  );
                }}
              </For>
            </details>
          )}
          {props.message.message && (
            <span
              ref={setBotMessageRef}
              class="px-3 py-2 ml-2 max-w-full chatbot-host-bubble prose"
              data-testid="host-bubble"
              style={{
                'background-color': props.backgroundColor ?? defaultBackgroundColor,
                color: props.textColor ?? defaultTextColor,
                'border-radius': '6px',
                'font-size': props.fontSize ? `${props.fontSize}px` : `${defaultFontSize}px`,
              }}
            />
          )}
          {props.message.action && (
            <div class="px-4 py-2 flex flex-row justify-start space-x-2">
              <For each={props.message.action.elements || []}>
                {(action) => {
                  return (
                    <>
                      {(action.type === 'approve-button' && action.label === 'Yes') || action.type === 'agentflowv2-approve-button' ? (
                        <button
                          type="button"
                          class="px-4 py-2 font-medium text-green-600 border border-green-600 rounded-full hover:bg-green-600 hover:text-white transition-colors duration-300 flex items-center space-x-2"
                          onClick={() => props.handleActionClick(action, props.message.action)}
                        >
                          <TickIcon />
                          &nbsp;
                          {action.label}
                        </button>
                      ) : (action.type === 'reject-button' && action.label === 'No') || action.type === 'agentflowv2-reject-button' ? (
                        <button
                          type="button"
                          class="px-4 py-2 font-medium text-red-600 border border-red-600 rounded-full hover:bg-red-600 hover:text-white transition-colors duration-300 flex items-center space-x-2"
                          onClick={() => props.handleActionClick(action, props.message.action)}
                        >
                          <XIcon isCurrentColor={true} />
                          &nbsp;
                          {action.label}
                        </button>
                      ) : (
                        <button>{action.label}</button>
                      )}
                    </>
                  );
                }}
              </For>
            </div>
          )}
        </div>
      </div>
      <div>
        {props.message.sourceDocuments && props.message.sourceDocuments.length && (
          <>
            <Show when={props.sourceDocsTitle}>
              <span class="px-2 py-[10px] font-semibold">{props.sourceDocsTitle}</span>
            </Show>
            <div style={{ display: 'flex', 'flex-direction': 'row', width: '100%', 'flex-wrap': 'wrap' }}>
              <For each={[...removeDuplicateURL(props.message)]}>
                {(src) => {
                  const URL = isValidURL(src.metadata.source);
                  return (
                    <SourceBubble
                      pageContent={URL ? URL.pathname : src.pageContent}
                      onSourceClick={() => {
                        if (URL) {
                          window.open(src.metadata.source, '_blank');
                        } else {
                          props.handleSourceDocumentsClick(src);
                        }
                      }}
                    />
                  );
                }}
              </For>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
