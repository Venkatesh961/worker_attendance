import { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useWorkers } from '@/hooks/useWorkers';
import { useAttendance } from '@/hooks/useAttendance';
import { usePaymentSettings } from '@/hooks/usePaymentSettings';

type WorkerStats = {
  totalPresent: number;
  totalHalfDay: number;
  totalAbsent: number;
  totalPaid: number;
  totalAdvance: number;
  pendingAdvance: number;
};

export default function WorkerDetailsScreen() {
  const { workerId } = useLocalSearchParams();
  const router = useRouter();
  const { workers } = useWorkers();
  const { getAttendanceByFolder } = useAttendance();
  const { folderRates } = usePaymentSettings();
  
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<WorkerStats>({
    totalPresent: 0,
    totalHalfDay: 0,
    totalAbsent: 0,
    totalPaid: 0,
    totalAdvance: 0,
    pendingAdvance: 0
  });
  const [recentAttendance, setRecentAttendance] = useState<{date: string, status: string}[]>([]);
  
  const worker = workers.find(w => w.id === workerId);

  useEffect(() => {
    loadWorkerDetails();
  }, [workerId]);

  const loadWorkerDetails = async () => {
    if (!worker) return;
    
    setIsLoading(true);
    try {
      // Get all attendance records
      const allAttendance = await Promise.all(
        worker.folders.map(folder => getAttendanceByFolder(folder, ''))
      );
      
      // Get all advances
      const savedAdvances = await AsyncStorage.getItem('advances');
      const advances = savedAdvances ? JSON.parse(savedAdvances) : [];
      const workerAdvances = advances.filter((a: any) => a.workerId === workerId);

      // Calculate stats
      const attendance = allAttendance.flat();
      const present = attendance.filter(a => a.status === 'present').length;
      const halfDay = attendance.filter(a => a.status === 'half-day').length;
      const absent = attendance.filter(a => a.status === 'absent').length;

      // Calculate payments based on attendance
      const totalPaid = worker.folders.reduce((total, folder) => {
        const rates = folderRates[folder] || folderRates['Default'];
        return total + (present * Number(rates.fullDay)) + (halfDay * Number(rates.halfDay));
      }, 0);

      const totalAdvance = workerAdvances.reduce((sum: number, adv: any) => sum + Number(adv.amount), 0);
      const pendingAdvance = workerAdvances
        .filter((a: any) => !a.deducted)
        .reduce((sum: number, adv: any) => sum + Number(adv.amount), 0);

      // Get recent attendance (last 7 days)
      const recent = attendance
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 7)
        .map(a => ({ date: a.date, status: a.status }));

      setStats({
        totalPresent: present,
        totalHalfDay: halfDay,
        totalAbsent: absent,
        totalPaid,
        totalAdvance,
        pendingAdvance
      });
      setRecentAttendance(recent);
    } catch (error) {
      console.error('Error loading worker details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!worker) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ThemedText style={styles.errorText}>Worker not found</ThemedText>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <ThemedView style={styles.header}>
          <MaterialIcons 
            name="arrow-back" 
            size={24} 
            color="#0a7ea4" 
            onPress={() => router.back()}
          />
          <ThemedText style={styles.title}>{worker.name}</ThemedText>
          <View style={{ width: 24 }} />
        </ThemedView>

        {isLoading ? (
          <ThemedView style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0a7ea4" />
            <ThemedText style={styles.loadingText}>Loading details...</ThemedText>
          </ThemedView>
        ) : (
          <>
            <ThemedView style={styles.statsCard}>
              <ThemedText style={styles.sectionTitle}>Attendance Overview</ThemedText>
              <ThemedView style={styles.statsGrid}>
                <ThemedView style={styles.statItem}>
                  <ThemedText style={styles.statValue}>{stats.totalPresent}</ThemedText>
                  <ThemedText style={styles.statLabel}>Present</ThemedText>
                </ThemedView>
                <ThemedView style={styles.statItem}>
                  <ThemedText style={styles.statValue}>{stats.totalHalfDay}</ThemedText>
                  <ThemedText style={styles.statLabel}>Half Day</ThemedText>
                </ThemedView>
                <ThemedView style={styles.statItem}>
                  <ThemedText style={styles.statValue}>{stats.totalAbsent}</ThemedText>
                  <ThemedText style={styles.statLabel}>Absent</ThemedText>
                </ThemedView>
              </ThemedView>
            </ThemedView>

            <ThemedView style={styles.statsCard}>
              <ThemedText style={styles.sectionTitle}>Payment Details</ThemedText>
              <ThemedView style={styles.paymentDetails}>
                <ThemedView style={styles.paymentRow}>
                  <ThemedText style={styles.paymentLabel}>Total Earned</ThemedText>
                  <ThemedText style={styles.paymentValue}>₹{stats.totalPaid}</ThemedText>
                </ThemedView>
                <ThemedView style={styles.paymentRow}>
                  <ThemedText style={styles.paymentLabel}>Total Advance</ThemedText>
                  <ThemedText style={styles.paymentValue}>₹{stats.totalAdvance}</ThemedText>
                </ThemedView>
                <ThemedView style={styles.paymentRow}>
                  <ThemedText style={styles.paymentLabel}>Pending Advance</ThemedText>
                  <ThemedText style={[styles.paymentValue, { color: '#dc2626' }]}>
                    ₹{stats.pendingAdvance}
                  </ThemedText>
                </ThemedView>
              </ThemedView>
            </ThemedView>

            <ThemedView style={styles.statsCard}>
              <ThemedText style={styles.sectionTitle}>Recent Attendance</ThemedText>
              {recentAttendance.map((record, index) => (
                <ThemedView key={index} style={styles.attendanceRow}>
                  <ThemedText style={styles.dateText}>
                    {new Date(record.date).toLocaleDateString()}
                  </ThemedText>
                  <ThemedView style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(record.status) }
                  ]}>
                    <ThemedText style={styles.statusText}>
                      {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                    </ThemedText>
                  </ThemedView>
                </ThemedView>
              ))}
            </ThemedView>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'present': return '#e6f7ef';
    case 'half-day': return '#fef3c7';
    case 'absent': return '#fee2e2';
    default: return '#f3f4f6';
  }
};

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
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0a7ea4',
  },
  statLabel: {
    fontSize: 14,
    color: '#687076',
    marginTop: 4,
  },
  paymentDetails: {
    gap: 12,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLabel: {
    fontSize: 16,
    color: '#374151',
  },
  paymentValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0a7ea4',
  },
  attendanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  dateText: {
    fontSize: 16,
    color: '#374151',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
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
  errorText: {
    textAlign: 'center',
    color: '#dc2626',
    fontSize: 16,
    marginTop: 20,
  },
});
