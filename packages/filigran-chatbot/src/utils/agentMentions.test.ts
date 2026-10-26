/**
 * Unit tests for mentioning agents with `@` in the composer - `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { agentCandidates, agentMentionKey, mentionedAgentIds, pruneAgentMentions, withAgentMention } from './agentMentions.ts';

const agent = (id: string, name: string, slug: string | null = null) => ({ id, name, slug, icon: null, description: null });

test("an agent's key is its slug when it reads back as one token, else its name hyphenated", () => {
  assert.equal(agentMentionKey(agent('a', 'Threat Hunter', 'threat-hunter')), 'threat-hunter');
  assert.equal(agentMentionKey(agent('a', 'Threat Hunter', 'not a slug')), 'threat-hunter');
  assert.equal(agentMentionKey(agent('a', 'Réponse à incident')), 'r-ponse-incident');
  assert.equal(agentMentionKey(agent('a', '!!!')), null);
});

test('the menu offers the agents the typed text finds, by key or by name', () => {
  const agents = [agent('1', 'Threat Hunter', 'hunter'), agent('2', 'Report Writer', 'writer'), agent('3', 'Hunting Coach', 'coach')];
  assert.deepEqual(
    agentCandidates(agents, 'hunt').map((m) => m.agentId),
    ['1', '3'],
  );
  assert.deepEqual(
    agentCandidates(agents, 'report wr').map((m) => m.key),
    ['writer'],
  );
  assert.equal(agentCandidates(agents, '').length, 3);
});

test('a mention lasts while its @key is in the text, and is sent in mention order', () => {
  const hunter = { agentId: '1', name: 'Hunter', key: 'hunter' };
  const writer = { agentId: '2', name: 'Writer', key: 'writer' };
  const mentions = withAgentMention(withAgentMention([hunter], writer), hunter);
  assert.equal(mentions.length, 2);
  assert.deepEqual(mentionedAgentIds(mentions, 'ask @writer then @hunter and @writer'), ['2', '1']);
  assert.deepEqual(pruneAgentMentions(mentions, 'only @hunter'), [hunter]);
  assert.equal(pruneAgentMentions(mentions, '@hunter @writer'), mentions);
  assert.deepEqual(mentionedAgentIds(mentions, 'mail me at bob@hunter.test'), []);
});
