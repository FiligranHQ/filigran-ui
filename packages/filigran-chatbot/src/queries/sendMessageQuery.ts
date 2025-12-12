import { FileUpload, IAction } from '@/components/Bot';
import { sendRequest } from '@/utils/index';

export type IncomingInput = {
  question?: string;
  form?: Record<string, unknown>;
  uploads?: FileUpload[];
  overrideConfig?: Record<string, unknown>;
  socketIOClientId?: string;
  chatId?: string;
  fileName?: string; // Only for assistant
  leadEmail?: string;
  action?: IAction;
  humanInput?: Record<string, unknown>;
};

type BaseRequest = {
  apiHost?: string;
  onRequest?: (request: RequestInit) => Promise<void>;
};

export type MessageRequest = BaseRequest & {
  agenticUrl: string;
  body?: IncomingInput;
};

/** Health check, is the service alive ?
 * Response : { isStreaming: true  }
 * @param agenticUrl
 * @param onRequest
 */
export const isStreamAvailableQuery = ({ agenticUrl, onRequest }: MessageRequest) => {
  return sendRequest<any>({
    method: 'GET',
    url: agenticUrl.replace('prediction', 'chatflows-streaming'),
    onRequest: onRequest,
  });
};
