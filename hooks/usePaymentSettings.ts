import { useState, useEffect } from 'react';
import { storeData, getData } from './useLocalStorage';

export type PaymentRates = {
  fullDay: string;
  halfDay: string;
};

export type FolderRates = {
  [folderName: string]: PaymentRates;
};

export function usePaymentSettings() {
  const [folderRates, setFolderRates] = useState<FolderRates>({
    'Default': {
      fullDay: '500',
      halfDay: '250'
    }
  });

  useEffect(() => {
    loadRates();
  }, []);

  const loadRates = async () => {
    const storedRates = await getData('folderRates');
    if (storedRates) {
      setFolderRates(storedRates);
    }
  };

  const updateFolderRates = async (folderName: string, rates: PaymentRates) => {
    const newRates = {
      ...folderRates,
      [folderName]: rates
    };
    setFolderRates(newRates);
    await storeData('folderRates', newRates);
  };

  return {
    folderRates,
    updateFolderRates
  };
}
