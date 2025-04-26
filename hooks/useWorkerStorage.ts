import { useState, useEffect } from 'react';
import { storeData, getData } from './useLocalStorage';

export type Worker = {
  id: string;
  name: string;
  phone: string;
  folders: string[];
};

export function useWorkerStorage() {
  const [workers, setWorkers] = useState<Worker[]>([]);

  useEffect(() => {
    loadWorkers();
  }, []);

  const loadWorkers = async () => {
    const storedWorkers = await getData('workers');
    if (storedWorkers) {
      setWorkers(storedWorkers);
    }
  };

  const saveWorker = async (worker: Omit<Worker, 'id'>) => {
    const newWorker = {
      ...worker,
      id: Date.now().toString(),
    };
    const updatedWorkers = [...workers, newWorker];
    setWorkers(updatedWorkers);
    await storeData('workers', updatedWorkers);
    return newWorker;
  };

  const getWorkersByFolder = (folderName: string) => {
    return workers.filter(worker => worker.folders.includes(folderName));
  };

  return {
    workers,
    saveWorker,
    getWorkersByFolder
  };
}
