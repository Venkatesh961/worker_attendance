import { useState, useEffect } from 'react';
import { StyleSheet, FlatList, Pressable, View, Modal, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useWorkers } from '@/hooks/useWorkers';
import { usePaymentSettings } from '@/hooks/usePaymentSettings';
import { useAttendance } from '@/hooks/useAttendance';
import React from 'react';

type WorkerWithAttendance = {
  id: string;
  name: string;
  attendanceStatus: 'present' | 'absent' | 'half-day' | 'Not marked';
};

export default function FolderDetailsScreen() {
  const { folderName } = useLocalSearchParams();
  const router = useRouter();
  const { getWorkersByFolder } = useWorkers();
  const { folderRates } = usePaymentSettings();
  const { getCurrentAttendance, getAttendanceByFolder, loadAttendance, deleteRecordsByDate, deleteAllFolderRecords } = useAttendance();
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [showDateList, setShowDateList] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [folderWorkers, setFolderWorkers] = useState<WorkerWithAttendance[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const rates = folderRates[folderName as string] || folderRates['Default'];

  useFocusEffect(
    React.useCallback(() => {
      const loadInitialData = async () => {
        setIsLoading(true);
        await loadAttendance();
        await loadAvailableDates();
        setIsLoading(false);
      };

      loadInitialData();
    }, [folderName])
  );

  useEffect(() => {
    loadAttendance();
    loadAvailableDates();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      loadFolderData();
    }
  }, [selectedDate]);

  const loadAvailableDates = async () => {
    try {
      const allAttendance = await getAttendanceByFolder(folderName as string, '');
      const dates = [...new Set(allAttendance.map(record => record.date))]
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      
      setAvailableDates(dates);
      if (dates.length > 0) {
        setSelectedDate(dates[0]);
        loadFolderData();
      }
    } catch (error) {
      console.error('Error loading dates:', error);
    }
  };

  const loadFolderData = async () => {
    setIsLoading(true);
    try {
      const attendance = await getCurrentAttendance(folderName as string, selectedDate);
      const workers = getWorkersByFolder(folderName as string);

      const workersWithAttendance: WorkerWithAttendance[] = workers.map(worker => {
        const workerAttendance = attendance.find(a => a.workerId === worker.id);
        return {
          id: worker.id,
          name: worker.name,
          attendanceStatus: (workerAttendance?.status || 'Not marked') as WorkerWithAttendance['attendanceStatus']
        };
      });

      setFolderWorkers(workersWithAttendance);
    } catch (error) {
      console.error('Error loading folder data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadAttendance();
      await loadAvailableDates();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeleteRecords = () => {
    Alert.alert(
      "Delete Records",
      "Choose what to delete",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Current Date",
          onPress: async () => {
            if (!selectedDate) return;
            await deleteRecordsByDate(folderName as string, selectedDate);
            await loadAvailableDates();
          }
        },
        {
          text: "All Records",
          style: "destructive",
          onPress: async () => {
            await deleteAllFolderRecords(folderName as string);
            await loadAvailableDates();
          }
        }
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return '#0a7ea4';
      case 'half-day': return '#f59e0b';
      case 'absent': return '#dc2626';
      default: return '#687076';
    }
  };

  const renderDatePickerModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showDateList}
      onRequestClose={() => setShowDateList(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ThemedView style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Available Records</ThemedText>
            <Pressable onPress={() => setShowDateList(false)}>
              <MaterialIcons name="close" size={24} color="#687076" />
            </Pressable>
          </ThemedView>

          <FlatList
            data={availableDates}
            keyExtractor={(date) => date}
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.dateItem,
                  selectedDate === item && styles.dateItemSelected
                ]}
                onPress={() => {
                  setSelectedDate(item);
                  setShowDateList(false);
                }}>
                <ThemedText style={styles.dateText}>
                  {new Date(item).toLocaleDateString()}
                </ThemedText>
                {selectedDate === item && (
                  <MaterialIcons name="check" size={24} color="#0a7ea4" />
                )}
              </Pressable>
            )}
            ListEmptyComponent={
              <ThemedText style={styles.emptyText}>No attendance records found</ThemedText>
            }
          />
        </View>
      </View>
    </Modal>
  );

  const renderEmptyComponent = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingState}>
          <ActivityIndicator size="large" color="#0a7ea4" />
          <ThemedText style={styles.loadingText}>Loading attendance records...</ThemedText>
        </ThemedView>
      );
    }
    return (
      <ThemedText style={styles.emptyText}>
        {availableDates.length === 0 ? 'No attendance records found' : 'No workers in this folder'}
      </ThemedText>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.header}>
          <Pressable 
            style={styles.backButton} 
            onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color="#687076" />
          </Pressable>
          <ThemedView style={styles.titleContainer}>
            <MaterialIcons 
              name="folder" 
              size={24} 
              color="#0a7ea4" 
            />
            <ThemedText style={styles.title}>{folderName}</ThemedText>
          </ThemedView>
          <Pressable 
            style={styles.refreshButton}
            onPress={handleRefresh}
            disabled={isRefreshing}>
            <MaterialIcons 
              name="refresh" 
              size={24} 
              color={isRefreshing ? "#93c5fd" : "#0a7ea4"} 
            />
          </Pressable>
          <Pressable 
            style={styles.deleteButton}
            onPress={handleDeleteRecords}>
            <MaterialIcons name="delete" size={24} color="#dc2626" />
          </Pressable>
        </ThemedView>

        <ThemedView style={styles.content}>
          <Pressable 
            style={styles.dateSelector}
            onPress={() => setShowDateList(true)}>
            <ThemedText style={styles.date}>
              {selectedDate ? new Date(selectedDate).toLocaleDateString() : 'Select Date'}
            </ThemedText>
            <MaterialIcons name="arrow-drop-down" size={24} color="#687076" />
          </Pressable>

          <ThemedView style={styles.ratesInfo}>
            <ThemedText style={styles.rateText}>
              Full Day: ₹{rates.fullDay} | Half Day: ₹{rates.halfDay}
            </ThemedText>
          </ThemedView>

          <ThemedText style={styles.sectionTitle}>Workers</ThemedText>
          <FlatList
            data={folderWorkers}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ThemedView style={styles.workerItem}>
                <ThemedText style={styles.workerName}>{item.name}</ThemedText>
                <ThemedText style={[
                  styles.attendanceStatus,
                  { color: getStatusColor(item.attendanceStatus) }
                ]}>
                  {item.attendanceStatus}
                </ThemedText>
              </ThemedView>
            )}
            ListEmptyComponent={renderEmptyComponent()}
          />

          {availableDates.length === 0 && !isLoading && (
            <Pressable 
              style={styles.fetchButton} 
              onPress={handleRefresh}>
              <ThemedText style={styles.fetchButtonText}>
                Fetch Available Records
              </ThemedText>
            </Pressable>
          )}
        </ThemedView>

        {renderDatePickerModal()}
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e4e8',
  },
  backButton: {
    marginRight: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  refreshButton: {
    padding: 8,
    marginLeft: 'auto',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 'auto',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  dateSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e1e4e8',
    borderRadius: 12,
    marginBottom: 12,
  },
  date: {
    fontSize: 16,
    color: '#333',
  },
  ratesInfo: {
    padding: 12,
    backgroundColor: '#e6f7ef',
    borderRadius: 12,
    marginBottom: 20,
  },
  rateText: {
    fontSize: 14,
    color: '#0a7ea4',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  workerItem: {
    padding: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e1e4e8',
    borderRadius: 12,
    marginBottom: 12,
  },
  workerName: {
    fontSize: 16,
    fontWeight: '500',
  },
  attendanceStatus: {
    fontSize: 14,
    color: '#687076',
  },
  emptyText: {
    textAlign: 'center',
    color: '#687076',
    padding: 20,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    marginTop: 12,
    color: '#687076',
    fontSize: 16,
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
    maxHeight: '70%',
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
  dateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e4e8',
  },
  dateItemSelected: {
    backgroundColor: '#f0f9ff',
  },
  dateText: {
    fontSize: 16,
  },
  fetchButton: {
    backgroundColor: '#0a7ea4',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 20,
  },
  fetchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
