import { useState, useEffect } from 'react';
import { StyleSheet, TextInput, Pressable, FlatList, View, Modal, Alert, Animated, Platform, KeyboardAvoidingView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useFolders, WorkFolder } from '@/hooks/useFolders';
import { usePaymentSettings } from '@/hooks/usePaymentSettings';
import { useWorkers } from '@/hooks/useWorkers';
import { useAttendance } from '@/hooks/useAttendance';

export default function WorkFoldersScreen() {
  const router = useRouter();
  const { folders, setFolders, deleteFolder, loadFolders, renameFolder } = useFolders();
  const { folderRates } = usePaymentSettings();
  const { getWorkersByFolder } = useWorkers();
  const { getAttendanceByFolder } = useAttendance();
  const [newFolderName, setNewFolderName] = useState('');
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null);
  const [folderData, setFolderData] = useState<{[key: string]: any}>({});
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [showDateList, setShowDateList] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<WorkFolder | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [animation] = useState(new Animated.Value(0));
  const [longPressAnimation] = useState(new Animated.Value(1));

  const addFolder = async () => {
    if (newFolderName.trim()) {
      try {
        await setFolders([
          ...folders,
          {
            id: Date.now().toString(),
            name: newFolderName.trim(),
            createdAt: new Date(),
            isDefault: false
          }
        ]);
        setNewFolderName('');
        setShowCreateModal(false);
      } catch (error: any) {
        Alert.alert("Error", error.message);
      }
    }
  };

  const loadFolderData = async (folderName: string) => {
    try {
      const folderWorkers = getWorkersByFolder(folderName);
      const attendance = getAttendanceByFolder(folderName, selectedDate);
      
      if (folderWorkers.length > 0) {
        setFolderData(prev => ({
          ...prev,
          [folderName]: {
            workers: folderWorkers,
            attendance,
            lastUpdated: Date.now()
          }
        }));
      }
    } catch (error) {
      console.error('Error loading folder data:', error);
    }
  };

  const loadAvailableDates = async (folderName: string) => {
    try {
      const allAttendance = await getAttendanceByFolder(folderName, '');
      const dates = [...new Set(allAttendance.map(record => record.date))]
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      
      setAvailableDates(dates);
      if (dates.length > 0 && !selectedDate) {
        setSelectedDate(dates[0]);
      }
    } catch (error) {
      console.error('Error loading dates:', error);
    }
  };

  const handleExpandFolder = async (folderName: string) => {
    if (expandedFolder !== folderName) {
      setExpandedFolder(folderName);
      await loadAvailableDates(folderName);
      await loadFolderData(folderName);
    } else {
      setExpandedFolder(null);
    }
  };

  const handleFolderPress = (folderName: string) => {
    router.push({
      pathname: '/folder-details',
      params: { folderName }
    });
  };

  const handleDeleteFolder = (folderId: string, folderName: string) => {
    Alert.alert(
      "Delete Folder",
      `Are you sure you want to delete "${folderName}"? This will delete all attendance records for this folder.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteFolder(folderId);
              await loadFolders();
            } catch (error: any) {
              Alert.alert("Error", error.message);
            }
          }
        }
      ]
    );
  };

  const handleRename = (folder: WorkFolder) => {
    setSelectedFolder(folder);
    setNewFolderName(folder.name);
    setShowRenameModal(true);
  };

  const handleSaveRename = async () => {
    if (selectedFolder && newFolderName.trim()) {
      try {
        await renameFolder(selectedFolder.id, newFolderName.trim());
        await loadFolders();
        setNewFolderName('');
        setShowRenameModal(false);
        setSelectedFolder(null);
      } catch (error: any) {
        Alert.alert("Error", error.message);
      }
    }
  };

  const animateFolderPress = () => {
    Animated.sequence([
      Animated.timing(animation, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(animation, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.header}>
          <ThemedText style={styles.title}>Work Folders</ThemedText>
          <ThemedText style={styles.subtitle}>
            Organize workers and manage attendance by folders
          </ThemedText>
          <ThemedText style={styles.hint}>
            Long press any folder to rename or delete
          </ThemedText>
        </ThemedView>

        {folders.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <MaterialIcons name="folder-open" size={64} color="#e5e7eb" />
            <ThemedText style={styles.emptyTitle}>No Folders Created</ThemedText>
            <ThemedText style={styles.emptyText}>
              Start by creating your first work folder to organize workers
            </ThemedText>
            <Pressable 
              style={styles.createButton}
              onPress={() => setShowCreateModal(true)}>
              <MaterialIcons name="add" size={24} color="#fff" />
              <ThemedText style={styles.buttonText}>Create Folder</ThemedText>
            </Pressable>
          </ThemedView>
        ) : (
          <FlatList
            data={folders}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Animated.View style={[
                styles.folderCard,
                {
                  transform: [{
                    scale: Animated.multiply(
                      animation,
                      longPressAnimation
                    ).interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.95, 1],
                    }),
                  }],
                },
              ]}>
                <Pressable
                  onPress={() => {
                    animateFolderPress();
                    router.push(`/folder-details?folderName=${item.name}`);
                  }}
                  onPressIn={() => {
                    Animated.spring(longPressAnimation, {
                      toValue: 0.95,
                      useNativeDriver: true,
                    }).start();
                  }}
                  onPressOut={() => {
                    Animated.spring(longPressAnimation, {
                      toValue: 1,
                      useNativeDriver: true,
                    }).start();
                  }}
                  onLongPress={() => {
                    // Create base buttons that always appear
                    const buttons: Array<{
                      text: string;
                      style?: 'cancel' | 'default' | 'destructive';
                      onPress?: () => void;
                    }> = [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Rename",
                        style: "default",
                        onPress: () => handleRename(item)
                      }
                    ];
                    
                    // Conditionally add the Delete button only for non-default folders
                    if (!item.isDefault) {
                      buttons.push({
                        text: "Delete",
                        style: "destructive",
                        onPress: () => handleDeleteFolder(item.id, item.name)
                      });
                    }
                    
                    Alert.alert(
                      "Folder Options",
                      `What would you like to do with "${item.name}"?`,
                      buttons
                    );
                  }}
                  style={styles.folderContent}>
                  <ThemedView style={styles.folderHeader}>
                    <ThemedView style={styles.folderInfo}>
                      <MaterialIcons 
                        name={item.isDefault ? "folder-special" : "folder"} 
                        size={28} 
                        color={item.isDefault ? "#f59e0b" : "#0a7ea4"} 
                      />
                      <ThemedView>
                        <ThemedText style={styles.folderName}>{item.name}</ThemedText>
                        <ThemedText style={styles.folderMeta}>
                          {item.isDefault ? 'Default Folder' : 'Custom Folder'} • Created {new Date(item.createdAt).toLocaleDateString()}
                        </ThemedText>
                      </ThemedView>
                    </ThemedView>
                    <MaterialIcons name="chevron-right" size={24} color="#687076" />
                  </ThemedView>
                </Pressable>
              </Animated.View>
            )}
          />
        )}

        <Modal
          animationType="slide"
          transparent={true}
          visible={showCreateModal}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <ThemedView style={styles.modalHeader}>
                  <ThemedText style={styles.modalTitle}>Create New Folder</ThemedText>
                  <Pressable onPress={() => setShowCreateModal(false)}>
                    <MaterialIcons name="close" size={24} color="#687076" />
                  </Pressable>
                </ThemedView>

                <TextInput
                  style={styles.input}
                  value={newFolderName}
                  onChangeText={setNewFolderName}
                  placeholder="Enter folder name"
                  placeholderTextColor="#9ca3af"
                  autoFocus
                />

                <Pressable 
                  style={[styles.createButton, !newFolderName.trim() && styles.buttonDisabled]}
                  onPress={addFolder}
                  disabled={!newFolderName.trim()}>
                  <MaterialIcons name="check" size={24} color="#fff" />
                  <ThemedText style={styles.buttonText}>Create Folder</ThemedText>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal
          animationType="slide"
          transparent={true}
          visible={showRenameModal}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <ThemedView style={styles.modalHeader}>
                  <ThemedText style={styles.modalTitle}>Rename Folder</ThemedText>
                  <Pressable onPress={() => setShowRenameModal(false)}>
                    <MaterialIcons name="close" size={24} color="#687076" />
                  </Pressable>
                </ThemedView>

                <TextInput
                  style={styles.input}
                  value={newFolderName}
                  onChangeText={setNewFolderName}
                  placeholder="Enter new folder name"
                  placeholderTextColor="#9ca3af"
                  autoFocus
                />

                <Pressable 
                  style={[styles.createButton, !newFolderName.trim() && styles.buttonDisabled]}
                  onPress={handleSaveRename}
                  disabled={!newFolderName.trim()}>
                  <MaterialIcons name="check" size={24} color="#fff" />
                  <ThemedText style={styles.buttonText}>Save Changes</ThemedText>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Pressable 
          style={styles.fab}
          onPress={() => setShowCreateModal(true)}>
          <MaterialIcons name="add" size={24} color="#fff" />
        </Pressable>
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
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#687076',
  },
  hint: {
    fontSize: 14,
    color: '#687076',
    marginTop: 4,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  listContent: {
    paddingBottom: 80,
  },
  folderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
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
  folderContent: {
    padding: 16,
  },
  folderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  folderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  folderName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  folderMeta: {
    fontSize: 14,
    color: '#687076',
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#687076',
    textAlign: 'center',
    marginBottom: 24,
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
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: '#0a7ea4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#0a7ea4',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 8,
      },
    }),
  },
});
