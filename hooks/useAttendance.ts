import { useState, useEffect, useCallback } from 'react';
import { storeData, getData } from '@/utils/storage';

export type AttendanceRecord = {
  workerId: string;
  date: string;
  status: 'present' | 'absent' | 'half-day';
  folderName: string;
};

export function useAttendance() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [currentAttendance, setCurrentAttendance] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cache attendance by folder and date
  const attendanceCache = new Map<string, AttendanceRecord[]>();

  const loadAttendance = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [storedAttendance, storedCurrentAttendance] = await Promise.all([
        getData('attendance'),
        getData('currentAttendance')
      ]);

      if (storedAttendance) {
        setAttendance(storedAttendance);
      }
      if (storedCurrentAttendance) {
        setCurrentAttendance(storedCurrentAttendance);
      }
    } catch (error) {
      setError('Failed to load attendance data');
      console.error('Error loading attendance:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveAttendanceRecords = async (records: AttendanceRecord[]) => {
    try {
      // Update both current and permanent records
      const updatedCurrentAttendance = records;
      const updatedAttendance = [...attendance];

      // Remove any existing records for the same date and folder
      const key = (r: AttendanceRecord) => `${r.folderName}-${r.date}`;
      const recordKeys = new Set(records.map(key));
      
      const filteredAttendance = attendance.filter(record => 
        !recordKeys.has(key(record))
      );

      // Add new records
      const finalAttendance = [...filteredAttendance, ...records];

      // Save to storage
      await Promise.all([
        storeData('attendance', finalAttendance),
        storeData('currentAttendance', updatedCurrentAttendance)
      ]);

      // Update state
      setAttendance(finalAttendance);
      setCurrentAttendance(updatedCurrentAttendance);
    } catch (error) {
      console.error('Error saving attendance:', error);
      throw error;
    }
  };

  const getAttendanceByFolder = async (folderName: string, date: string) => {
    // Force load from storage first
    const storedAttendance = await getData('attendance');
    if (storedAttendance) {
      setAttendance(storedAttendance);
    }

    // If date is empty, return all records for the folder
    if (!date) {
      // Combine both current and permanent attendance records
      const allRecords = [...attendance, ...(storedAttendance || [])];
      return allRecords.filter(record => record.folderName === folderName);
    }

    // Check both permanent and current attendance
    const records = [...attendance, ...(storedAttendance || [])].filter(record => 
      record.folderName === folderName && 
      record.date === date
    );
    
    return records;
  };

  const getCurrentAttendance = useCallback(async (folderName: string, date: string): Promise<AttendanceRecord[]> => {
    const cacheKey = `${folderName}-${date}`;

    try {
      // First check current attendance state
      const currentRecords = currentAttendance.filter(record =>
        record.folderName === folderName &&
        record.date === date
      );

      if (currentRecords.length > 0) {
        return currentRecords;
      }

      // Then check permanent attendance records
      const permanentRecords = attendance.filter(record =>
        record.folderName === folderName &&
        record.date === date
      );

      if (permanentRecords.length > 0) {
        return permanentRecords;
      }

      // Finally check storage
      const storedAttendance = await getData('attendance');
      if (storedAttendance) {
        const records = storedAttendance.filter((record: AttendanceRecord) =>
          record.folderName === folderName &&
          record.date === date
        );
        
        if (records.length > 0) {
          setAttendance(storedAttendance);
          return records;
        }
      }

      return [];
    } catch (error) {
      console.error('Error getting attendance:', error);
      return [];
    }
  }, [attendance, currentAttendance]);

  const deleteRecordsByDate = async (folderName: string, date: string) => {
    const updatedRecords = attendance.filter(record => 
      !(record.folderName === folderName && record.date === date)
    );
    await storeData('attendance', updatedRecords);
    setAttendance(updatedRecords);
  };

  const deleteAllFolderRecords = async (folderName: string) => {
    const updatedRecords = attendance.filter(record => 
      record.folderName !== folderName
    );
    await storeData('attendance', updatedRecords);
    setAttendance(updatedRecords);
  };

  return {
    attendance,
    currentAttendance,
    isLoading,
    error,
    saveAttendanceRecords,
    getAttendanceByFolder,
    getCurrentAttendance,
    loadAttendance,
    deleteRecordsByDate,
    deleteAllFolderRecords
  };
}
