import { db } from '../../services/firebase';
import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { expect, test, describe } from 'vitest';

describe('Firestore Security Rules Integration (Live Database)', () => {
  test('writing to a restricted collection fails', async () => {
    // Attempts to write to a collection that should be completely restricted
    const restrictedRef = collection(db, '_restricted_test_collection');
    
    await expect(
      addDoc(restrictedRef, {
        test: 'data',
        timestamp: new Date(),
      })
    ).rejects.toThrow(/insufficient permissions|permission-denied/i);
  });

  test('writing to feedback with invalid schema fails', async () => {
    const feedbackRef = collection(db, 'feedback');

    // Missing email and message fields (which are required by our rules)
    await expect(
      addDoc(feedbackRef, {
        name: 'Invalid Test',
        timestamp: serverTimestamp(),
      })
    ).rejects.toThrow(/insufficient permissions|permission-denied/i);
  });

  test('reading from feedback fails', async () => {
    const feedbackRef = collection(db, 'feedback');

    // Users should not be able to read feedback documents to preserve privacy
    await expect(
      getDocs(feedbackRef)
    ).rejects.toThrow(/insufficient permissions|permission-denied/i);
  });
});
