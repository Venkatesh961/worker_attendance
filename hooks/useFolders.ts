import { useState, useEffect } from 'react';
import { storeData, getData } from './useLocalStorage';

export type WorkFolder = {
  id: string;
  name: string;
  createdAt: Date;
  isDefault?: boolean;
};

export function useFolders() {
  const [folders, setFolders] = useState<WorkFolder[]>([
    {
      id: 'default',
      name: 'Default',
      createdAt: new Date(),
      isDefault: true
    }
  ]);

  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    const storedFolders = await getData('folders');
    if (storedFolders) {
      setFolders(storedFolders.map((f: any) => ({
        ...f,
        createdAt: new Date(f.createdAt)
      })));
    }
  };

  const validateFolderName = (name: string, excludeFolderId?: string) => {
    const exists = folders.some(f => 
      f.name.toLowerCase() === name.toLowerCase() && 
      f.id !== excludeFolderId
    );
    if (exists) {
      throw new Error(`A folder with name "${name}" already exists`);
    }
  };

  const updateFolders = async (newFolders: WorkFolder[]) => {
    // Check for duplicate names in new folders
    const names = newFolders.map(f => f.name.toLowerCase());
    const hasDuplicates = names.length !== new Set(names).size;
    if (hasDuplicates) {
      throw new Error("Duplicate folder names are not allowed");
    }
    setFolders(newFolders);
    await storeData('folders', newFolders);
  };

  const deleteFolder = async (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (folder?.isDefault) {
      throw new Error("Default folder cannot be deleted");
    }
    const updatedFolders = folders.filter(f => f.id !== folderId);
    await updateFolders(updatedFolders);
  };

  const renameFolder = async (folderId: string, newName: string) => {
    // Validate new name doesn't exist
    validateFolderName(newName, folderId);
    
    const updatedFolders = folders.map(f => 
      f.id === folderId 
        ? { ...f, name: newName }
        : f
    );
    await updateFolders(updatedFolders);
  };

  return {
    folders,
    setFolders: updateFolders,
    deleteFolder,
    loadFolders,
    renameFolder
  };
}
