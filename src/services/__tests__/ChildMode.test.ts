/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { 
  generateAlignmentPrompt, 
  generateInverseAlignmentPrompt, 
  generatePortableMetadata,
  STEERING_LIBRARY,
  STEERING_LIBRARY_CHILD
} from '../../constants';
import { OceanScores } from '../../types';

const TEST_SCORES: OceanScores = {
  openness: 90,        // high
  conscientiousness: 10, // low
  extroversion: 50,
  agreeableness: 50,
  neuroticism: 50
};

describe('Child Mode Prompt Calibrations', () => {
  describe('generateAlignmentPrompt', () => {
    it('generates adult prompts using adult steering library', () => {
      const prompt = generateAlignmentPrompt(TEST_SCORES, 'adult');
      expect(prompt).toContain('calibrated to the user\'s psychological profile');
      expect(prompt).toContain(STEERING_LIBRARY[0].text); // high openness text
      expect(prompt).toContain(STEERING_LIBRARY[3].text); // low conscientiousness text
      expect(prompt).not.toContain(STEERING_LIBRARY_CHILD[0].text);
    });

    it('generates child prompts using child steering library and simple instructions', () => {
      const prompt = generateAlignmentPrompt(TEST_SCORES, 'child');
      expect(prompt).toContain('talking to a schoolchild (K-12)');
      expect(prompt).toContain('simple, engaging, friendly language');
      expect(prompt).toContain(STEERING_LIBRARY_CHILD[0].text); // child high openness text
      expect(prompt).toContain(STEERING_LIBRARY_CHILD[3].text); // child low conscientiousness text
      expect(prompt).not.toContain(STEERING_LIBRARY[0].text);
    });
  });

  describe('generateInverseAlignmentPrompt', () => {
    it('generates unaligned adult prompts with inverted steering directives', () => {
      const prompt = generateInverseAlignmentPrompt(TEST_SCORES, 'adult');
      expect(prompt).toContain('maximize the user\'s existing biases');
      expect(prompt).toContain(STEERING_LIBRARY[1].text); // inverted openness (low openness text)
      expect(prompt).toContain(STEERING_LIBRARY[2].text); // inverted conscientiousness (high conscientiousness text)
      expect(prompt).not.toContain(STEERING_LIBRARY_CHILD[1].text);
    });

    it('generates unaligned child prompts with inverted child steering directives', () => {
      const prompt = generateInverseAlignmentPrompt(TEST_SCORES, 'child');
      expect(prompt).toContain('maximize the child\'s existing biases');
      expect(prompt).toContain('simple, engaging, friendly language');
      expect(prompt).toContain(STEERING_LIBRARY_CHILD[1].text); // child inverted openness
      expect(prompt).toContain(STEERING_LIBRARY_CHILD[2].text); // child inverted conscientiousness
      expect(prompt).not.toContain(STEERING_LIBRARY[1].text);
    });
  });

  describe('generatePortableMetadata', () => {
    it('includes audience tag in portable metadata block', () => {
      const adultMeta = generatePortableMetadata(TEST_SCORES, 'adult');
      expect(adultMeta).toContain('Adult Mode');
      
      const childMeta = generatePortableMetadata(TEST_SCORES, 'child');
      expect(childMeta).toContain('K-12 Child Mode');
      expect(childMeta).toContain('simple, friendly language suitable for a child');
    });
  });
});
