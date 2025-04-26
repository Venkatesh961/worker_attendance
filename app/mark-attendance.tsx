import { useState, useEffect } from 'react';
import { StyleSheet, FlatList, Pressable, View, Modal, Platform, Alert, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFolders } from '@/hooks/useFolders';
import { useWorkers } from '@/hooks/useWorkers';
import { useAttendance } from '@/hooks/useAttendance';
import { getData, storeData } from '@/utils/storage';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

type AttendanceStatus = 'absent' | 'present' | 'half-day';

type AttendanceRecord = {
  workerId: string;
  date: string;
  status: AttendanceStatus;
  folderName: string;
};

type Worker = {
  id: string;
  name: string;
  status: AttendanceStatus;
};

type AttendanceWorker = {
  id: string;
  name: string;
  status: AttendanceStatus;
  folders: string[];
};

type Props = {
  route?: { params?: { workFolder?: string } };
};

export default function MarkAttendanceScreen({ route }: Props) {
  const { folders } = useFolders();
  const { getWorkersByFolder } = useWorkers();
  const { getAttendanceByFolder, saveAttendanceRecords, getCurrentAttendance } = useAttendance();
  const [selectedFolder, setSelectedFolder] = useState(route?.params?.workFolder || 'Default');
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSubmitFolders, setSelectedSubmitFolders] = useState<string[]>([]);
  const [showSubmitFolderPicker, setShowSubmitFolderPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(true);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(true);
  const [shouldReload, setShouldReload] = useState(0);
  const [isDateManuallySelected, setIsDateManuallySelected] = useState(false);

  useEffect(() => {
    const initializeData = async () => {
      try {
        const [savedDate, savedFolder] = await Promise.all([
          getData('selectedDate'),
          getData('selectedFolder')
        ]);
        
        // Always set today's date on initial load
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        setSelectedDate(today);
        
        if (savedFolder) {
          setSelectedFolder(savedFolder);
        }
        
        await loadData();
      } catch (error) {
        console.error('Error initializing data:', error);
      }
    };

    initializeData();
  }, []); 

  useEffect(() => {
    const saveState = async () => {
      if (!selectedDate || !selectedFolder) return;
      
      await Promise.all([
        storeData('selectedDate', selectedDate.toISOString()),
        storeData('selectedFolder', selectedFolder)
      ]);
    };
    saveState();
  }, [selectedDate, selectedFolder]);

  useEffect(() => {
    loadData();
  }, [selectedFolder, selectedDate, shouldReload]);

  useEffect(() => {
    const checkDateChange = () => {
      // Only auto-update date if user hasn't manually selected one
      if (!isDateManuallySelected) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const currentDate = now.getTime();
        const selectedDateNormalized = new Date(selectedDate).setHours(0, 0, 0, 0);
        
        if (currentDate !== selectedDateNormalized) {
          setSelectedDate(now);
          setShouldReload(prev => prev + 1);
        }
      }
    };

    // Check immediately on component mount
    checkDateChange();

    // Set up interval to check every minute
    const interval = setInterval(checkDateChange, 60000);

    return () => clearInterval(interval);
  }, [selectedDate, isDateManuallySelected]);

  const loadData = async () => {
    if (!selectedFolder) return;
    
    setIsLoadingWorkers(true);
    setIsLoadingAttendance(true);

    try {
      const folderWorkers = getWorkersByFolder(selectedFolder);
      const dateStr = selectedDate.toISOString().split('T')[0];
      
      setIsLoadingWorkers(false);

      const existingAttendance = await getCurrentAttendance(selectedFolder, dateStr);
      
      const workersWithStatus = folderWorkers.map(worker => ({
        ...worker,
        status: existingAttendance.find(a => 
          a.workerId === worker.id && 
          a.date === dateStr
        )?.status || 'absent'
      }));

      setWorkers(workersWithStatus);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load attendance data');
    } finally {
      setIsLoadingAttendance(false);
    }
  };

  const setAttendanceStatus = (workerId: string, newStatus: AttendanceStatus) => {
    setWorkers(workers.map(worker => 
      worker.id === workerId 
        ? { ...worker, status: newStatus }
        : worker
    ));
  };

  const handleDateChange = async (event: any, selected?: Date) => {
    if (event.type === 'set' && selected) {
      setIsDateManuallySelected(true); // Track that user manually selected a date
      setSelectedDate(selected);
      setShouldReload(prev => prev + 1);
      if (Platform.OS === 'android') {
        setShowDatePicker(false);
      }
    } else if (event.type === 'dismissed') {
      setShowDatePicker(false);
    }
  };

  const getStatusColors = (status: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return { bg: '#e6f7ef', border: '#0a7ea4', text: '#0a7ea4' };
      case 'half-day':
        return { bg: '#fef3c7', border: '#f59e0b', text: '#f59e0b' };
      case 'absent':
        return { bg: '#fee2e2', border: '#dc2626', text: '#dc2626' };
    }
  };

  const toggleFolderSelection = (folderName: string) => {
    setSelectedFolder(folderName);
    setShowFolderPicker(false);
  };

  const toggleSubmitFolderSelection = (folderName: string) => {
    setSelectedSubmitFolders(prev => {
      if (prev.includes(folderName)) {
        return prev.filter(f => f !== folderName);
      }
      return [...prev, folderName];
    });
  };

  const handleSubmit = async () => {
    if (selectedSubmitFolders.length === 0) {
      setSelectedSubmitFolders([selectedFolder]);
      setShowSubmitFolderPicker(true);
      return;
    }

    setIsSubmitting(true);
    
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const attendanceRecords = workers.flatMap(worker => 
        selectedSubmitFolders.map(folder => ({
          workerId: worker.id,
          date: dateStr,
          status: worker.status,
          folderName: folder
        }))
      );
      
      await saveAttendanceRecords(attendanceRecords);
      
      setShowSubmitFolderPicker(false);
      setSelectedSubmitFolders([]);
      Alert.alert(
        'Success',
        `Attendance saved for ${selectedSubmitFolders.join(', ')}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error saving attendance:', error);
      Alert.alert('Error', 'Failed to save attendance');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.header}>
          <ThemedText style={styles.title}>Mark Attendance</ThemedText>
          
          <Pressable 
            style={styles.folderSelector}
            onPress={() => setShowFolderPicker(true)}>
            <ThemedView style={styles.folderInfo}>
              <MaterialIcons 
                name="folder" 
                size={24} 
                color="#0a7ea4" 
              />
              <ThemedText style={styles.folderName}>{selectedFolder}</ThemedText>
            </ThemedView>
            <MaterialIcons name="arrow-drop-down" size={24} color="#687076" />
          </Pressable>

          <Pressable 
            style={styles.dateSelector}
            onPress={() => setShowDatePicker(true)}>
            <ThemedText style={styles.date}>
              {selectedDate.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </ThemedText>
            <MaterialIcons name="calendar-today" size={24} color="#687076" />
          </Pressable>
          
          {showDatePicker && (
            Platform.OS === 'ios' ? (
              <Modal
                animationType="slide"
                transparent={true}
                visible={showDatePicker}>
                <View style={styles.modalOverlay}>
                  <View style={[styles.modalContent, { height: 400 }]}>
                    <ThemedView style={styles.modalHeader}>
                      <ThemedText style={styles.modalTitle}>Select Date</ThemedText>
                      <Pressable 
                        onPress={() => setShowDatePicker(false)}
                        style={styles.modalCloseButton}>
                        <MaterialIcons name="check" size={24} color="#0a7ea4" />
                      </Pressable>
                    </ThemedView>
                    <DateTimePicker
                      value={selectedDate}
                      mode="date"
                      display="spinner"
                      onChange={handleDateChange}
                      style={{ 
                        width: '100%',
                        backgroundColor: 'white',
                        height: 300,
                      }}
                      textColor="#000000"
                    />
                  </View>
                </View>
              </Modal>
            ) : (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="default"
                onChange={handleDateChange}
              />
            )
          )}

          <ThemedText style={styles.stats}>
            Present: {workers.filter(w => w.status === 'present').length} | 
            Half Day: {workers.filter(w => w.status === 'half-day').length} | 
            Absent: {workers.filter(w => w.status === 'absent').length}
          </ThemedText>
        </ThemedView>

        <FlatList
          data={workers}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            isLoadingWorkers || isLoadingAttendance ? (
              <ThemedView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0a7ea4" />
                <ThemedText style={styles.loadingText}>
                  {isLoadingWorkers ? 'Loading workers...' : 'Loading attendance...'}
                </ThemedText>
              </ThemedView>
            ) : (
              <ThemedText style={styles.emptyText}>No workers in this folder</ThemedText>
            )
          }
          renderItem={({ item }) => (
            <ThemedView style={[
              styles.workerCard,
              { backgroundColor: getStatusColors(item.status).bg }
            ]}>
              <ThemedText style={styles.workerName}>{item.name}</ThemedText>
              <ThemedView style={styles.statusButtons}>
                <Pressable
                  style={[styles.statusButton, 
                    item.status === 'present' && {
                      backgroundColor: getStatusColors('present').border
                    },
                    { borderColor: getStatusColors('present').border }
                  ]}
                  onPress={() => setAttendanceStatus(item.id, 'present')}>
                  <MaterialIcons 
                    name="check-circle"
                    size={20} 
                    color={item.status === 'present' ? '#fff' : getStatusColors('present').text} 
                  />
                  <ThemedText style={[
                    styles.statusButtonText,
                    { color: item.status === 'present' ? '#fff' : getStatusColors('present').text }
                  ]}>Present</ThemedText>
                </Pressable>

                <Pressable
                  style={[styles.statusButton, 
                    item.status === 'half-day' && {
                      backgroundColor: getStatusColors('half-day').border
                    },
                    { borderColor: getStatusColors('half-day').border }
                  ]}
                  onPress={() => setAttendanceStatus(item.id, 'half-day')}>
                  <MaterialIcons 
                    name="timelapse"
                    size={20} 
                    color={item.status === 'half-day' ? '#fff' : getStatusColors('half-day').text}
                  />
                  <ThemedText style={[
                    styles.statusButtonText,
                    { color: item.status === 'half-day' ? '#fff' : getStatusColors('half-day').text }
                  ]}>Half Day</ThemedText>
                </Pressable>

                <Pressable
                  style={[styles.statusButton, 
                    item.status === 'absent' && {
                      backgroundColor: getStatusColors('absent').border
                    },
                    { borderColor: getStatusColors('absent').border }
                  ]}
                  onPress={() => setAttendanceStatus(item.id, 'absent')}>
                  <MaterialIcons 
                    name="close"
                    size={20} 
                    color={item.status === 'absent' ? '#fff' : getStatusColors('absent').text}
                  />
                  <ThemedText style={[
                    styles.statusButtonText,
                    { color: item.status === 'absent' ? '#fff' : getStatusColors('absent').text }
                  ]}>Absent</ThemedText>
                </Pressable>
              </ThemedView>
            </ThemedView>
          )}
        />

        <Pressable 
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={() => setShowSubmitFolderPicker(true)}
          disabled={isSubmitting}>
          <ThemedText style={styles.submitButtonText}>
            {isSubmitting ? 'Submitting...' : 'Submit Attendance'}
          </ThemedText>
        </Pressable>

        <Modal
          animationType="slide"
          transparent={true}
          visible={showSubmitFolderPicker}
          onRequestClose={() => setShowSubmitFolderPicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ThemedView style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Select Folders to Submit</ThemedText>
                <Pressable onPress={() => setShowSubmitFolderPicker(false)}>
                  <MaterialIcons name="close" size={24} color="#687076" />
                </Pressable>
              </ThemedView>

              <FlatList
                data={folders}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Pressable
                    style={[
                      styles.folderItem,
                      selectedSubmitFolders.includes(item.name) && styles.folderItemSelected,
                      item.isDefault && styles.defaultFolder
                    ]}
                    onPress={() => toggleSubmitFolderSelection(item.name)}>
                    <ThemedView style={styles.folderInfo}>
                      <MaterialIcons 
                        name={item.isDefault ? "folder-special" : "folder"} 
                        size={24} 
                        color={item.isDefault ? "#f59e0b" : "#0a7ea4"} 
                      />
                      <ThemedText style={styles.folderName}>{item.name}</ThemedText>
                      {item.isDefault && (
                        <ThemedText style={styles.defaultTag}>Default</ThemedText>
                      )}
                    </ThemedView>
                    {selectedSubmitFolders.includes(item.name) && (
                      <MaterialIcons name="check-circle" size={24} color="#0a7ea4" />
                    )}
                  </Pressable>
                )}
              />

              <ThemedText style={styles.selectedCount}>
                {selectedSubmitFolders.length} folder{selectedSubmitFolders.length !== 1 ? 's' : ''} selected
              </ThemedText>

              <Pressable 
                style={[styles.confirmButton, selectedSubmitFolders.length === 0 && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={selectedSubmitFolders.length === 0}>
                <ThemedText style={styles.submitButtonText}>
                  Confirm & Submit
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal
          animationType="slide"
          transparent={true}
          visible={showFolderPicker}
          onRequestClose={() => setShowFolderPicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ThemedView style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Select Work Folder</ThemedText>
                <Pressable onPress={() => setShowFolderPicker(false)}>
                  <MaterialIcons name="close" size={24} color="#687076" />
                </Pressable>
              </ThemedView>

              <FlatList
                data={folders}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Pressable
                    style={[
                      styles.folderItem,
                      selectedFolder === item.name && styles.folderItemSelected,
                      item.isDefault && styles.defaultFolder
                    ]}
                    onPress={() => toggleFolderSelection(item.name)}>
                    <ThemedView style={styles.folderInfo}>
                      <MaterialIcons 
                        name={item.isDefault ? "folder-special" : "folder"} 
                        size={24} 
                        color={item.isDefault ? "#f59e0b" : "#0a7ea4"} 
                      />
                      <ThemedText style={styles.folderName}>{item.name}</ThemedText>
                      {item.isDefault && (
                        <ThemedText style={styles.defaultTag}>Default</ThemedText>
                      )}
                    </ThemedView>
                    {selectedFolder === item.name && (
                      <MaterialIcons name="check-circle" size={24} color="#0a7ea4" />
                    )}
                  </Pressable>
                )}
              />
            </View>
          </View>
        </Modal>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    padding: 20,
    paddingTop:10,
    
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 14,
    textAlign: 'center',
  },
  date: {
    fontSize: 20,
    fontWeight: '600',
  },
  stats: {
    fontSize: 16,
    color: '#687076',
    marginTop: 4,
  },
  workerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statusButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 12,
  },
  statusButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  submitButton: {
    backgroundColor: '#0a7ea4',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#93c5fd',
    opacity: 0.8,
  },
  dateSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    padding: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  workerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e4e8',
  },
  folderItemSelected: {
    backgroundColor: '#f0f9ff',
  },
  folderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  defaultFolder: {
    backgroundColor: '#fffbeb',
  },
  defaultTag: {
    fontSize: 12,
    color: '#f59e0b',
    marginLeft: 8,
  },
  folderName: {
    fontSize: 16,
    fontWeight: '500',
  },
  confirmButton: {
    backgroundColor: '#0a7ea4',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  folderSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e1e4e8',
    borderRadius: 12,
    marginBottom: 8,
  },
  selectedCount: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#687076',
    textAlign: 'center',
    marginTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#687076',
    fontSize: 16,
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
