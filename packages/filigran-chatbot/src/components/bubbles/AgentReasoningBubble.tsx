import { For, onMount } from 'solid-js';
import { Marked } from '@ts-stack/markdown';
import { FileUpload } from '../Bot';
import { cloneDeep } from 'lodash';

type Props = {
  agentName: string;
  agentMessage: string;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  renderHTML?: boolean;
};

const defaultBackgroundColor = '#f7f8ff';
const defaultTextColor = '#303235';
const defaultFontSize = 16;

export const AgentReasoningBubble = (props: Props) => {
  let botMessageEl: HTMLDivElement | undefined;
  Marked.setOptions({ isNoP: true, sanitize: props.renderHTML !== undefined ? !props.renderHTML : true });

  onMount(() => {
    if (botMessageEl) {
      botMessageEl.innerHTML = Marked.parse(`**✅ ${props.agentName}** \n\n${props.agentMessage}`);
      botMessageEl.querySelectorAll('a').forEach((link) => {
        link.target = '_blank';
      });
    }
  });

  return (
    <div class="mb-6">
      {props.agentMessage && (
        <span
          ref={botMessageEl}
          class="prose"
          style={{
            'background-color': props.backgroundColor ?? defaultBackgroundColor,
            color: props.textColor ?? defaultTextColor,
            'font-size': props.fontSize ? `${props.fontSize}px` : `${defaultFontSize}px`,
          }}
        />
      )}
    </div>
  );
};
