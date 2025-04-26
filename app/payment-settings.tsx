import { useState, useEffect } from 'react';
import { StyleSheet, TextInput, Pressable, Modal, FlatList, View, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useFolders } from '@/hooks/useFolders';
import { usePaymentSettings, PaymentRates } from '@/hooks/usePaymentSettings';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

export default function PaymentSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { folders } = useFolders();
  const { folderRates, updateFolderRates } = usePaymentSettings();
  const [selectedFolders, setSelectedFolders] = useState<string[]>(['Default']);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [rates, setRates] = useState<PaymentRates>({
    fullDay: '600',
    halfDay: '250'
  });

  useEffect(() => {
    if (selectedFolders.length > 0) {
      const folderRatesData = folderRates[selectedFolders[0]] || folderRates['Default'];
      setRates(folderRatesData);
    }
  }, [selectedFolders, folderRates]);

  const handleUpdateRates = async () => {
    setIsSaving(true);
    try {
      await Promise.all(
        selectedFolders.map(folder => updateFolderRates(folder, rates))
      );
      Alert.alert('Success', 'Payment rates updated successfully');
    } catch (error) {
      console.error('Error updating rates:', error);
      Alert.alert('Error', 'Failed to update payment rates');
    } finally {
      setIsSaving(false);
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

  const getFolderDisplayText = () => {
    if (selectedFolders.length === 1) return selectedFolders[0];
    return `${selectedFolders[0]} +${selectedFolders.length - 1} more`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={[styles.container, { paddingTop: Math.max(insets.top - 20, 0) }]}>
        <ThemedText style={styles.title}>Payment Settings</ThemedText>

        <Pressable 
          style={styles.folderSelector}
          onPress={() => setShowFolderPicker(true)}>
          <ThemedView style={styles.folderInfo}>
            <MaterialIcons 
              name="folder" 
              size={24} 
              color="#0a7ea4" 
            />
            <ThemedText style={styles.folderName}>{getFolderDisplayText()}</ThemedText>
          </ThemedView>
          <MaterialIcons name="arrow-drop-down" size={24} color="#687076" />
        </Pressable>

        <ThemedView style={styles.form}>
          <ThemedView style={styles.inputGroup}>
            <ThemedText style={styles.label}>Full Day Pay</ThemedText>
            <TextInput
              style={styles.input}
              value={rates.fullDay}
              onChangeText={(value) => setRates(prev => ({ ...prev, fullDay: value }))}
              keyboardType="numeric"
              placeholder="Enter amount"
              placeholderTextColor="#687076"
              returnKeyType="done"
              onSubmitEditing={() => handleUpdateRates()}
            />
          </ThemedView>

          <ThemedView style={styles.inputGroup}>
            <ThemedText style={styles.label}>Half Day Pay</ThemedText>
            <TextInput
              style={styles.input}
              value={rates.halfDay}
              onChangeText={(value) => setRates(prev => ({ ...prev, halfDay: value }))}
              keyboardType="numeric"
              placeholder="Enter amount"
              placeholderTextColor="#687076" 
              returnKeyType="done"
              onSubmitEditing={() => handleUpdateRates()}
            />
          </ThemedView>

          <Pressable 
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleUpdateRates}
            disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.buttonText}>Save Settings</ThemedText>
            )}
          </Pressable>
        </ThemedView>

        <Modal
          animationType="slide"
          transparent={true}
          visible={showFolderPicker}
          onRequestClose={() => setShowFolderPicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ThemedView style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Select Folders</ThemedText>
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

              <ThemedText style={styles.selectedCount}>
                {selectedFolders.length} folder{selectedFolders.length !== 1 ? 's' : ''} selected
              </ThemedText>

              <Pressable 
                style={styles.confirmButton}
                onPress={() => setShowFolderPicker(false)}>
                <ThemedText style={styles.buttonText}>Done</ThemedText>
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
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    gap: 20,
    marginBottom: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#e1e4e8',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#f9fafb',
  },
  saveButton: {
    backgroundColor: '#0a7ea4',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  folderSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e1e4e8',
    borderRadius: 12,
    marginBottom: 24,
  },
  folderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  folderName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0a7ea4',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '80%',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e1e4e8',
    borderRadius: 12,
    marginBottom: 12,
  },
  folderItemSelected: {
    backgroundColor: '#e6f7ff',
  },
  selectedCount: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 12,
    color: '#687076',
  },
  confirmButton: {
    backgroundColor: '#0a7ea4',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
});
