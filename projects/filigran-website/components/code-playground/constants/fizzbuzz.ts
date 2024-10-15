export const testsFizzByzzCode = `
  import { fizzbuzz } from './utils';

  describe('Fizzbuzz test', () => {
    test("should print 1 if receive 1", () => {
        const result = fizzbuzz(1);
        expect(1).toBe(result);
      });
  });
`.trim()
