import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export async function teardown() {
  const tempFilePath = path.resolve(process.cwd(), '.tmp-test-docs.json');
  if (fs.existsSync(tempFilePath)) {
    try {
      const fileContent = fs.readFileSync(tempFilePath, 'utf8').trim();
      if (!fileContent) {
        return;
      }
      const docIds = JSON.parse(fileContent) as string[];
      if (docIds.length === 0) {
        return;
      }
      
      const dbId = process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "ai-studio-10d489d8-3b32-488a-9698-e415f2608028";
      console.log(`\n--- Global Teardown: Cleaning up ${docIds.length} test document(s) in Firestore ---`);
      for (const docId of docIds) {
        console.log(`Deleting feedback/${docId}...`);
        try {
          execSync(`npx -y firebase-tools@latest firestore:delete feedback/${docId} --database "${dbId}" -f`, {
            stdio: 'inherit',
          });
          console.log(`Successfully deleted feedback/${docId}`);
        } catch (err) {
          console.error(`Failed to delete feedback/${docId}:`, err);
        }
      }
      console.log('--- Global Teardown Complete ---\n');
    } catch (error) {
      console.error('Failed to parse or process temporary test document IDs:', error);
    } finally {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (err) {
        console.error('Failed to remove temporary test documents JSON file:', err);
      }
    }
  }
}
