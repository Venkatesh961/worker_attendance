import { useState, useEffect } from 'react';
import { StyleSheet, Pressable, View, Platform, Modal, FlatList, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import * as Print from 'expo-print';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWorkers } from '@/hooks/useWorkers';
import { useFolders } from '@/hooks/useFolders';
import { useAttendance } from '@/hooks/useAttendance';
import { usePaymentSettings } from '@/hooks/usePaymentSettings';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { storeData, getData } from '@/utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import React from 'react';
import { LoadingOverlay } from '@/components/LoadingOverlay';

const s2ab = (s: string) => {
  const buf = new ArrayBuffer(s.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xFF;
  return buf;
};

const calculateNoteDistribution = (amount: number) => {
  const NOTE_500 = 500;
  const NOTE_100 = 100;
  
  // Round to nearest 100
  amount = Math.round(amount / 100) * 100;
  
  let bestDiff = Infinity;
  let result = { notes500: 0, notes100: 0 };
  
  // Maximum possible 500 rupee notes
  const maxNotes500 = Math.floor(amount / NOTE_500);
  
  for (let notes500 = 0; notes500 <= maxNotes500; notes500++) {
    const remainingAmount = amount - (notes500 * NOTE_500);
    const notes100 = Math.floor(remainingAmount / NOTE_100);
    
    // If this combination sums up to the target amount
    if ((notes500 * NOTE_500 + notes100 * NOTE_100) === amount) {
      const diff = Math.abs(notes500 - notes100);
      
      // Update if we found a better balance or same balance with fewer total notes
      if (diff < bestDiff || (diff === bestDiff && (notes500 + notes100) < (result.notes500 + result.notes100))) {
        bestDiff = diff;
        result = { notes500, notes100 };
      }
    }
  }
  
  return result;
};

type WorkerReport = {
  id: string;
  name: string;
  dailyWage: number;
  halfDayWage: number;
  attendance: ('P' | 'A' | 'H')[];
  totalPayment: number;
  advanceDeducted: number;
  advanceRemarks: string;
  netPayment: number;
};

type ReportMeta = {
  id: string;
  name: string;
  folder: string;
  startDate: string;
  endDate: string;
  path: string;
  createdAt: string;
};

type AdvanceWorker = {
  workerId: string;
  workerName: string;
  amount: string;
  date: string;
  remarks: string;
  deducted?: boolean;
};

type ExportFormat = 'xlsx' | 'pdf';

export default function ReportsScreen() {
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState('Default');
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [savedReports, setSavedReports] = useState<ReportMeta[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [deductAdvance, setDeductAdvance] = useState(true);
  const [workersWithAdvance, setWorkersWithAdvance] = useState<AdvanceWorker[]>([]);
  const [selectedAdvanceWorkers, setSelectedAdvanceWorkers] = useState<string[]>([]);
  const [showAdvanceWorkerPicker, setShowAdvanceWorkerPicker] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx');
  const [loadingMessage, setLoadingMessage] = useState('');

  const { folders, loadFolders } = useFolders();
  const { getWorkersByFolder, workers } = useWorkers();
  const { getAttendanceByFolder, loadAttendance } = useAttendance();
  const { folderRates } = usePaymentSettings();

  useEffect(() => {
    loadSavedReports();
  }, []);

  useEffect(() => {
    loadWorkersWithAdvance();
  }, [selectedFolder, workers, deductAdvance]);

  useFocusEffect(
    React.useCallback(() => {
      loadFolders();
    }, [])
  );

  const loadSavedReports = async () => {
    const reports = await getData('saved_reports') || [];
    setSavedReports(reports);
  };

  const loadWorkersWithAdvance = async () => {
    try {
      const savedAdvances = await AsyncStorage.getItem('advances');
      if (savedAdvances) {
        const advances: AdvanceWorker[] = JSON.parse(savedAdvances);
        // Filter only undeducted advances for current folder's workers
        const relevantWorkers = advances.filter(adv => {
          const workerExists = workers.some(w => w.id === adv.workerId && w.folders.includes(selectedFolder));
          return !adv.deducted && workerExists;
        });
        setWorkersWithAdvance(relevantWorkers);
      }
    } catch (error) {
      console.error('Error loading advances:', error);
    }
  };

  const generatePdfHtml = (reportData: WorkerReport[], dates: Date[]) => {
    const totalNetPayment = reportData.reduce((sum, row) => sum + row.netPayment, 0);
    const noteDistribution = calculateNoteDistribution(totalNetPayment);
    
    return `
      <html>
        <head>
          <style>
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f0f9ff; }
            .total-row { font-weight: bold; background-color: #f9fafb; }
            .notes-row { background-color: #f0f9ff; }
          </style>
        </head>
        <body>
          <h2>Attendance Report</h2>
          <table>
            <tr>
              <th>Worker Name</th>
              ${dates.map(date => `<th>${date.toLocaleDateString()}</th>`).join('')}
              <th>Present</th>
              <th>Half Day</th>
              <th>Total (₹)</th>
              <th>Advance (₹)</th>
              <th>Net (₹)</th>
              <th>Advance Details</th>
            </tr>
            ${reportData.map(row => `
              <tr>
                <td>${row.name}</td>
                ${row.attendance.map(status => `<td>${status}</td>`).join('')}
                <td>${row.attendance.filter(s => s === 'P').length}</td>
                <td>${row.attendance.filter(s => s === 'H').length}</td>
                <td>₹${row.totalPayment}</td>
                <td>₹${row.advanceDeducted}</td>
                <td>₹${row.netPayment}</td>
                <td>${row.advanceRemarks}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td>Total</td>
              ${dates.map(() => '<td></td>').join('')}
              <td></td>
              <td></td>
              <td>₹${reportData.reduce((sum, row) => sum + row.totalPayment, 0)}</td>
              <td>₹${reportData.reduce((sum, row) => sum + row.advanceDeducted, 0)}</td>
              <td>₹${totalNetPayment}</td>
              <td></td>
            </tr>
            <tr class="notes-row">
              <td>Note Distribution</td>
              ${dates.map(() => '<td></td>').join('')}
              <td colspan="5">₹500 x ${noteDistribution.notes500} + ₹100 x ${noteDistribution.notes100}</td>
              <td></td>
            </tr>
          </table>
        </body>
      </html>
    `;
  };

  const generateReport = async (folder: string, start: Date, end: Date): Promise<ReportMeta> => {
    setLoadingMessage('Generating report...');
    try {
      // First load fresh attendance data
      await loadAttendance();
      
      const workers = getWorkersByFolder(folder);
      const attendance = await getAttendanceByFolder(folder, '');
      const rates = folderRates[folder] || folderRates['Default'];

      if (!Array.isArray(workers) || workers.length === 0) {
        throw new Error('No workers found in this folder');
      }

      // Create date array from start to end date (inclusive)
      const dates: Date[] = [];
      const current = new Date(start);
      current.setHours(0, 0, 0, 0);
      const endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);

      while (current <= endDate) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }

      // Fetch advances
      const savedAdvances = await AsyncStorage.getItem('advances');
      const advances = savedAdvances ? JSON.parse(savedAdvances) : [];

      // Generate report data to include total payment calculations
      const reportData: WorkerReport[] = workers.map(worker => {
        const attendanceRecords = dates.map(date => {
          // Format dates consistently for comparison
          const targetDate = date.toISOString().split('T')[0];
          const record = attendance.find(a => 
            a.workerId === worker.id && 
            a.folderName === folder &&
            a.date === targetDate
          );

          if (record) {
            return record.status === 'present' ? 'P' : 
                   record.status === 'half-day' ? 'H' : 'A';
          }
          return 'A';  // Default to absent if no record found
        });

        const presentDays = attendanceRecords.filter(status => status === 'P').length;
        const halfDays = attendanceRecords.filter(status => status === 'H').length;
        const totalPayment = (presentDays * Number(rates.fullDay)) + (halfDays * Number(rates.halfDay));

        // Calculate advance deduction if enabled
        let advanceDeducted = 0;
        let advanceRemarks = '';

        if (deductAdvance) {
          const workerAdvances = advances.filter(
            (a: any) => a.workerId === worker.id && 
            new Date(a.date) <= end && 
            !a.deducted && 
            selectedAdvanceWorkers.includes(worker.id)
          );

          if (workerAdvances.length > 0) {
            advanceDeducted = workerAdvances.reduce((sum: number, adv: any) => sum + Number(adv.amount), 0);
            advanceRemarks = workerAdvances.map((adv: any) => 
              `${new Date(adv.date).toLocaleDateString()}: ₹${adv.amount}`
            ).join(', ');
          }
        }

        const netPayment = Math.max(0, totalPayment - advanceDeducted);

        return {
          id: worker.id,
          name: worker.name,
          dailyWage: Number(rates.fullDay),
          halfDayWage: Number(rates.halfDay),
          attendance: attendanceRecords,
          totalPayment,
          advanceDeducted,
          advanceRemarks,
          netPayment
        };
      });

      // Update advances immediately after calculating deductions
      if (deductAdvance && selectedAdvanceWorkers.length > 0) {
        const updatedAdvances = advances.map((adv: any) => {
          if (selectedAdvanceWorkers.includes(adv.workerId) && 
              new Date(adv.date) <= end && 
              !adv.deducted) {
            return {
              ...adv,
              deducted: true,
              deductedOn: new Date().toISOString()
            };
          }
          return adv;
        });

        await AsyncStorage.setItem('advances', JSON.stringify(updatedAdvances));
        // Reload advances after update
        setWorkersWithAdvance(updatedAdvances.filter((adv: { deducted: any; }) => !adv.deducted));
      }

      if (exportFormat === 'pdf') {
        setLoadingMessage('Creating PDF document...');
        const html = generatePdfHtml(reportData, dates);
        const { uri } = await Print.printToFileAsync({
          html,
          base64: false
        });
        
        const filename = `${folder}_${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}.pdf`;
        const newPath = `${FileSystem.documentDirectory}${filename}`;
        
        await FileSystem.moveAsync({
          from: uri,
          to: newPath
        });

        setLoadingMessage('Saving report...');
        const reportMeta = {
          id: Date.now().toString(),
          name: filename,
          folder,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          path: newPath,
          createdAt: new Date().toISOString()
        };

        await storeData('saved_reports', [...savedReports, reportMeta]);
        setSavedReports(prev => [...prev, reportMeta]);

        await Sharing.shareAsync(newPath, {
          mimeType: 'application/pdf',
          dialogTitle: filename
        });

        return reportMeta;
      }

      setLoadingMessage('Creating Excel workbook...');
      const workbook = {
        SheetNames: ['Attendance Report'],
        Sheets: {
          'Attendance Report': {
            '!ref': `A1:${String.fromCharCode(65 + dates.length + 5)}${reportData.length + 3}`,
            A1: { t: 's', v: 'Worker Name' },
            ...dates.reduce((acc, date, i) => ({
              ...acc,
              [`${String.fromCharCode(66 + i)}1`]: { 
                t: 's', 
                v: date.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' }) 
              }
            }), {}),
            [`${String.fromCharCode(66 + dates.length)}1`]: { t: 's', v: 'Present Days' },
            [`${String.fromCharCode(66 + dates.length + 1)}1`]: { t: 's', v: 'Half Days' },
            [`${String.fromCharCode(66 + dates.length + 2)}1`]: { t: 's', v: 'Total Payment (₹)' },
            [`${String.fromCharCode(66 + dates.length + 3)}1`]: { t: 's', v: 'Advance Deducted (₹)' },
            [`${String.fromCharCode(66 + dates.length + 4)}1`]: { t: 's', v: 'Net Payment (₹)' },
            [`${String.fromCharCode(66 + dates.length + 5)}1`]: { t: 's', v: 'Advance Details' },
            ...reportData.reduce((acc, row, idx) => {
              const rowNum = idx + 2;
              const lastDateCol = String.fromCharCode(65 + dates.length);
              return {
                ...acc,
                [`A${rowNum}`]: { t: 's', v: row.name },
                ...row.attendance.reduce((days, status, i) => ({
                  ...days,
                  [`${String.fromCharCode(66 + i)}${rowNum}`]: { t: 's', v: status }
                }), {}),
                [`${String.fromCharCode(66 + dates.length)}${rowNum}`]: { 
                  t: 'f', 
                  f: `COUNTIF(B${rowNum}:${lastDateCol}${rowNum},"P")` 
                },
                [`${String.fromCharCode(66 + dates.length + 1)}${rowNum}`]: { 
                  t: 'f', 
                  f: `COUNTIF(B${rowNum}:${lastDateCol}${rowNum},"H")` 
                },
                [`${String.fromCharCode(66 + dates.length + 2)}${rowNum}`]: { 
                  t: 'n',
                  v: row.totalPayment,
                  z: '₹#,##0'
                },
                [`${String.fromCharCode(66 + dates.length + 3)}${rowNum}`]: { 
                  t: 'n', 
                  v: row.advanceDeducted,
                  z: '₹#,##0'
                },
                [`${String.fromCharCode(66 + dates.length + 4)}${rowNum}`]: { 
                  t: 'n', 
                  v: row.netPayment,
                  z: '₹#,##0'
                },
                [`${String.fromCharCode(66 + dates.length + 5)}${rowNum}`]: { 
                  t: 's', 
                  v: row.advanceRemarks 
                }
              };
            }, {}),
            [`A${reportData.length + 2}`]: { t: 's', v: 'Total' },
            [`${String.fromCharCode(66 + dates.length + 2)}${reportData.length + 2}`]: { 
              t: 'f', 
              f: `SUM(${String.fromCharCode(66 + dates.length + 2)}2:${String.fromCharCode(66 + dates.length + 2)}${reportData.length + 1})`,
              z: '₹#,##0'
            },
            [`${String.fromCharCode(66 + dates.length + 3)}${reportData.length + 2}`]: { 
              t: 'f', 
              f: `SUM(${String.fromCharCode(66 + dates.length + 3)}2:${String.fromCharCode(66 + dates.length + 3)}${reportData.length + 1})`,
              z: '₹#,##0'
            },
            [`${String.fromCharCode(66 + dates.length + 4)}${reportData.length + 2}`]: { 
              t: 'f', 
              f: `SUM(${String.fromCharCode(66 + dates.length + 4)}2:${String.fromCharCode(66 + dates.length + 4)}${reportData.length + 1})`,
              z: '₹#,##0'
            },
            [`A${reportData.length + 3}`]: { t: 's', v: 'Note Distribution' },
            [`${String.fromCharCode(66 + dates.length + 4)}${reportData.length + 3}`]: { 
              t: 's', 
              v: calculateNoteDistribution(reportData.reduce((sum, row) => sum + row.netPayment, 0))
                  .notes500 > 0 || calculateNoteDistribution(reportData.reduce((sum, row) => sum + row.netPayment, 0))
                  .notes100 > 0 
                ? `₹500 x ${calculateNoteDistribution(reportData.reduce((sum, row) => sum + row.netPayment, 0)).notes500} + ₹100 x ${calculateNoteDistribution(reportData.reduce((sum, row) => sum + row.netPayment, 0)).notes100}`
                : '₹0'
            }
          }
        }
      };

      const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });

      const filename = `${folder}_${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}.xlsx`;
      const filePath = `${FileSystem.documentDirectory}${filename}`;
      
      await FileSystem.writeAsStringAsync(filePath, wbout, {
        encoding: FileSystem.EncodingType.Base64
      });

      setLoadingMessage('Saving report...');
      const reportMeta: ReportMeta = {
        id: Date.now().toString(),
        name: filename,
        folder,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        path: filePath,
        createdAt: new Date().toISOString()
      };

      await storeData('saved_reports', [...savedReports, reportMeta]);
      setSavedReports(prev => [...prev, reportMeta]);

      if (Platform.OS !== 'web') {
        const UTI = Platform.OS === 'ios' ? 'org.openxmlformats.spreadsheetml.sheet' : undefined;
        await Sharing.shareAsync(filePath, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: filename,
          UTI
        });
      }

      return reportMeta;
    } catch (error) {
      console.error('Error details:', error);
      throw error;
    } finally {
      setLoadingMessage('');
    }
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      if (startDate > endDate) {
        Alert.alert('Error', 'Start date cannot be after end date');
        return;
      }
      
      await generateReport(selectedFolder, startDate, endDate);
      Alert.alert('Success', 'Report generated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  const getDateRange = (type: 'today' | 'thisWeek' | 'lastWeek') => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (type) {
      case 'today':
        return { start: today, end: today };

      case 'thisWeek': {
        const monday = new Date(today);
        monday.setDate(today.getDate() - today.getDay() + 1); // Go to Monday
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6); // Go to Sunday
        return { start: monday, end: sunday };
      }

      case 'lastWeek': {
        const lastMonday = new Date(today);
        lastMonday.setDate(today.getDate() - today.getDay() - 6); // Go to last Monday
        const lastSunday = new Date(lastMonday);
        lastSunday.setDate(lastMonday.getDate() + 6); // Go to last Sunday
        return { start: lastMonday, end: lastSunday };
      }
    }
  };

  const handleQuickReport = async (type: 'today' | 'thisWeek' | 'lastWeek') => {
    setIsGenerating(true);
    try {
      const { start, end } = getDateRange(type);
      await generateReport(selectedFolder, start, end);
      Alert.alert('Success', 'Report generated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date, type: 'start' | 'end' = 'start') => {
    if (event.type === 'set' && selectedDate) {
      if (type === 'start') {
        setStartDate(selectedDate);
      } else {
        setEndDate(selectedDate);
      }
      if (Platform.OS === 'android') {
        setShowStartPicker(false);
        setShowEndPicker(false);
      }
    } else if (event.type === 'dismissed') {
      setShowStartPicker(false);
      setShowEndPicker(false);
    }
  };

  const renderDatePicker = (type: 'start' | 'end') => {
    const isStart = type === 'start';
    const show = isStart ? showStartPicker : showEndPicker;
    const date = isStart ? startDate : endDate;
    const setShow = isStart ? setShowStartPicker : setShowEndPicker;

    if (!show) return null;

    if (Platform.OS === 'ios') {
      return (
        <Modal
          animationType="slide"
          transparent={true}
          visible={show}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalView}>
              <ThemedView style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>
                  Select {isStart ? 'Start' : 'End'} Date
                </ThemedText>
                <Pressable onPress={() => setShow(false)}>
                  <MaterialIcons name="close" size={24} color="#687076" />
                </Pressable>
              </ThemedView>
              <DateTimePicker
                value={date}
                mode="date"
                display="spinner"
                onChange={(e, d) => handleDateChange(e, d, type)}
                textColor="#000000"
                style={styles.datePicker}
              />
            </View>
          </View>
        </Modal>
      );
    }

    return (
      <DateTimePicker
        value={date}
        mode="date"
        display="default"
        onChange={(e, d) => handleDateChange(e, d, type)}
      />
    );
  };

  const renderFolderPicker = () => {
    if (!showFolderPicker) return null;

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={showFolderPicker}
        onRequestClose={() => setShowFolderPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Select Folder</ThemedText>
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
                    selectedFolder === item.name && styles.folderItemSelected
                  ]}
                  onPress={() => {
                    setSelectedFolder(item.name);
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
              )}
            />
          </View>
        </View>
      </Modal>
    );
  };

  const renderAdvanceWorkerPicker = () => {
    if (!showAdvanceWorkerPicker) return null;

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={showAdvanceWorkerPicker}
        onRequestClose={() => setShowAdvanceWorkerPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Select Workers for Advance Deduction</ThemedText>
              <Pressable onPress={() => setShowAdvanceWorkerPicker(false)}>
                <MaterialIcons name="close" size={24} color="#687076" />
              </Pressable>
            </ThemedView>
            
            {workersWithAdvance.length > 0 ? (
              <FlatList
                data={workersWithAdvance}
                keyExtractor={(item) => item.workerId + item.date}
                renderItem={({ item }) => (
                  <Pressable
                    style={[
                      styles.advanceWorkerItem,
                      selectedAdvanceWorkers.includes(item.workerId) && styles.advanceWorkerItemSelected
                    ]}
                    onPress={() => {
                      setSelectedAdvanceWorkers(prev => 
                        prev.includes(item.workerId)
                          ? prev.filter(id => id !== item.workerId)
                          : [...prev, item.workerId]
                      );
                    }}>
                    <ThemedView style={styles.advanceWorkerInfo}>
                      <ThemedText style={styles.advanceWorkerName}>{item.workerName}</ThemedText>
                      <ThemedText style={styles.advanceAmount}>₹{item.amount}</ThemedText>
                      <ThemedText style={styles.advanceDate}>
                        {new Date(item.date).toLocaleDateString()}
                      </ThemedText>
                    </ThemedView>
                    <MaterialIcons 
                      name={selectedAdvanceWorkers.includes(item.workerId) ? "check-box" : "check-box-outline-blank"}
                      size={24}
                      color="#0a7ea4"
                    />
                  </Pressable>
                )}
              />
            ) : (
              <ThemedText style={styles.emptyText}>No pending advances for selected folder</ThemedText>
            )}
            
            <Pressable 
              style={styles.modalButton}
              onPress={() => setShowAdvanceWorkerPicker(false)}>
              <ThemedText style={styles.buttonText}>Done</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  };

  const handleDeleteReport = async (reportId: string) => {
    try {
      const report = savedReports.find(r => r.id === reportId);
      if (report) {
        await FileSystem.deleteAsync(report.path, { idempotent: true });
        const updatedReports = savedReports.filter(r => r.id !== reportId);
        await storeData('saved_reports', updatedReports);
        setSavedReports(updatedReports);
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      Alert.alert('Error', 'Failed to delete report');
    }
  };

  const handleDeleteSelected = async () => {
    try {
      const reportsToDelete = savedReports.filter(r => selectedReports.includes(r.id));
      await Promise.all(reportsToDelete.map(r => FileSystem.deleteAsync(r.path, { idempotent: true })));
      const updatedReports = savedReports.filter(r => !selectedReports.includes(r.id));
      await storeData('saved_reports', updatedReports);
      setSavedReports(updatedReports);
      setSelectedReports([]);
      setIsMultiSelectMode(false);
    } catch (error) {
      console.error('Error deleting reports:', error);
      Alert.alert('Error', 'Failed to delete selected reports');
    }
  };

  const handleDeleteAll = () => {
    Alert.alert(
      'Delete All Reports',
      'Are you sure you want to delete all reports?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all(savedReports.map(r => FileSystem.deleteAsync(r.path, { idempotent: true })));
              await storeData('saved_reports', []);
              setSavedReports([]);
            } catch (error) {
              console.error('Error deleting all reports:', error);
              Alert.alert('Error', 'Failed to delete all reports');
            }
          }
        }
      ]
    );
  };

  const toggleMultiSelectMode = () => {
    setIsMultiSelectMode(prev => {
      if (!prev) {
        return true;
      } else {
        setSelectedReports([]);
        return false;
      }
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        ListHeaderComponent={() => (
          <ThemedView style={styles.header}>
            <ThemedText style={styles.title}>Reports</ThemedText>
            
            <ThemedView style={styles.card}>
              <ThemedText style={styles.cardTitle}>Quick Generate</ThemedText>
              <ThemedView style={styles.quickReports}>
                <Pressable 
                  style={[styles.quickButton, isGenerating && styles.buttonDisabled]}
                  onPress={() => handleQuickReport('today')}
                  disabled={isGenerating}>
                  <MaterialIcons name="today" size={20} color="#fff" />
                  <ThemedText style={styles.quickButtonText}>Today</ThemedText>
                </Pressable>

                <Pressable 
                  style={[styles.quickButton, isGenerating && styles.buttonDisabled]}
                  onPress={() => handleQuickReport('thisWeek')}
                  disabled={isGenerating}>
                  <MaterialIcons name="date-range" size={20} color="#fff" />
                  <ThemedText style={styles.quickButtonText}>This Week</ThemedText>
                </Pressable>

                <Pressable 
                  style={[styles.quickButton, isGenerating && styles.buttonDisabled]}
                  onPress={() => handleQuickReport('lastWeek')}
                  disabled={isGenerating}>
                  <MaterialIcons name="history" size={20} color="#fff" />
                  <ThemedText style={styles.quickButtonText}>Last Week</ThemedText>
                </Pressable>
              </ThemedView>
            </ThemedView>

            <ThemedView style={styles.card}>
              <ThemedText style={styles.cardTitle}>Custom Report</ThemedText>
              
              <ThemedView style={styles.dateRange}>
                <Pressable 
                  style={styles.dateSelector}
                  onPress={() => setShowStartPicker(true)}>
                  <ThemedText style={styles.dateLabel}>Start Date</ThemedText>
                  <ThemedText style={styles.dateText}>
                    {startDate.toLocaleDateString()}
                  </ThemedText>
                  <MaterialIcons name="calendar-today" size={24} color="#687076" />
                </Pressable>

                <Pressable 
                  style={styles.dateSelector}
                  onPress={() => setShowEndPicker(true)}>
                  <ThemedText style={styles.dateLabel}>End Date</ThemedText>
                  <ThemedText style={styles.dateText}>
                    {endDate.toLocaleDateString()}
                  </ThemedText>
                  <MaterialIcons name="calendar-today" size={24} color="#687076" />
                </Pressable>
              </ThemedView>

              <Pressable 
                style={styles.folderSelector}
                onPress={() => setShowFolderPicker(true)}>
                <ThemedView style={styles.folderInfo}>
                  <MaterialIcons name="folder" size={24} color="#0a7ea4" />
                  <ThemedText style={styles.folderName}>{selectedFolder}</ThemedText>
                </ThemedView>
                <MaterialIcons name="arrow-drop-down" size={24} color="#687076" />
              </Pressable>

              <ThemedView style={styles.optionsContainer}>
                <Pressable 
                  style={[styles.advanceToggle, !deductAdvance && styles.advanceToggleOff]}
                  onPress={() => {
                    setDeductAdvance(!deductAdvance);
                    if (!deductAdvance) {
                      setShowAdvanceWorkerPicker(true);
                    } else {
                      setSelectedAdvanceWorkers([]);
                    }
                  }}>
                  <MaterialIcons 
                    name={deductAdvance ? "check-box" : "check-box-outline-blank"} 
                    size={24} 
                    color="#0a7ea4" 
                  />
                  <ThemedText style={styles.advanceToggleText}>
                    Deduct Advances {selectedAdvanceWorkers.length > 0 ? `(${selectedAdvanceWorkers.length} selected)` : ''}
                  </ThemedText>
                </Pressable>
                
                {deductAdvance && (
                  <Pressable 
                    style={styles.advanceWorkerSelector}
                    onPress={() => setShowAdvanceWorkerPicker(true)}>
                    <MaterialIcons name="people" size={24} color="#0a7ea4" />
                    <ThemedText style={styles.advanceWorkerSelectorText}>
                      {selectedAdvanceWorkers.length > 0 
                        ? `${selectedAdvanceWorkers.length} worker${selectedAdvanceWorkers.length > 1 ? 's' : ''} selected`
                        : 'Select workers for advance deduction'}
                    </ThemedText>
                    <MaterialIcons name="arrow-drop-down" size={24} color="#687076" />
                  </Pressable>
                )}

                <Pressable 
                  style={styles.formatToggle}
                  onPress={() => setExportFormat(prev => prev === 'xlsx' ? 'pdf' : 'xlsx')}>
                  <MaterialIcons 
                    name={exportFormat === 'xlsx' ? "table-chart" : "picture-as-pdf"} 
                    size={24} 
                    color="#0a7ea4" 
                  />
                  <ThemedText style={styles.formatToggleText}>
                    Export as {exportFormat.toUpperCase()}
                  </ThemedText>
                </Pressable>

                <Pressable 
                  style={[styles.generateButton, isGenerating && styles.buttonDisabled]}
                  onPress={handleGenerateReport}
                  disabled={isGenerating}>
                  <ThemedText style={styles.buttonText}>
                    {isGenerating ? 'Generating...' : 'Generate Report'}
                  </ThemedText>
                </Pressable>
              </ThemedView>
            </ThemedView>

            <ThemedView style={styles.reportsHeader}>
              <ThemedText style={styles.sectionTitle}>Saved Reports</ThemedText>
              {savedReports.length > 0 && (
                <ThemedView style={styles.reportsActions}>
                  <Pressable 
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => {
                      if (selectedReports.length > 0) {
                        handleDeleteSelected();
                      } else {
                        handleDeleteAll();
                      }
                    }}>
                    <MaterialIcons name="delete" size={24} color="#dc2626" />
                    {isMultiSelectMode && selectedReports.length > 0 && (
                      <ThemedText style={styles.deleteCount}>({selectedReports.length})</ThemedText>
                    )}
                  </Pressable>
                  <Pressable 
                    style={styles.actionButton}
                    onPress={toggleMultiSelectMode}>
                    <MaterialIcons 
                      name={isMultiSelectMode ? "close" : "select-all"} 
                      size={24} 
                      color="#687076" 
                    />
                  </Pressable>
                </ThemedView>
              )}
            </ThemedView>
          </ThemedView>
        )}
        data={savedReports}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <Pressable 
            style={[
              styles.reportItem,
              selectedReports.includes(item.id) && styles.reportItemSelected
            ]}
            onPress={() => {
              if (isMultiSelectMode) {
                setSelectedReports(prev => 
                  prev.includes(item.id) 
                    ? prev.filter(id => id !== item.id)
                    : [...prev, item.id]
                );
              } else {
                Sharing.shareAsync(item.path);
              }
            }}
            onLongPress={() => {
              if (!isMultiSelectMode) {
                setIsMultiSelectMode(true);
                setSelectedReports([item.id]);
              }
            }}>
            <ThemedView style={styles.reportContent}>
              <ThemedText style={styles.reportName}>{item.name}</ThemedText>
              <ThemedText style={styles.reportDate}>
                {new Date(item.createdAt).toLocaleDateString()}
              </ThemedText>
            </ThemedView>
            {isMultiSelectMode ? (
              <MaterialIcons 
                name={selectedReports.includes(item.id) ? "check-box" : "check-box-outline-blank"}
                size={24}
                color="#0a7ea4"
              />
            ) : (
              <Pressable
                style={styles.deleteButton}
                onPress={() => handleDeleteReport(item.id)}>
                <MaterialIcons name="delete" size={20} color="#dc2626" />
              </Pressable>
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          <ThemedView style={styles.emptyContainer}>
            <MaterialIcons name="description" size={48} color="#e5e7eb" />
            <ThemedText style={styles.emptyText}>No saved reports</ThemedText>
          </ThemedView>
        }
        contentContainerStyle={styles.listContent}
      />
      {renderDatePicker('start')}
      {renderDatePicker('end')}
      {renderFolderPicker()}
      {renderAdvanceWorkerPicker()}
      <LoadingOverlay 
        visible={!!loadingMessage} 
        message={loadingMessage}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
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
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  quickReports: {
    flexDirection: 'row',
    gap: 8,
  },
  quickButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#0a7ea4',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  quickButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  dateRange: {
    gap: 12,
    marginBottom: 20,
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
  },
  dateLabel: {
    fontSize: 14,
    color: '#687076',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    marginLeft: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalView: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
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
  datePicker: {
    height: 200,
    marginTop: 12,
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
    marginBottom: 20,
  },
  folderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  folderName: {
    fontSize: 16,
    fontWeight: '500',
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
  generateButton: {
    backgroundColor: '#0a7ea4',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#93c5fd',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  reportsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  reportsActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    padding: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  reportItem: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e1e4e8',
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportContent: {
    flex: 1,
  },
  reportItemSelected: {
    backgroundColor: '#f0f9ff',
    borderColor: '#0a7ea4',
  },
  deleteButton: {
    padding: 8,
  },
  deleteCount: {
    fontSize: 14,
    color: '#dc2626',
    marginLeft: 4,
  },
  reportName: {
    fontSize: 16,
    fontWeight: '500',
  },
  reportDate: {
    fontSize: 14,
    color: '#687076',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    textAlign: 'center',
    color: '#687076',
    marginTop: 20,
  },
  advanceToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginBottom: 16,
  },
  advanceToggleText: {
    fontSize: 16,
    color: '#111827',
  },
  advanceToggleOff: {
    opacity: 0.7,
  },
  advanceWorkerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e4e8',
  },
  advanceWorkerItemSelected: {
    backgroundColor: '#f0f9ff',
  },
  advanceWorkerInfo: {
    flex: 1,
    gap: 4,
  },
  advanceWorkerName: {
    fontSize: 16,
    fontWeight: '500',
  },
  advanceAmount: {
    fontSize: 16,
    color: '#0a7ea4',
    fontWeight: '600',
  },
  advanceDate: {
    fontSize: 14,
    color: '#687076',
  },
  advanceWorkerSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e1e4e8',
    borderRadius: 12,
    marginBottom: 16,
  },
  advanceWorkerSelectorText: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  modalButton: {
    backgroundColor: '#0a7ea4',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  formatToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginBottom: 16,
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
  },
  formatToggleText: {
    fontSize: 16,
    color: '#0a7ea4',
    fontWeight: '500',
  },
  optionsContainer: {
    gap: 12,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
});
