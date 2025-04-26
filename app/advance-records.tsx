import { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Platform, Alert, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

type Advance = {
  id: string;
  workerId: string;
  workerName: string;
  amount: string;
  date: string;
  remarks: string;
  deducted?: boolean;
  deductedOn?: string;
};

export default function AdvanceRecordsScreen() {
  const router = useRouter();
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [totalPendingAdvance, setTotalPendingAdvance] = useState(0); // Add this state

  useEffect(() => {
    loadAdvances();
  }, []);

  useEffect(() => {
    const interval = setInterval(loadAdvances, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadAdvances = async () => {
    try {
      const savedAdvances = await AsyncStorage.getItem('advances');
      if (savedAdvances) {
        const parsedAdvances = JSON.parse(savedAdvances);
        setAdvances(parsedAdvances);
        // Calculate total pending advance
        const total = parsedAdvances
          .filter((adv: Advance) => !adv.deducted)
          .reduce((sum: number, adv: Advance) => sum + Number(adv.amount), 0);
        setTotalPendingAdvance(total);
      }
    } catch (error) {
      console.error('Error loading advances:', error);
    }
  };

  const handleDeleteAdvance = (advanceId: string) => {
    Alert.alert(
      'Delete Advance',
      'Are you sure you want to delete this advance record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // First get latest advances to avoid race conditions
              const currentAdvances = await AsyncStorage.getItem('advances');
              const parsedAdvances = currentAdvances ? JSON.parse(currentAdvances) : [];
              
              const updatedAdvances = parsedAdvances.filter((adv: { id: string; }) => adv.id !== advanceId);
              await AsyncStorage.setItem('advances', JSON.stringify(updatedAdvances));
              
              // Update local state after successful storage update
              setAdvances(updatedAdvances);
            } catch (error) {
              console.error('Error deleting advance:', error);
              Alert.alert('Error', 'Failed to delete advance record');
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.header}>
          <MaterialIcons 
            name="arrow-back" 
            size={24} 
            color="#0a7ea4" 
            onPress={() => router.back()}
          />
          <ThemedText style={styles.title}>Advance Records</ThemedText>
          <View style={{ width: 24 }} />
        </ThemedView>

        {/* Add Total Counter */}
        <ThemedView style={styles.totalCounter}>
          <ThemedText style={styles.totalLabel}>Total Pending Advance</ThemedText>
          <ThemedText style={styles.totalAmount}>₹{totalPendingAdvance}</ThemedText>
        </ThemedView>

        <ScrollView 
          style={styles.recordsList}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={advances.length === 0 && styles.emptyStateContainer}>
          {advances.length === 0 ? (
            <ThemedView style={styles.emptyState}>
              <MaterialIcons name="account-balance-wallet" size={48} color="#e5e7eb" />
              <ThemedText style={styles.emptyText}>No advances recorded yet</ThemedText>
            </ThemedView>
          ) : (
            advances.slice().reverse().map(item => (
              <ThemedView key={item.id} style={[
                styles.advanceCard,
                item.deducted && styles.advanceCardDeducted
              ]}>
                <ThemedView style={styles.cardHeader}>
                  <ThemedView>
                    <ThemedText style={styles.workerName}>{item.workerName}</ThemedText>
                    {item.deducted && (
                      <ThemedText style={styles.deductedText}>
                        Deducted on {new Date(item.deductedOn || '').toLocaleDateString()}
                      </ThemedText>
                    )}
                  </ThemedView>
                  <ThemedView style={styles.amountContainer}>
                    <ThemedText style={[
                      styles.amount,
                      item.deducted && styles.amountDeducted
                    ]}>₹{item.amount}</ThemedText>
                    <Pressable
                      onPress={() => handleDeleteAdvance(item.id)}
                      style={styles.deleteButton}>
                      <MaterialIcons name="delete" size={20} color="#dc2626" />
                    </Pressable>
                  </ThemedView>
                </ThemedView>
                <ThemedView style={styles.cardDetails}>
                  <ThemedView style={styles.dateContainer}>
                    <MaterialIcons name="event" size={16} color="#687076" />
                    <ThemedText style={styles.date}>{item.date}</ThemedText>
                  </ThemedView>
                  {item.remarks && (
                    <ThemedView style={styles.remarksContainer}>
                      <MaterialIcons name="note" size={16} color="#687076" />
                      <ThemedText style={styles.remarks}>{item.remarks}</ThemedText>
                    </ThemedView>
                  )}
                </ThemedView>
              </ThemedView>
            ))
          )}
        </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  recordsList: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 16,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,
  },
  emptyState: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#687076',
    marginTop: 16,
    textAlign: 'center',
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
  advanceCardDeducted: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
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
    color: '#111827',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deductedText: {
    fontSize: 12,
    color: '#059669',
    marginTop: 2,
  },
  amount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0a7ea4',
  },
  amountDeducted: {
    color: '#9ca3af',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
  },
  date: {
    fontSize: 14,
    color: '#687076',
  },
  remarks: {
    fontSize: 14,
    color: '#687076',
    flex: 1,
    lineHeight: 20,
  },
  totalCounter: {
    backgroundColor: '#f0f9ff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    color: '#687076',
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0a7ea4',
  },
});
