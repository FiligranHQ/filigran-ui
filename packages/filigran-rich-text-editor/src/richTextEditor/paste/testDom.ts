import { JSDOM } from 'jsdom';

const { window } = new JSDOM('');

Object.assign(globalThis, { DOMParser: window.DOMParser, NodeFilter: window.NodeFilter });

export const parseHtml = (html: string): Document => new window.DOMParser().parseFromString(html, 'text/html');
