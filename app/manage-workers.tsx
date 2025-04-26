import { useState, useEffect } from 'react';
import { StyleSheet, TextInput, Pressable, FlatList, Modal, View, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useFolders } from '@/hooks/useFolders';
import { useWorkers } from '@/hooks/useWorkers';

type Worker = {
  id: string;
  name: string;
};

export default function ManageWorkersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { folders } = useFolders();
  const { addWorker, workers, getWorkersByFolder, deleteWorker, editWorker, deleteMultipleWorkers } = useWorkers();
  const [name, setName] = useState('');
  const [selectedFolders, setSelectedFolders] = useState<string[]>(['Default']);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [workersList, setWorkersList] = useState<Worker[]>([]);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);

  useEffect(() => {
    loadWorkers();
  }, [selectedFolders, workers]);

  const loadWorkers = async () => {
    try {
      const allWorkers = selectedFolders.flatMap(folder => 
        getWorkersByFolder(folder)
      );
      const uniqueWorkers = Array.from(
        new Map(allWorkers.map(w => [w.id, w])).values()
      );
      setWorkersList(uniqueWorkers);
    } catch (error) {
      console.error('Error loading workers:', error);
    }
  };

  const handleAddWorker = async () => {
    const trimmedName = name.trim();
    if (trimmedName) {
      try {
        await addWorker(trimmedName, selectedFolders);
        setName('');
      } catch (error: any) {
        console.error('Error adding worker:', error);
        Alert.alert(
          "Error Adding Worker",
          error.message || "Failed to add worker",
          [{ text: "OK" }]
        );
      }
    }
  };

  const toggleFolderSelection = (folderName: string) => {
    setSelectedFolders(prev => {
      if (prev.includes(folderName)) {
        return prev.length > 1 ? prev.filter(f => f !== folderName) : prev;
      }
      return [...prev, folderName];
    });
  };

  const handleEdit = (worker: Worker) => {
    setEditingWorker(worker);
    setEditName(worker.name);
    setShowEditModal(true);
  };

  const handleDelete = (workerId: string) => {
    Alert.alert(
      "Delete Worker",
      "Are you sure you want to delete this worker?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: 'destructive',
          onPress: () => deleteWorker(workerId)
        }
      ]
    );
  };

  const handleSaveEdit = async () => {
    const trimmedName = editName.trim();
    if (editingWorker && trimmedName) {
      // Check for duplicate names, excluding the current worker being edited
      const isDuplicate = workers.some(
        worker => worker.id !== editingWorker.id && 
                 worker.name.toLowerCase() === trimmedName.toLowerCase()
      );

      if (isDuplicate) {
        Alert.alert(
          "Duplicate Worker",
          "A worker with this name already exists.",
          [{ text: "OK" }]
        );
        return;
      }

      await editWorker(editingWorker.id, trimmedName);
      setShowEditModal(false);
      setEditingWorker(null);
      setEditName('');
    }
  };

  const toggleMultiSelectMode = () => {
    setIsMultiSelectMode(!isMultiSelectMode);
    setSelectedWorkerIds([]);
  };

  const toggleWorkerSelection = (workerId: string) => {
    setSelectedWorkerIds(prev => 
      prev.includes(workerId)
        ? prev.filter(id => id !== workerId)
        : [...prev, workerId]
    );
  };

  const handleMultipleDelete = () => {
    if (selectedWorkerIds.length === 0) return;

    Alert.alert(
      "Delete Workers",
      `Are you sure you want to delete ${selectedWorkerIds.length} workers?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMultipleWorkers(selectedWorkerIds);
              setSelectedWorkerIds([]);
              setIsMultiSelectMode(false);
            } catch (error) {
              console.error('Error deleting workers:', error);
              Alert.alert('Error', 'Failed to delete workers');
            }
          }
        }
      ]
    );
  };

  const renderWorkerCard = ({ item }: { item: Worker }) => (
    <Pressable
      onPress={() => isMultiSelectMode ? toggleWorkerSelection(item.id) : null}
      onLongPress={() => !isMultiSelectMode && setIsMultiSelectMode(true)}
      style={[
        styles.workerCard,
        selectedWorkerIds.includes(item.id) && styles.workerCardSelected
      ]}>
      <ThemedText style={styles.workerName}>{item.name}</ThemedText>
      {isMultiSelectMode ? (
        <MaterialIcons 
          name={selectedWorkerIds.includes(item.id) ? "check-box" : "check-box-outline-blank"} 
          size={24} 
          color="#0a7ea4" 
        />
      ) : (
        <ThemedView style={styles.actionButtons}>
          <Pressable 
            onPress={() => handleEdit(item)}
            style={styles.iconButton}>
            <MaterialIcons name="edit" size={24} color="#0a7ea4" />
          </Pressable>
          <Pressable 
            onPress={() => handleDelete(item.id)}
            style={styles.iconButton}>
            <MaterialIcons name="delete" size={24} color="#dc2626" />
          </Pressable>
        </ThemedView>
      )}
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={[styles.container, { paddingTop: Math.max(insets.top - 20, 0) }]}>
        <ThemedView style={styles.header}>
          <ThemedText style={styles.title}>Manage Workers</ThemedText>
          {isMultiSelectMode && (
            <ThemedText style={styles.selectedCount}>
              {selectedWorkerIds.length} selected
            </ThemedText>
          )}
        </ThemedView>

        <ThemedView style={styles.actionsBar}>
          {isMultiSelectMode ? (
            <>
              <Pressable 
                style={styles.actionButton}
                onPress={toggleMultiSelectMode}>
                <MaterialIcons name="close" size={24} color="#687076" />
                <ThemedText style={styles.actionButtonText}>Cancel</ThemedText>
              </Pressable>
              <Pressable 
                style={[styles.actionButton, styles.deleteButton]}
                onPress={handleMultipleDelete}
                disabled={selectedWorkerIds.length === 0}>
                <MaterialIcons name="delete" size={24} color="#fff" />
                <ThemedText style={[styles.actionButtonText, { color: '#fff' }]}>
                  Delete Selected
                </ThemedText>
              </Pressable>
            </>
          ) : (
            <Pressable 
              style={styles.actionButton}
              onPress={toggleMultiSelectMode}>
              <MaterialIcons name="select-all" size={24} color="#687076" />
              <ThemedText style={styles.actionButtonText}>Select Multiple</ThemedText>
            </Pressable>
          )}
        </ThemedView>

        <ThemedView style={styles.form}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Worker Name"
            placeholderTextColor="#687076"
          />
          <Pressable 
            style={styles.folderSelector}
            onPress={() => setShowFolderPicker(true)}>
            <ThemedText style={styles.selectorText}>
              {selectedFolders.length === 1 
                ? selectedFolders[0]
                : `${selectedFolders[0]} + ${selectedFolders.length - 1} more`
              }
            </ThemedText>
            <MaterialIcons name="folder" size={24} color="#687076" />
          </Pressable>
          <Pressable style={styles.addButton} onPress={handleAddWorker}>
            <ThemedText style={styles.buttonText}>Add Worker</ThemedText>
          </Pressable>
        </ThemedView>

        <FlatList
          data={workersList}
          keyExtractor={(item) => item.id}
          renderItem={renderWorkerCard}
          ListEmptyComponent={
            <ThemedView style={styles.emptyState}>
              <MaterialIcons name="group" size={48} color="#687076" />
              <ThemedText style={styles.emptyStateText}>No workers added yet</ThemedText>
            </ThemedView>
          }
        />

        <Modal
          animationType="slide"
          transparent={true}
          visible={showFolderPicker}
          onRequestClose={() => setShowFolderPicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ThemedView style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Assign to Folders</ThemedText>
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
                      selectedFolders.includes(item.name) && styles.folderItemSelected
                    ]}
                    onPress={() => toggleFolderSelection(item.name)}>
                    <ThemedView style={styles.folderInfo}>
                      <MaterialIcons 
                        name={item.isDefault ? "folder-special" : "folder"} 
                        size={24} 
                        color={item.isDefault ? "#f59e0b" : "#0a7ea4"} 
                      />
                      <ThemedText style={styles.folderName}>{item.name}</ThemedText>
                    </ThemedView>
                    {selectedFolders.includes(item.name) && (
                      <MaterialIcons name="check-circle" size={24} color="#0a7ea4" />
                    )}
                  </Pressable>
                )}
              />

              <Pressable 
                style={styles.confirmButton}
                onPress={() => setShowFolderPicker(false)}>
                <ThemedText style={styles.buttonText}>
                  Confirm
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal
          animationType="slide"
          transparent={true}
          visible={showEditModal}
          onRequestClose={() => setShowEditModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ThemedView style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Edit Worker</ThemedText>
                <Pressable onPress={() => setShowEditModal(false)}>
                  <MaterialIcons name="close" size={24} color="#687076" />
                </Pressable>
              </ThemedView>

              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="Worker Name"
                placeholderTextColor="#687076"
              />

              <Pressable 
                style={styles.confirmButton}
                onPress={handleSaveEdit}>
                <ThemedText style={styles.buttonText}>
                  Save Changes
                </ThemedText>
              </Pressable>
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
  },
  title: {
    fontSize: 24,
    marginBottom: 24,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  form: {
    gap: 12,
    marginBottom: 20,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#e1e4e8',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  folderSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e1e4e8',
    borderRadius: 12,
    marginBottom: 16,
  },
  addButton: {
    backgroundColor: '#0a7ea4',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  workerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  workerName: {
    fontSize: 16,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#687076',
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  folderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e4e8',
  },
  folderItemSelected: {
    backgroundColor: '#e6f7ff',
  },
  folderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  folderName: {
    marginLeft: 12,
    fontSize: 16,
  },
  confirmButton: {
    backgroundColor: '#0a7ea4',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  selectorText: {
    fontSize: 16,
    color: '#687076',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  iconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    gap: 4,
  },
  actionButtonText: {
    fontSize: 14,
    color: '#687076',
  },
  deleteButton: {
    backgroundColor: '#dc2626',
  },
  selectedCount: {
    fontSize: 16,
    color: '#0a7ea4',
  },
  workerCardSelected: {
    backgroundColor: '#f0f9ff',
    borderColor: '#0a7ea4',
  },
});
