import { useState, useEffect } from 'react';
import { StyleSheet, TextInput, Pressable, ScrollView, Modal, View, TouchableWithoutFeedback, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useFolders } from '@/hooks/useFolders';
import { useWorkers } from '@/hooks/useWorkers';

type Advance = {
  id: string;
  workerId: string;
  workerName: string;
  amount: string;
  date: string;
  remarks: string;
};

export default function ManageAdvanceScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState('Default');
  const [showFolderPicker, setShowFolderPicker] = useState(false);

  const { folders } = useFolders();
  const { getWorkersByFolder } = useWorkers();
  const workers = getWorkersByFolder(selectedFolder) || [];

  useEffect(() => {
    loadAdvances();
  }, []);

  const loadAdvances = async () => {
    try {
      const savedAdvances = await AsyncStorage.getItem('advances');
      if (savedAdvances) {
        setAdvances(JSON.parse(savedAdvances));
      }
    } catch (error) {
      console.error('Error loading advances:', error);
    }
  };

  const saveAdvances = async (newAdvances: Advance[]) => {
    try {
      await AsyncStorage.setItem('advances', JSON.stringify(newAdvances));
    } catch (error) {
      console.error('Error saving advances:', error);
    }
  };

  const toggleWorkerSelection = (workerId: string) => {
    setSelectedWorkers(prev => 
      prev.includes(workerId) 
        ? prev.filter(id => id !== workerId)
        : [...prev, workerId]
    );
  };

  const onDateChange = (event: any, selected: Date | undefined) => {
    if (event.type === 'set') {
      setSelectedDate(selected || selectedDate);
      if (Platform.OS === 'android') {
        setShowDatePicker(false);
      }
    } else if (event.type === 'dismissed') {
      setShowDatePicker(false);
    }
  };

  const addAdvance = async () => {
    if (selectedWorkers.length > 0 && amount) {
      const newAdvances = selectedWorkers.map(workerId => ({
        id: Date.now().toString() + workerId,
        workerId,
        workerName: workers.find(w => w.id === workerId)?.name || "Unknown",
        amount,
        date: selectedDate.toISOString().split('T')[0],
        remarks
      }));
      
      const updatedAdvances = [...advances, ...newAdvances];
      setAdvances(updatedAdvances);
      await saveAdvances(updatedAdvances);
      
      // Reset form
      setSelectedWorkers([]);
      setAmount('');
      setRemarks('');
      setModalVisible(false);
    }
  };

  const getSelectionText = () => {
    if (selectedWorkers.length === 0) return "Select workers";
    
    const firstWorker = workers.find(w => w.id === selectedWorkers[0])?.name;
    if (selectedWorkers.length === 1) return firstWorker;
    
    return `${firstWorker} +${selectedWorkers.length - 1} more`;
  };

  const showDateSelector = () => {
    Keyboard.dismiss();
    setShowDatePicker(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ThemedView style={[styles.container, { paddingTop: Math.max(insets.top - 20, 0) }]}>
            <ThemedView style={styles.header}>
              <ThemedText style={styles.title}>Advance Payment</ThemedText>
              <ThemedText style={styles.subtitle}>Manage worker advances and track payments</ThemedText>
            </ThemedView>
            
            <ScrollView style={styles.formWrapper} showsVerticalScrollIndicator={false}>
              <ThemedView style={styles.formCard}>
                <ThemedView style={styles.formHeader}>
                  <MaterialIcons name="payments" size={24} color="#0a7ea4" />
                  <ThemedText style={styles.formTitle}>New Advance</ThemedText>
                </ThemedView>

                <ThemedView style={styles.inputGroup}>
                  <ThemedText style={styles.label}>Work Folder</ThemedText>
                  <Pressable 
                    style={styles.selector}
                    onPress={() => setShowFolderPicker(true)}>
                    <ThemedView style={styles.selectorContent}>
                      <MaterialIcons 
                        name={selectedFolder === 'Default' ? "folder-special" : "folder"} 
                        size={24} 
                        color={selectedFolder === 'Default' ? "#f59e0b" : "#0a7ea4"} 
                      />
                      <ThemedText style={styles.selectorText}>{selectedFolder}</ThemedText>
                    </ThemedView>
                    <MaterialIcons name="arrow-drop-down" size={24} color="#687076" />
                  </Pressable>
                </ThemedView>

                <ThemedView style={styles.inputGroup}>
                  <ThemedText style={styles.label}>Selected Workers</ThemedText>
                  <Pressable 
                    style={[styles.selector, workers.length === 0 && styles.selectorDisabled]}
                    onPress={() => workers.length > 0 && setModalVisible(true)}>
                    <ThemedText style={[
                      styles.selectorText,
                      workers.length === 0 && styles.selectorTextDisabled
                    ]}>
                      {workers.length === 0 ? "No workers in selected folder" : getSelectionText()}
                    </ThemedText>
                    <MaterialIcons name="arrow-drop-down" size={24} color="#687076" />
                  </Pressable>
                </ThemedView>

                <ThemedView style={styles.inputGroup}>
                  <ThemedText style={styles.label}>Amount</ThemedText>
                  <TextInput
                    style={styles.input}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder="Enter advance amount"
                    placeholderTextColor="#687076"
                  />
                </ThemedView>

                <ThemedView style={styles.inputGroup}>
                  <ThemedText style={styles.label}>Remarks</ThemedText>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={remarks}
                    onChangeText={setRemarks}
                    placeholder="Add remarks (optional)"
                    placeholderTextColor="#687076"
                    multiline
                    textAlignVertical="top"
                    numberOfLines={4}
                  />
                </ThemedView>

                <ThemedView style={styles.inputGroup}>
                  <ThemedText style={styles.label}>Date</ThemedText>
                  <Pressable 
                    style={styles.dateSelector}
                    onPress={showDateSelector}>
                    <ThemedText style={styles.selectorText}>
                      {selectedDate.toLocaleDateString()}
                    </ThemedText>
                    <MaterialIcons name="calendar-today" size={24} color="#687076" />
                  </Pressable>
                </ThemedView>

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
                            testID="datePicker"
                            value={selectedDate}
                            mode="date"
                            display="spinner"
                            onChange={onDateChange}
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
                      testID="datePicker"
                      value={selectedDate}
                      mode="date"
                      display="default"
                      onChange={onDateChange}
                    />
                  )
                )}

                <Pressable 
                  style={styles.addButton} 
                  onPress={addAdvance}
                  disabled={!amount || selectedWorkers.length === 0}>
                  <MaterialIcons name="add" size={24} color="#fff" />
                  <ThemedText style={styles.buttonText}>Record Advance</ThemedText>
                </Pressable>

                {/* Folder Selection Modal */}
                <Modal
                  animationType="slide"
                  transparent={true}
                  visible={showFolderPicker}
                  onRequestClose={() => setShowFolderPicker(false)}>
                  <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                      <ThemedView style={styles.modalHeader}>
                        <ThemedText style={styles.modalTitle}>Select Folder</ThemedText>
                        <Pressable onPress={() => setShowFolderPicker(false)}>
                          <MaterialIcons name="close" size={24} color="#687076" />
                        </Pressable>
                      </ThemedView>

                      <ScrollView>
                        {folders.map(item => (
                          <Pressable
                            key={item.id}
                            style={[
                              styles.folderItem,
                              selectedFolder === item.name && styles.folderItemSelected
                            ]}
                            onPress={() => {
                              setSelectedFolder(item.name);
                              setSelectedWorkers([]); // Clear selected workers when folder changes
                              setShowFolderPicker(false);
                            }}>
                            <ThemedView style={styles.folderInfo}>
                              <MaterialIcons 
                                name={item.isDefault ? "folder-special" : "folder"} 
                                size={24} 
                                color={item.isDefault ? "#f59e0b" : "#0a7ea4"} 
                              />
                              <ThemedText style={styles.folderName}>{item.name}</ThemedText>
                            </ThemedView>
                            {selectedFolder === item.name && (
                              <MaterialIcons name="check" size={24} color="#0a7ea4" />
                            )}
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                </Modal>
              </ThemedView>
            </ScrollView>

            <ThemedView style={styles.footer}>
              <Pressable 
                style={styles.viewRecordsButton}
                onPress={() => router.push('/advance-records')}>
                <MaterialIcons name="receipt-long" size={24} color="#fff" />
                <ThemedText style={styles.buttonText}>View All Records</ThemedText>
              </Pressable>
            </ThemedView>

            <Modal
              animationType="slide"
              transparent={true}
              visible={modalVisible}
              onRequestClose={() => setModalVisible(false)}>
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <ThemedView style={styles.modalHeader}>
                    <ThemedText style={styles.modalTitle}>Select Workers</ThemedText>
                    <Pressable onPress={() => setModalVisible(false)}>
                      <MaterialIcons name="close" size={24} color="#687076" />
                    </Pressable>
                  </ThemedView>

                  <ScrollView>
                    {workers.map(item => (
                      <Pressable
                        key={item.id}
                        style={[
                          styles.workerItem,
                          selectedWorkers.includes(item.id) && styles.workerItemSelected
                        ]}
                        onPress={() => toggleWorkerSelection(item.id)}>
                        <ThemedText style={styles.workerItemText}>{item.name}</ThemedText>
                        {selectedWorkers.includes(item.id) && (
                          <MaterialIcons name="check" size={24} color="#0a7ea4" />
                        )}
                      </Pressable>
                    ))}
                  </ScrollView>

                  <Pressable 
                    style={styles.modalButton}
                    onPress={() => setModalVisible(false)}>
                    <ThemedText style={styles.buttonText}>Done</ThemedText>
                  </Pressable>
                </View>
              </View>
            </Modal>
          </ThemedView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
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
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#687076',
    marginTop: 4,
    textAlign: 'center',
  },
  formWrapper: {
    flex: 1,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  inputGroup: {
    gap: 8,
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  workerSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e1e4e8',
    borderRadius: 12,
  },
  selector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e1e4e8',
    borderRadius: 12,
  },
  selectorText: {
    fontSize: 16,
    color: '#111827',
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectorDisabled: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  selectorTextDisabled: {
    color: '#9ca3af',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#e1e4e8',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    padding: 12,
    paddingTop: 12,
    textAlignVertical: 'top',
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
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  addButton: {
    backgroundColor: '#0a7ea4',
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  recordsSection: {
    flex: 1,
  },
  recordsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  recordsTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#11181C',
  },
  recordCount: {
    fontSize: 14,
    color: '#687076',
  },
  recordsList: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
  },
  recordsContent: {
    flexGrow: 1,
  },
  emptyStateContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
  },
  advanceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardDetails: {
    gap: 8,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  remarksContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  workerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  amount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0a7ea4',
  },
  date: {
    fontSize: 14,
    color: '#687076',
  },
  remarks: {
    fontSize: 14,
    color: '#687076',
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 48,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#687076',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#687076',
    marginTop: 8,
    textAlign: 'center',
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
  workerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e4e8',
  },
  workerItemSelected: {
    backgroundColor: '#f0f9ff',
  },
  workerItemText: {
    fontSize: 16,
  },
  modalButton: {
    backgroundColor: '#0a7ea4',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 18,
    marginBottom:10,
  },
  modalCloseButton: {
    padding: 8,
  },
  footer: {
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  viewRecordsButton: {
    backgroundColor: '#0a7ea4',
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  folderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  folderName: {
    fontSize: 16,
    color: '#111827',
  },
  folderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e4e8',
  },
  folderItemSelected: {
    backgroundColor: '#f0f9ff',
  },
});
