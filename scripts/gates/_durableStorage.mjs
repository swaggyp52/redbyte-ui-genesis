// Read committed bytes, not the in-memory cache or retained legacy migration source.
export async function readDurableRecord(page, key) {
  return page.evaluate((recordKey) => new Promise((resolve, reject) => {
    const request = indexedDB.open('redbyte-ide-sessions-v1', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('records')) {
        database.close();
        resolve(null);
        return;
      }
      const transaction = database.transaction('records', 'readonly');
      const record = transaction.objectStore('records').get(recordKey);
      transaction.oncomplete = () => { database.close(); resolve(record.result?.value ?? null); };
      transaction.onabort = () => { database.close(); reject(transaction.error); };
    };
  }), key);
}
