import { useState, useEffect } from 'react';
import { storeData, getData } from './useLocalStorage';

export type Worker = {
  id: string;
  name: string;
  folders: string[];
};

export function useWorkers() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWorkers();
  }, []);

  const loadWorkers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const storedWorkers = await getData('workers');
      if (storedWorkers) {
        setWorkers(storedWorkers);
      }
    } catch (err) {
      setError('Failed to load workers');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const isDuplicateInFolder = (name: string, folderName: string) => {
    return workers.some(worker => 
      worker.folders.includes(folderName) && 
      worker.name.toLowerCase() === name.toLowerCase()
    );
  };

  const getWorkersByFolder = (folderName: string) => {
    return workers.filter(worker => worker.folders.includes(folderName));
  };

  const addWorker = async (name: string, folders: string[]) => {
    // Check for duplicates in each folder
    for (const folder of folders) {
      if (isDuplicateInFolder(name.trim(), folder)) {
        throw new Error(`Worker "${name}" already exists in folder "${folder}"`);
      }
    }

    const newWorker = {
      id: Date.now().toString(),
      name: name.trim(),
      folders
    };

    const updatedWorkers = [...workers, newWorker];
    setWorkers(updatedWorkers);
    await storeData('workers', updatedWorkers);
    return newWorker;
  };

  const deleteWorker = async (workerId: string) => {
    const updatedWorkers = workers.filter(w => w.id !== workerId);
    setWorkers(updatedWorkers);
    await storeData('workers', updatedWorkers);
  };

  const editWorker = async (workerId: string, newName: string) => {
    const updatedWorkers = workers.map(worker => 
      worker.id === workerId 
        ? { ...worker, name: newName }
        : worker
    );
    setWorkers(updatedWorkers);
    await storeData('workers', updatedWorkers);
  };

  const deleteMultipleWorkers = async (workerIds: string[]) => {
    const updatedWorkers = workers.filter(w => !workerIds.includes(w.id));
    setWorkers(updatedWorkers);
    await storeData('workers', updatedWorkers);
  };

  return {
    workers,
    isLoading,
    error,
    setWorkers,
    getWorkersByFolder,
    addWorker,
    loadWorkers,
    deleteWorker,
    editWorker,
    deleteMultipleWorkers
  };
}
