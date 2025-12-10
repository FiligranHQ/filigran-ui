import { registerWebComponents } from './register';
import { parseChatbot, injectChatbotInWindow } from './window';
export { Bubble } from './features/bubble';

registerWebComponents();

export const chatbot = parseChatbot();

injectChatbotInWindow(chatbot);
