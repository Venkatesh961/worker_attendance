import { useRouter } from 'expo-router';
import { StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.title}>MarkAttend</ThemedText>
        <ThemedView style={styles.gridContainer}>
          <Pressable 
            style={styles.card}
            onPress={() => router.push('/mark-attendance')}>
            <MaterialIcons name="how-to-reg" size={48} color="#0a7ea4" />
            <ThemedText style={styles.cardTitle}>Mark Attendance</ThemedText>
            <ThemedText style={styles.cardSubtitle}>Record daily worker attendance</ThemedText>
          </Pressable>

          <Pressable 
            style={styles.card}
            onPress={() => router.push('/manage-workers')}>
            <MaterialIcons name="group-add" size={48} color="#0a7ea4" />
            <ThemedText style={styles.cardTitle}>Manage Workers</ThemedText>
            <ThemedText style={styles.cardSubtitle}>Add or edit workers</ThemedText>
          </Pressable>

          <Pressable 
            style={styles.card}
            onPress={() => router.push('/manage-advance')}>
            <MaterialIcons name="payments" size={48} color="#0a7ea4" />
            <ThemedText style={styles.cardTitle}>Manage Advance</ThemedText>
            <ThemedText style={styles.cardSubtitle}>Record worker advances</ThemedText>
          </Pressable>

          <Pressable 
            style={styles.card}
            onPress={() => router.push('/work-folders')}>
            <MaterialIcons name="folder-special" size={48} color="#0a7ea4" />
            <ThemedText style={styles.cardTitle}>Work Folders</ThemedText>
            <ThemedText style={styles.cardSubtitle}>Organize attendance by work</ThemedText>
          </Pressable>

          <Pressable 
            style={styles.card}
            onPress={() => router.push('/payment-settings')}>
            <MaterialIcons name="attach-money" size={48} color="#0a7ea4" />
            <ThemedText style={styles.cardTitle}>Payment Settings</ThemedText>
            <ThemedText style={styles.cardSubtitle}>Configure payment rates</ThemedText>
          </Pressable>
        </ThemedView>
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
    fontSize: 32,
    marginBottom: 24,
    textAlign: 'center', // this centers the text horizontally
  },
  
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    justifyContent: 'center', // Center cards when wrapping
  },
  card: {
    width: 160,
    height: 160,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#687076',
    marginTop: 4,
    textAlign: 'center',
  },
});
