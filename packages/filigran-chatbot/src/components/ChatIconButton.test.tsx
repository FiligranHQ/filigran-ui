/**
 * The panel's icon-only control is the design system's IconButton with the
 * panel's tooltip - `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { act } from 'react';

import { installDom, settle } from '../../test/dom.ts';

installDom();
// After the page: react-dom reads at load whether it fires input events.
const { createRoot } = await import('react-dom/client');
const { ChatIconButton } = await import('./ChatIconButton.tsx');
const { CloseIcon, TrashIcon } = await import('./icons/index.tsx');

async function render(node: React.ReactNode) {
  const panel = document.createElement('div');
  panel.className = 'filigran-chatbot';
  document.body.appendChild(panel);
  const root = createRoot(panel);
  await act(async () => {
    root.render(node);
    await settle();
  });
  return panel;
}

test('an icon-only control is a design-system IconButton: tertiary, 36 px, named, its glyph hidden', async () => {
  let clicks = 0;
  const panel = await render(<ChatIconButton label="Close" icon={<CloseIcon size={20} />} onClick={() => (clicks += 1)} />);
  const button = panel.querySelector('button')!;
  assert.equal(button.getAttribute('aria-label'), 'Close');
  assert.equal(button.getAttribute('type'), 'button');
  const classes = button.className.split(/\s+/);
  for (const name of ['h-9', 'w-9', 'rounded-sm', 'text-icon-highlight', 'focus-visible:ring-2', 'focus-visible:ring-filigran-brand-primary']) {
    assert.ok(classes.includes(name), `${name} in ${button.className}`);
  }
  assert.equal(button.querySelector('span')!.getAttribute('aria-hidden'), 'true');
  await act(async () => {
    button.click();
    await settle();
  });
  assert.equal(clicks, 1);
});

test('a delete in a row is the destructive small IconButton, and a menu toggle says it is pressed', async () => {
  const panel = await render(
    <>
      <ChatIconButton label="Delete conversation" icon={<TrashIcon size={16} />} variant="destructive" size="sm" />
      <ChatIconButton label="Switch view" icon={<CloseIcon size={20} />} active aria-haspopup="menu" aria-expanded />
    </>,
  );
  const [remove, toggle] = [...panel.querySelectorAll('button')];
  assert.ok(remove.className.split(/\s+/).includes('h-6'));
  assert.ok(remove.className.split(/\s+/).includes('text-feedback-error-primary'));
  assert.equal(toggle.getAttribute('aria-pressed'), 'true');
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
});

test('over a scrim the control is the filled primary IconButton, and an end-call is the filled destructive one', async () => {
  const panel = await render(
    <>
      <ChatIconButton label="Download" icon={<CloseIcon size={20} />} priority="primary" />
      <ChatIconButton label="End voice call" icon={<CloseIcon size={20} />} priority="primary" variant="destructive" />
      <ChatIconButton label="Mute microphone" icon={<CloseIcon size={20} />} priority="secondary" />
    </>,
  );
  const [download, end, mute] = [...panel.querySelectorAll('button')].map((b) => b.className.split(/\s+/));
  assert.ok(download.includes('bg-filigran-brand-primary'), download.join(' '));
  assert.ok(end.includes('bg-feedback-error-primary'), end.join(' '));
  assert.ok(mute.includes('border'), mute.join(' '));
});

// The components migrated so far (chatbot 3.23.0, slice 2); the rest of the
// panel joins this list as it moves to ChatIconButton.
const MIGRATED = [
  'ChatHeader.tsx',
  'ConversationSidebar.tsx',
  'ClearAllConversations.tsx',
  'ReasoningDetailsDialog.tsx',
  'ChatNotice.tsx',
  'ChatImage.tsx',
  'ChatVoiceCall.tsx',
  'ChatInput.tsx',
  'PromptPicker.tsx',
  'ArtifactCard.tsx',
  'ChatApprovalPrompt.tsx',
  'ConversationListFailed.tsx',
  'ChatMessages.tsx',
  'MarkdownMessage.tsx',
];

// The text buttons migrated to the design system's Button (chatbot 3.23.0, slice 2).
const TEXT_BUTTONS = [
  'ArtifactCard.tsx',
  'ChatApprovalPrompt.tsx',
  'ConversationListFailed.tsx',
  'ChatThinking.tsx',
  'ChatWaitingPanel.tsx',
  'WorkingFiles.tsx',
  'ContextUsageIndicator.tsx',
  'ChatToggleButton.tsx',
  'ClearAllConversations.tsx',
  'ChatPanel.tsx',
];

for (const file of TEXT_BUTTONS) {
  test(`${file} draws no raw <button>: every text action is the design system's Button`, () => {
    const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /<button\b/, 'a raw <button> is left');
    assert.match(source, /from '@filigran\/design-system'/);
  });
}

for (const file of MIGRATED) {
  test(`${file} draws no hand-styled icon button: every icon-only control goes through ChatIconButton`, () => {
    // A button that is not an icon-only control (the voice call's avatar) says so
    // as its first attribute, `data-ds-exempt="<why>"`, and is listed in the audit table.
    const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8').replace(/<button\s+data-ds-exempt="[^"]+"/g, '<exempt');
    assert.doesNotMatch(source, /w-[78] h-[78] flex items-center justify-center/, 'a hand-styled icon button is left');
    assert.doesNotMatch(source, /<button[^>]*\saria-label=/, 'a raw <button> named only by aria-label is an icon-only control');
  });
}
